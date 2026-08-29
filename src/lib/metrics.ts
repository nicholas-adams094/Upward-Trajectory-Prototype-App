import type {
  Action, CheckIn, Competency, Database, Engagement, Goal, Relationship, Role,
} from '../types'
import { PHASES } from '../types'

export const todayIso = () => new Date().toISOString().slice(0, 10)

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
}

export function commitmentStats(actions: Action[], owner: Action['owner'], today = todayIso()): CommitmentStats {
  const mine = actions.filter((a) => a.owner === owner)
  const past = mine.filter((a) => a.dueOn <= today)
  const done = past.filter((a) => a.status === 'done').length
  const overdue = past.filter((a) => a.status === 'open').length
  return { due: past.length, done, overdue, rate: past.length ? done / past.length : 0 }
}

export function openActions(db: Database, engagementId: string, owner: Action['owner']) {
  return db.actions
    .filter((a) => a.engagementId === engagementId && a.owner === owner && a.status === 'open')
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1))
}

/* ---------------------------------------------------------- engagement */

export interface EngagementScore {
  /** 0-100 composite used on every dashboard so the number means one thing. */
  overall: number
  assessment: number
  plan: number
  reinforcement: number
  phaseIndex: number
}

export function engagementScore(db: Database, e: Engagement): EngagementScore {
  const assessments = db.assessments.filter((a) => a.engagementId === e.id)
  const assessment = assessments.length
    ? assessments.reduce((s, a) => s + (a.status === 'complete' ? 1 : a.status === 'in_progress' ? 0.5 : 0), 0) / assessments.length
    : 0

  const goals = goalsFor(db, e.id)
  const plan = goals.length
    ? goals.reduce((s, g) => s + goalProgress(g, db.checkIns).pct, 0) / goals.length
    : 0

  const actions = db.actions.filter((a) => a.engagementId === e.id)
  const reinforcement = commitmentStats(actions, 'manager').rate

  const phaseIndex = PHASES.findIndex((p) => p.id === e.phase)
  const phaseWeight = (phaseIndex + 1) / PHASES.length

  // Before the plan exists, progress is about getting the inputs in; after it
  // exists, progress is about behaviour change.
  const overall = goals.length
    ? 0.2 * assessment + 0.5 * plan + 0.15 * reinforcement + 0.15 * phaseWeight
    : 0.6 * assessment + 0.4 * phaseWeight

  return {
    overall: Math.round(overall * 100),
    assessment: Math.round(assessment * 100),
    plan: Math.round(plan * 100),
    reinforcement: Math.round(reinforcement * 100),
    phaseIndex,
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
 * a single peer's ratings can never be reverse-engineered.
 */
export const MIN_GROUP = 2

export function competencyRollup(db: Database, engagementId: string, minGroup = MIN_GROUP): CompetencyRollup[] {
  const assessmentIds = db.assessments.filter((a) => a.engagementId === engagementId).map((a) => a.id)
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

    const otherVals = responses.filter((rp) => rp.relationship !== 'self').map((rp) => rp.ratings[competency.id]).filter((n): n is number => typeof n === 'number')
    const others = round1(mean(otherVals))

    return {
      competency, self, byGroup, others,
      gap: self !== null && others !== null ? Math.round((others - self) * 10) / 10 : null,
    }
  })
}

export function suppressedGroups(db: Database, engagementId: string, minGroup = MIN_GROUP): Relationship[] {
  const assessmentIds = db.assessments.filter((a) => a.engagementId === engagementId).map((a) => a.id)
  const responses = db.responses.filter((rp) => assessmentIds.includes(rp.assessmentId))
  return RATER_GROUPS.filter((rel) => {
    if (rel === 'self' || rel === 'manager') return false
    const n = responses.filter((rp) => rp.relationship === rel).length
    return n > 0 && n < minGroup
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
