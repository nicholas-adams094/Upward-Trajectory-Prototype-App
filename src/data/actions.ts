import { mutate } from './store'
import { newId } from '../lib/ids'
import { todayIso } from '../lib/metrics'
import type {
  Action, CheckIn, CliftonTheme, EnneagramResult, Goal, Phase, PortalSettings, Ratings,
  Role, SynthesisReport, User,
} from '../types'
import { CADENCE_DAYS } from '../types'

const addDays = (iso: string, days: number) =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10)

const logActivity = (
  draft: Parameters<Parameters<typeof mutate>[0]>[0],
  engagementId: string,
  actorId: string,
  kind: 'assessment' | 'report' | 'plan' | 'session' | 'checkin' | 'action' | 'system',
  summary: string,
) => {
  draft.activity.unshift({ id: newId('act'), engagementId, at: todayIso(), actorId, kind, summary })
}

/* ---------------------------------------------------------- commitments */

export function setActionStatus(actionId: string, status: Action['status'], actor: User) {
  mutate((db) => {
    const a = db.actions.find((x) => x.id === actionId)
    if (!a) return
    a.status = status
    a.completedOn = status === 'done' ? todayIso() : undefined
    // Reopening clears any claim that was made about it.
    if (status === 'open') {
      a.confirmedBy = undefined
      a.confirmedOn = undefined
      a.disputedOn = undefined
    }
    logActivity(db, a.engagementId, actor.id, 'action', `${actor.name} marked "${a.title}" as ${status}.`)

    // A weekly commitment that is closed and never reappears was never weekly.
    // Settling one occurrence schedules the next one in its series.
    if (status === 'open' || a.cadence === 'once') return
    const later = db.actions.filter((x) => x.seriesId === a.seriesId && x.occurrence > a.occurrence)
    if (later.length) return
    db.actions.push({
      ...a,
      id: newId('ac'),
      occurrence: a.occurrence + 1,
      dueOn: addDays(a.dueOn > todayIso() ? a.dueOn : todayIso(), CADENCE_DAYS[a.cadence]),
      status: 'open',
      completedOn: undefined,
      confirmedBy: undefined,
      confirmedOn: undefined,
      disputedOn: undefined,
    })
  })
}

/** The client says whether a reinforcement action their manager recorded actually happened. */
export function respondToAction(actionId: string, outcome: 'confirmed' | 'disputed', actor: User) {
  mutate((db) => {
    const a = db.actions.find((x) => x.id === actionId)
    if (!a) return
    a.confirmedBy = outcome === 'confirmed' ? actor.id : undefined
    a.confirmedOn = outcome === 'confirmed' ? todayIso() : undefined
    a.disputedOn = outcome === 'disputed' ? todayIso() : undefined
    logActivity(
      db, a.engagementId, actor.id, 'action',
      outcome === 'confirmed'
        ? `${actor.name} confirmed reinforcement they experienced.`
        : `${actor.name} recorded that reinforcement did not land as logged.`,
    )
  })
}

export function addAction(
  input: Omit<Action, 'id' | 'status' | 'completedOn' | 'seriesId' | 'occurrence' | 'dueOn'>,
  actor: User,
) {
  mutate((db) => {
    db.actions.push({
      ...input,
      id: newId('ac'),
      seriesId: newId('sr'),
      occurrence: 1,
      dueOn: addDays(todayIso(), db.settings.commitmentLeadDays),
      status: 'open',
    })
    logActivity(db, input.engagementId, actor.id, 'action', `${actor.name} added a ${input.owner} commitment: ${input.title}`)
  })
}

/* ------------------------------------------------------------- check-ins */

export function addCheckIn(input: { goalId: string; engagementId: string; rating: number; note: string }, actor: User) {
  mutate((db) => {
    const entry: CheckIn = {
      id: newId('ci'),
      goalId: input.goalId,
      engagementId: input.engagementId,
      byUserId: actor.id,
      byRole: actor.role,
      date: todayIso(),
      rating: input.rating,
      note: input.note,
    }
    db.checkIns.push(entry)

    // Keep the goal's headline status honest as new observations land.
    const goal = db.goals.find((g) => g.id === input.goalId)
    if (goal) {
      const span = goal.target - goal.baseline
      const pct = span <= 0 ? 1 : (input.rating - goal.baseline) / span
      goal.status = input.rating >= goal.target ? 'achieved' : pct < 0.35 ? 'at_risk' : 'on_track'
    }
    logActivity(db, input.engagementId, actor.id, 'checkin', `${actor.name} rated "${goal?.title ?? 'a goal'}" at ${input.rating.toFixed(1)}.`)
  })
}

/* ----------------------------------------------------------------- goals */

export function addGoal(input: Omit<Goal, 'id' | 'createdOn' | 'status' | 'targetDate'>, actor: User) {
  mutate((db) => {
    db.goals.push({
      ...input,
      id: newId('g'),
      createdOn: todayIso(),
      targetDate: addDays(todayIso(), db.settings.goalHorizonWeeks * 7),
      status: 'not_started',
    })
    logActivity(db, input.engagementId, actor.id, 'plan', `Goal added to the coaching plan: ${input.title}`)
  })
}

/** Tick a behavioural measure once it has actually been observed. */
export function setMeasureMet(goalId: string, measureId: string, met: boolean, actor: User) {
  mutate((db) => {
    const goal = db.goals.find((g) => g.id === goalId)
    const measure = goal?.measures.find((m) => m.id === measureId)
    if (!goal || !measure) return
    measure.metOn = met ? todayIso() : undefined
    measure.metBy = met ? actor.id : undefined
    if (met && goal.measures.every((m) => m.metOn)) {
      logActivity(db, goal.engagementId, actor.id, 'plan', `Every measure on "${goal.title}" has now been met.`)
    } else if (met) {
      logActivity(db, goal.engagementId, actor.id, 'plan', `A measure on "${goal.title}" was met.`)
    }
  })
}

/* ---------------------------------------------------------------- report */

export function saveReport(report: SynthesisReport) {
  mutate((db) => {
    const i = db.reports.findIndex((r) => r.id === report.id)
    const next = { ...report, updatedOn: todayIso() }
    if (i >= 0) db.reports[i] = next
    else db.reports.push(next)
  })
}

export function createDraftReport(engagementId: string, actor: User) {
  mutate((db) => {
    if (db.reports.some((r) => r.engagementId === engagementId)) return
    db.reports.push({
      id: newId('rep'),
      engagementId,
      status: 'draft',
      version: 1,
      updatedOn: todayIso(),
      headline: '',
      signatureStrengths: [],
      doMoreOf: [],
      watchOuts: [],
      themes: [],
      sharedWith: ['client'],
    })
    logActivity(db, engagementId, actor.id, 'report', 'Synthesis report started.')
  })
}

export function publishReport(reportId: string, sharedWith: Role[], actor: User) {
  mutate((db) => {
    const r = db.reports.find((x) => x.id === reportId)
    if (!r) return
    const wasDraft = r.status === 'draft'
    r.status = 'published'
    r.sharedWith = sharedWith
    r.publishedOn = todayIso()
    r.updatedOn = todayIso()
    if (!wasDraft) r.version += 1
    // Freeze what was released. Later edits are the coach's working copy.
    r.published = {
      version: r.version,
      publishedOn: r.publishedOn,
      headline: r.headline,
      signatureStrengths: [...r.signatureStrengths],
      doMoreOf: [...r.doMoreOf],
      watchOuts: [...r.watchOuts],
      themes: r.themes.map((t) => ({ ...t, evidence: [...t.evidence] })),
    }
    const audience = sharedWith.filter((s) => s !== 'client')
    logActivity(
      db, r.engagementId, actor.id, 'report',
      `Report v${r.version} published to the client${audience.length ? ` and released to ${audience.join(' and ')}` : ''}.`,
    )
  })
}

export function unpublishReport(reportId: string, actor: User) {
  mutate((db) => {
    const r = db.reports.find((x) => x.id === reportId)
    if (!r) return
    r.status = 'draft'
    r.sharedWith = ['client']
    r.publishedOn = undefined
    r.published = undefined
    logActivity(db, r.engagementId, actor.id, 'report', 'Report withdrawn to draft. Manager and HR access revoked.')
  })
}

/* ----------------------------------------------------------- assessments */

export function submitSelfEvaluation(engagementId: string, ratings: Ratings, keepDoing: string, doMoreOf: string, actor: User) {
  mutate((db) => {
    const assessment = db.assessments.find((a) => a.engagementId === engagementId && a.kind === 'self')
    if (!assessment) return
    assessment.status = 'complete'
    assessment.completedOn = todayIso()

    let respondent = db.respondents.find((r) => r.assessmentId === assessment.id && r.relationship === 'self')
    if (!respondent) {
      respondent = {
        id: newId('r'), assessmentId: assessment.id, name: actor.name, email: actor.email,
        relationship: 'self', status: 'submitted', invitedOn: todayIso(), submittedOn: todayIso(),
      }
      db.respondents.push(respondent)
    } else {
      respondent.status = 'submitted'
      respondent.submittedOn = todayIso()
    }

    const existing = db.responses.find((r) => r.respondentId === respondent!.id)
    if (existing) {
      Object.assign(existing, { ratings, keepDoing, doMoreOf, submittedOn: todayIso() })
    } else {
      db.responses.push({
        id: newId('resp'), assessmentId: assessment.id, respondentId: respondent.id,
        relationship: 'self', submittedOn: todayIso(), ratings, keepDoing, doMoreOf,
      })
    }
    logActivity(db, engagementId, actor.id, 'assessment', 'Self-evaluation submitted.')
  })
}

export function submitFeedback(respondentId: string, ratings: Ratings, keepDoing: string, doMoreOf: string) {
  mutate((db) => {
    const respondent = db.respondents.find((r) => r.id === respondentId)
    if (!respondent) return
    respondent.status = 'submitted'
    respondent.submittedOn = todayIso()

    const existing = db.responses.find((r) => r.respondentId === respondentId)
    if (existing) {
      Object.assign(existing, { ratings, keepDoing, doMoreOf, submittedOn: todayIso() })
    } else {
      db.responses.push({
        id: newId('resp'), assessmentId: respondent.assessmentId, respondentId,
        relationship: respondent.relationship, submittedOn: todayIso(), ratings, keepDoing, doMoreOf,
      })
    }

    const assessment = db.assessments.find((a) => a.id === respondent.assessmentId)
    if (assessment) {
      // A rater who declined is never going to answer; waiting on them would
      // leave the window permanently open.
      const awaited = db.respondents.filter((r) => r.assessmentId === assessment.id && r.status !== 'declined')
      const submitted = awaited.filter((r) => r.status === 'submitted').length
      assessment.status = submitted === awaited.length ? 'complete' : 'in_progress'
      assessment.completedOn = assessment.status === 'complete' ? todayIso() : undefined
      const engagement = db.engagements.find((e) => e.id === assessment.engagementId)
      logActivity(
        db, assessment.engagementId, engagement?.coachId ?? '', 'assessment',
        `360 response received (${submitted} of ${awaited.length} raters in).`,
      )
    }
  })
}

/** Open a fresh 360 wave against the roster that answered the last one. */
export function openFeedbackWave(engagementId: string, actor: User) {
  mutate((db) => {
    const prior = db.assessments
      .filter((a) => a.engagementId === engagementId && a.kind === 'feedback360')
      .sort((a, b) => b.round - a.round)[0]
    if (!prior) return
    const round = prior.round + 1

    const assessmentId = newId('a')
    db.assessments.push({
      id: assessmentId, engagementId, kind: 'feedback360', status: 'in_progress', round,
      assignedOn: todayIso(), dueOn: addDays(todayIso(), 21),
    })
    // Carry over everyone who answered last time; a re-measure against a
    // different room measures the room, not the person.
    for (const r of db.respondents.filter((r) => r.assessmentId === prior.id && r.status === 'submitted')) {
      db.respondents.push({
        id: newId('r'), assessmentId, name: r.name, email: r.email,
        relationship: r.relationship, status: 'invited', invitedOn: todayIso(),
      })
    }
    if (!db.waves.some((w) => w.round === round)) {
      db.waves.push({ round, label: `Wave ${round}`, openedOn: todayIso() })
    }
    logActivity(db, engagementId, actor.id, 'assessment', `A re-measure 360 was opened (wave ${round}).`)
  })
}

/* ------------------------------------------------------ close & handover */

export function closeEngagement(
  input: { engagementId: string; carriedGoalIds: string[]; summary: string; managerOwns: string; reviewOn: string },
  actor: User,
) {
  mutate((db) => {
    const e = db.engagements.find((x) => x.id === input.engagementId)
    if (!e) return
    e.status = 'complete'
    e.phase = 'sustain'
    e.closedOn = todayIso()
    db.handovers.push({ id: newId('ho'), closedOn: todayIso(), acknowledgedByManagerOn: undefined, ...input })
    logActivity(db, e.id, actor.id, 'system', 'Engagement closed and handed over to the manager.')
  })
}

export function acknowledgeHandover(handoverId: string, actor: User) {
  mutate((db) => {
    const h = db.handovers.find((x) => x.id === handoverId)
    if (!h) return
    if (actor.role === 'manager') h.acknowledgedByManagerOn = todayIso()
    if (actor.role === 'client') h.acknowledgedByClientOn = todayIso()
    logActivity(db, h.engagementId, actor.id, 'system', `${actor.name} acknowledged the handover.`)
  })
}

export function reopenEngagement(engagementId: string, actor: User) {
  mutate((db) => {
    const e = db.engagements.find((x) => x.id === engagementId)
    if (!e) return
    e.status = 'active'
    e.closedOn = undefined
    db.handovers = db.handovers.filter((h) => h.engagementId !== engagementId)
    logActivity(db, engagementId, actor.id, 'system', 'Engagement reopened.')
  })
}

export function setEngagementStatus(engagementId: string, status: 'active' | 'paused', actor: User) {
  mutate((db) => {
    const e = db.engagements.find((x) => x.id === engagementId)
    if (!e) return
    e.status = status
    e.closedOn = undefined
    logActivity(db, engagementId, actor.id, 'system', status === 'paused' ? 'Engagement paused.' : 'Engagement resumed.')
  })
}

/* ------------------------------------------------------------- settings */

export function updateSettings(patch: Partial<PortalSettings>, actor: User) {
  mutate((db) => {
    db.settings = { ...db.settings, ...patch, updatedOn: todayIso(), updatedBy: actor.id }
  })
}

export function inviteRespondent(
  assessmentId: string,
  input: { name: string; email: string; relationship: 'manager' | 'peer' | 'direct_report' | 'stakeholder' },
  actor: User,
) {
  mutate((db) => {
    db.respondents.push({
      id: newId('r'), assessmentId, ...input, status: 'invited', invitedOn: todayIso(),
    })
    const assessment = db.assessments.find((a) => a.id === assessmentId)
    if (assessment) {
      // Reopen a completed window too — there is now someone outstanding again.
      if (assessment.status !== 'in_progress') {
        assessment.status = 'in_progress'
        assessment.completedOn = undefined
      }
      // No rater name: the feed is visible to roles that must never learn who rated.
      logActivity(db, assessment.engagementId, actor.id, 'assessment', 'A rater was invited to give 360 feedback.')
    }
  })
}

export function saveClifton(engagementId: string, themes: CliftonTheme[], actor: User) {
  mutate((db) => {
    const existing = db.clifton.find((c) => c.engagementId === engagementId)
    if (existing) existing.themes = themes
    else db.clifton.push({ id: newId('cl'), engagementId, recordedOn: todayIso(), themes })

    const assessment = db.assessments.find((a) => a.engagementId === engagementId && a.kind === 'clifton')
    if (assessment) {
      assessment.status = 'complete'
      assessment.completedOn = todayIso()
    }
    logActivity(db, engagementId, actor.id, 'assessment', 'CliftonStrengths top 5 recorded.')
  })
}

export function saveEnneagram(engagementId: string, input: Omit<EnneagramResult, 'id' | 'engagementId' | 'recordedOn'>, actor: User) {
  mutate((db) => {
    const existing = db.enneagram.find((c) => c.engagementId === engagementId)
    if (existing) Object.assign(existing, input)
    else db.enneagram.push({ id: newId('en'), engagementId, recordedOn: todayIso(), ...input })

    const assessment = db.assessments.find((a) => a.engagementId === engagementId && a.kind === 'enneagram')
    if (assessment) {
      assessment.status = 'complete'
      assessment.completedOn = todayIso()
    }
    logActivity(db, engagementId, actor.id, 'assessment', 'Enneagram result recorded.')
  })
}

/* -------------------------------------------------------------- sessions */

export function logSession(
  input: { engagementId: string; date: string; topic: string; sharedNotes: string; privateNotes: string },
  actor: User,
) {
  mutate((db) => {
    db.sessions.push({ ...input, id: newId('s'), durationMin: 60, status: 'held' })
    // The topic is session content; the feed reaches roles that cannot see it.
    logActivity(db, input.engagementId, actor.id, 'session', 'Coaching session held.')
  })
}

/* ------------------------------------------------------------ engagement */

export function setPhase(engagementId: string, phase: Phase, actor: User) {
  mutate((db) => {
    const e = db.engagements.find((x) => x.id === engagementId)
    if (!e) return
    e.phase = phase
    logActivity(db, engagementId, actor.id, 'system', `Engagement moved to the ${phase} phase.`)
  })
}
