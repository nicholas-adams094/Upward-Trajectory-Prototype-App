import type {
  Action, CheckIn, Competency, Database, Engagement, Goal, Relationship, Role,
} from '../types'
import { PHASES } from '../types'

export const todayIso = () => {
  // The user's calendar date, not UTC's. Everything rendered is a plain date,
  // so a UTC stamp reads as tomorrow for anyone west of Greenwich after ~17:00.
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* --------------------------------------------------------------- goals */

export interface GoalProgress {
  goal: Goal
  checkIns: CheckIn[]
  latest: number
  /** 0-1 of the distance from baseline to target. */
  pct: number
  /** Change over the last four check-ins. */
  momentum: number
}

export function goalProgress(goal: Goal, allCheckIns: CheckIn[]): GoalProgress {
  const checkIns = allCheckIns
    .filter((c) => c.goalId === goal.id)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const latest = checkIns.length ? checkIns[checkIns.length - 1].rating : goal.baseline
  const span = goal.target - goal.baseline
  const pct = span <= 0 ? 0 : Math.max(0, Math.min(1, (latest - goal.baseline) / span))
  const prior = checkIns.length > 4 ? checkIns[checkIns.length - 5].rating : goal.baseline
  return { goal, checkIns, latest, pct, momentum: Math.round((latest - prior) * 10) / 10 }
}

export function goalsFor(db: Database, engagementId: string) {
  return db.goals.filter((g) => g.engagementId === engagementId)
}

/* --------------------------------------------------------- commitments */

export interface CommitmentStats {
  due: number
  done: number
  overdue: number
  rate: number
  /** Of the completed actions, how many the other party confirmed / disputed. */
  confirmed: number
  disputed: number
  awaitingConfirmation: number
  /** Follow-through counting only what the recipient confirmed. Never above `rate`. */
  confirmedRate: number
}

export function commitmentStats(actions: Action[], owner: Action['owner'], today = todayIso()): CommitmentStats {
  const mine = actions.filter((a) => a.owner === owner)
  const past = mine.filter((a) => a.dueOn <= today)
  const completed = past.filter((a) => a.status === 'done')
  const done = completed.length
  const overdue = past.filter((a) => a.status === 'open').length
  const confirmed = completed.filter((a) => a.confirmedOn).length
  const disputed = completed.filter((a) => a.disputedOn).length
  return {
    due: past.length,
    done,
    overdue,
    rate: past.length ? done / past.length : 0,
    confirmed,
    disputed,
    awaitingConfirmation: done - confirmed - disputed,
    confirmedRate: past.length ? confirmed / past.length : 0,
  }
}

/** Reinforcement actions the client has been asked to confirm and has not yet. */
export function awaitingConfirmation(db: Database, engagementId: string) {
  return db.actions.filter(
    (a) => a.engagementId === engagementId && a.owner === 'manager' && a.status === 'done'
      && !a.confirmedOn && !a.disputedOn,
  ).sort((a, b) => (a.dueOn < b.dueOn ? 1 : -1))
}

/** Measures ticked off across a plan — evidence that a goal actually landed. */
export function measureProgress(goals: Goal[]) {
  const all = goals.flatMap((g) => g.measures)
  return { met: all.filter((m) => m.metOn).length, total: all.length }
}

export function openActions(db: Database, engagementId: string, owner: Action['owner']) {
  return db.actions
    .filter((a) => a.engagementId === engagementId && a.owner === owner && a.status === 'open')
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1))
}

/* ---------------------------------------------------------- engagement */

export interface ScoreComponent {
  key: 'assessment' | 'synthesis' | 'plan'
  label: string
  weight: number
  /** 0-100 for this input on its own. */
  value: number
  /** Points this input contributes to the overall score. */
  contribution: number
  detail: string
}

export interface EngagementScore {
  /** 0-100. Evidence only: no phase, no self-declaration. */
  overall: number
  assessment: number
  synthesis: number
  plan: number
  reinforcement: number
  confirmedReinforcement: number
  hasReinforcementData: boolean
  phaseIndex: number
  components: ScoreComponent[]
}

export const SCORE_WEIGHTS = { assessment: 0.3, synthesis: 0.15, plan: 0.55 }

/**
 * Progress is evidence, not declaration.
 *
 * Milestones are weighted in lifecycle order and each one only counts once the
 * work behind it exists. Phase is deliberately NOT an input: it is set from a
 * dropdown, so including it let an empty engagement read 90% simply by being
 * moved to "sustain". Manager reinforcement is not an input either — a client's
 * progress should not be dragged down by their manager's admin.
 *
 * This is also continuous: a goal nobody has observed yet contributes nothing
 * either way, so adding one to the plan can never make the number fall.
 */
export function engagementScore(db: Database, e: Engagement): EngagementScore {
  const assessments = db.assessments.filter((a) => a.engagementId === e.id)
  const assessment = assessments.length
    ? assessments.reduce((s, a) => s + (a.status === 'complete' ? 1 : a.status === 'in_progress' ? 0.5 : 0), 0) / assessments.length
    : 0

  const goals = goalsFor(db, e.id)
  const measured = goals.filter((g) => db.checkIns.some((c) => c.goalId === g.id))
  const plan = measured.length
    ? measured.reduce((s, g) => s + goalProgress(g, db.checkIns).pct, 0) / measured.length
    : 0

  const report = db.reports.find((r) => r.engagementId === e.id)
  const synthesis = report ? (report.status === 'published' ? 1 : 0.5) : 0

  const managerStats = commitmentStats(db.actions.filter((a) => a.engagementId === e.id), 'manager')

  // Inputs collected, then synthesised, then behaviour actually moved.
  const overall = SCORE_WEIGHTS.assessment * assessment + SCORE_WEIGHTS.synthesis * synthesis + SCORE_WEIGHTS.plan * plan
  const done = assessments.filter((a) => a.status === 'complete').length

  const components: ScoreComponent[] = [
    {
      key: 'assessment', label: 'Assessments in', weight: SCORE_WEIGHTS.assessment,
      value: Math.round(assessment * 100),
      contribution: Math.round(SCORE_WEIGHTS.assessment * assessment * 100),
      detail: `${done} of ${assessments.length} complete`,
    },
    {
      key: 'synthesis', label: 'Report', weight: SCORE_WEIGHTS.synthesis,
      value: Math.round(synthesis * 100),
      contribution: Math.round(SCORE_WEIGHTS.synthesis * synthesis * 100),
      detail: !report ? 'Not started' : report.status === 'published' ? `Published v${report.version}` : 'In draft',
    },
    {
      key: 'plan', label: 'Movement against goals', weight: SCORE_WEIGHTS.plan,
      value: Math.round(plan * 100),
      contribution: Math.round(SCORE_WEIGHTS.plan * plan * 100),
      detail: measured.length
        ? `${measured.length} of ${goals.length} goal${goals.length === 1 ? '' : 's'} observed`
        : 'No check-ins yet',
    },
  ]

  return {
    overall: Math.round(overall * 100),
    assessment: Math.round(assessment * 100),
    synthesis: Math.round(synthesis * 100),
    plan: Math.round(plan * 100),
    reinforcement: Math.round(managerStats.rate * 100),
    confirmedReinforcement: Math.round(managerStats.confirmedRate * 100),
    /** False when no manager action has ever come due — 0% would be a lie. */
    hasReinforcementData: managerStats.due > 0,
    phaseIndex: Math.max(0, PHASES.findIndex((p) => p.id === e.phase)),
    components,
  }
}

/* ---------------------------------------------------- 360 aggregation */

export const RATER_GROUPS: Relationship[] = ['self', 'manager', 'peer', 'direct_report', 'stakeholder']

export interface CompetencyRollup {
  competency: Competency
  self: number | null
  byGroup: Partial<Record<Relationship, number>>
  /** Mean of everyone who is not the client. */
  others: number | null
  /** others - self. Positive means the organisation rates them higher than they rate themselves. */
  gap: number | null
}

const mean = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null)
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)

/**
 * Rater groups with fewer than `minGroup` submitted responses are suppressed so
 * a single peer's ratings can never be reverse-engineered. Three is the floor
 * every mainstream 360 instrument uses; at two, either member of a pair can
 * subtract their own score from the mean and read the other's.
 */
export const MIN_GROUP = 3

/** Rounds that have at least one submitted response, newest first. */
export function waveRounds(db: Database, engagementId: string): number[] {
  const rounds = db.assessments
    .filter((a) => a.engagementId === engagementId && a.kind === 'feedback360')
    .filter((a) => db.responses.some((rp) => rp.assessmentId === a.id))
    .map((a) => a.round)
  return [...new Set(rounds)].sort((a, b) => b - a)
}

export function competencyRollup(
  db: Database,
  engagementId: string,
  opts: { minGroup?: number; round?: number } = {},
): CompetencyRollup[] {
  const minGroup = opts.minGroup ?? db.settings?.minGroup ?? MIN_GROUP
  const assessmentIds = db.assessments
    .filter((a) => a.engagementId === engagementId && (opts.round === undefined || a.round === opts.round))
    .map((a) => a.id)
  const responses = db.responses.filter((rp) => assessmentIds.includes(rp.assessmentId))

  return db.competencies.map((competency) => {
    const pick = (rel: Relationship) =>
      responses.filter((rp) => rp.relationship === rel).map((rp) => rp.ratings[competency.id]).filter((n): n is number => typeof n === 'number')

    const selfVals = pick('self')
    const self = round1(mean(selfVals))

    const byGroup: Partial<Record<Relationship, number>> = {}
    for (const rel of RATER_GROUPS) {
      if (rel === 'self') continue
      const vals = pick(rel)
      // The manager rating is attributed by design; everyone else needs the floor.
      if (vals.length >= (rel === 'manager' ? 1 : minGroup)) byGroup[rel] = round1(mean(vals))!
    }

    // Pool only the groups that survived the floor. Including a suppressed group
    // here would let anyone solve for it: they can see n and the shown means.
    const shownGroups = RATER_GROUPS.filter((rel) => rel !== 'self' && byGroup[rel] !== undefined)
    const otherVals = responses
      .filter((rp) => rp.relationship !== 'self' && shownGroups.includes(rp.relationship))
      .map((rp) => rp.ratings[competency.id])
      .filter((n): n is number => typeof n === 'number')
    // One surviving group would make "everyone else" that group, restated.
    const others = shownGroups.length >= 2 ? round1(mean(otherVals)) : null

    return {
      competency, self, byGroup, others,
      gap: self !== null && others !== null ? Math.round((others - self) * 10) / 10 : null,
    }
  })
}

export function suppressedGroups(
  db: Database,
  engagementId: string,
  opts: { minGroup?: number; round?: number } = {},
): Relationship[] {
  const minGroup = opts.minGroup ?? db.settings?.minGroup ?? MIN_GROUP
  const assessmentIds = db.assessments
    .filter((a) => a.engagementId === engagementId && (opts.round === undefined || a.round === opts.round))
    .map((a) => a.id)
  const responses = db.responses.filter((rp) => assessmentIds.includes(rp.assessmentId))
  return RATER_GROUPS.filter((rel) => {
    if (rel === 'self' || rel === 'manager') return false
    const n = responses.filter((rp) => rp.relationship === rel).length
    return n > 0 && n < minGroup
  })
}

/** Competency-level movement between two 360 waves, as the raters scored it. */
export interface WaveMovement {
  competency: Competency
  from: number | null
  to: number | null
  delta: number | null
}

export function waveMovement(
  db: Database,
  engagementId: string,
  fromRound: number,
  toRound: number,
  opts: { minGroup?: number } = {},
): WaveMovement[] {
  const a = competencyRollup(db, engagementId, { ...opts, round: fromRound })
  const b = competencyRollup(db, engagementId, { ...opts, round: toRound })
  return a.map((row, i) => {
    const from = row.others
    const to = b[i]?.others ?? null
    return {
      competency: row.competency,
      from,
      to,
      delta: from !== null && to !== null ? Math.round((to - from) * 10) / 10 : null,
    }
  })
}

/* ------------------------------------------------------ org analytics */

export interface OrgAnalytics {
  engagements: number
  active: number
  avgProgress: number
  avgReinforcement: number
  goalsAchieved: number
  goalsAtRisk: number
  goalsTotal: number
  phaseCounts: Record<string, number>
  competencyMovement: { competency: Competency; baseline: number; latest: number; goals: number }[]
  cliftonDomains: { domain: string; count: number }[]
  reinforcementByManager: { managerId: string; name: string; rate: number; clients: number }[]
  atRisk: { engagement: Engagement; reason: string }[]
}

export function orgAnalytics(db: Database, engagements: Engagement[]): OrgAnalytics {
  const scores = engagements.map((e) => engagementScore(db, e))
  const ids = new Set(engagements.map((e) => e.id))
  const goals = db.goals.filter((g) => ids.has(g.engagementId))
  const allActions = db.actions.filter((a) => ids.has(a.engagementId))

  const byCompetency = new Map<string, { baseline: number[]; latest: number[] }>()
  for (const g of goals) {
    const p = goalProgress(g, db.checkIns)
    const entry = byCompetency.get(g.competencyId) ?? { baseline: [], latest: [] }
    entry.baseline.push(g.baseline)
    entry.latest.push(p.latest)
    byCompetency.set(g.competencyId, entry)
  }

  const competencyMovement = [...byCompetency.entries()]
    .map(([cid, v]) => ({
      competency: db.competencies.find((c) => c.id === cid)!,
      baseline: Math.round((mean(v.baseline) ?? 0) * 10) / 10,
      latest: Math.round((mean(v.latest) ?? 0) * 10) / 10,
      goals: v.baseline.length,
    }))
    .sort((a, b) => b.latest - b.baseline - (a.latest - a.baseline))

  const domainCounts = new Map<string, number>()
  for (const c of db.clifton.filter((c) => ids.has(c.engagementId))) {
    for (const t of c.themes) domainCounts.set(t.domain, (domainCounts.get(t.domain) ?? 0) + 1)
  }

  const managerIds = [...new Set(engagements.map((e) => e.managerId))]
  const reinforcementByManager = managerIds.map((managerId) => {
    const theirs = engagements.filter((e) => e.managerId === managerId)
    const acts = db.actions.filter((a) => theirs.some((e) => e.id === a.engagementId))
    return {
      managerId,
      name: db.users.find((u) => u.id === managerId)?.name ?? 'Unknown',
      rate: Math.round(commitmentStats(acts, 'manager').rate * 100),
      clients: theirs.length,
    }
  })

  const atRisk: OrgAnalytics['atRisk'] = []
  for (const e of engagements) {
    const overdueAssessments = db.assessments.filter((a) => a.engagementId === e.id && a.status !== 'complete' && a.dueOn < todayIso())
    if (overdueAssessments.length) {
      atRisk.push({ engagement: e, reason: `${overdueAssessments.length} assessment${overdueAssessments.length > 1 ? 's' : ''} past due` })
      continue
    }
    const eGoals = goalsFor(db, e.id)
    const stalled = eGoals.filter((g) => g.status === 'at_risk')
    if (stalled.length) {
      atRisk.push({ engagement: e, reason: `${stalled.length} goal${stalled.length > 1 ? 's' : ''} at risk` })
      continue
    }
    const mgr = commitmentStats(db.actions.filter((a) => a.engagementId === e.id), 'manager')
    if (mgr.due >= 4 && mgr.rate < 0.6) {
      atRisk.push({ engagement: e, reason: `Manager reinforcement at ${Math.round(mgr.rate * 100)}%` })
    }
  }

  const phaseCounts: Record<string, number> = {}
  for (const p of PHASES) phaseCounts[p.id] = engagements.filter((e) => e.phase === p.id).length

  return {
    engagements: engagements.length,
    active: engagements.filter((e) => e.status === 'active').length,
    avgProgress: scores.length ? Math.round(scores.reduce((s, x) => s + x.overall, 0) / scores.length) : 0,
    avgReinforcement: Math.round(commitmentStats(allActions, 'manager').rate * 100),
    goalsAchieved: goals.filter((g) => g.status === 'achieved').length,
    goalsAtRisk: goals.filter((g) => g.status === 'at_risk').length,
    goalsTotal: goals.length,
    phaseCounts,
    competencyMovement,
    cliftonDomains: [...domainCounts.entries()].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
    reinforcementByManager,
    atRisk,
  }
}

/* --------------------------------------------------------------- misc */

export const ROLE_LABELS: Record<Role, string> = {
  coach: 'Coach',
  client: 'Client',
  manager: 'Manager',
  hr: 'HR partner',
}

export function userById(db: Database, id: string) {
  return db.users.find((u) => u.id === id)
}

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function formatShort(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000)
}

export function relativeDays(iso: string, today = todayIso()) {
  const d = daysBetween(today, iso)
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  return d > 0 ? `in ${d} days` : `${-d} days ago`
}
