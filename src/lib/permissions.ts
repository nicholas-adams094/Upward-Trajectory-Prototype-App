import type { Database, Engagement, Role, SynthesisReport, User } from '../types'

/**
 * One portal, four audiences. Everything the UI shows goes through `can()` so
 * the confidentiality model lives in one readable place rather than being
 * scattered through the components.
 */
export type Resource =
  | 'engagement.summary'
  | 'assessment.status'
  | 'feedback360.raw'
  | 'feedback360.rollup'
  | 'feedback360.verbatims'
  | 'report.evidence'
  | 'checkins.notes'
  | 'clifton'
  | 'enneagram'
  | 'report'
  | 'plan.goals'
  | 'plan.actions'
  | 'checkins'
  | 'session.shared'
  | 'session.private'
  | 'org.analytics'

export const RESOURCE_LABELS: Record<Resource, string> = {
  'engagement.summary': 'Engagement status & phase',
  'assessment.status': 'Assessment completion status',
  'feedback360.raw': '360 responses attributed to the rater',
  'feedback360.rollup': '360 scores rolled up by rater group',
  'feedback360.verbatims': '360 written comments (unattributed)',
  'report.evidence': 'Report evidence quotes',
  'checkins.notes': 'What was written on a check-in',
  clifton: 'CliftonStrengths top 5',
  enneagram: 'Enneagram type & narrative',
  report: 'Synthesis report',
  'plan.goals': 'Coaching plan goals & progress',
  'plan.actions': 'Commitments & reinforcement actions',
  checkins: 'Progress check-ins over time',
  'session.shared': 'Coaching session summaries',
  'session.private': 'Coach private notes',
  'org.analytics': 'Organisation-wide analytics',
}

export interface AccessContext {
  viewer: User
  engagement?: Engagement
  report?: SynthesisReport
}

const sharedWith = (report: SynthesisReport | undefined, role: Role) =>
  !!report && report.status === 'published' && report.sharedWith.includes(role)

export function can(resource: Resource, ctx: AccessContext): boolean {
  const { viewer, engagement, report } = ctx

  // The coach sees everything inside an engagement that is theirs — and nothing
  // at all inside one that is not.
  if (viewer.role === 'coach') return !engagement || engagement.coachId === viewer.id

  if (resource === 'org.analytics') return viewer.role === 'hr'

  if (!engagement) return false

  switch (viewer.role) {
    case 'client': {
      if (engagement.clientId !== viewer.id) return false
      // The client owns their own data — except the coach's private notes and
      // the identities behind their 360 responses.
      return resource !== 'session.private' && resource !== 'feedback360.raw'
    }

    case 'manager': {
      if (engagement.managerId !== viewer.id) return false
      switch (resource) {
        case 'engagement.summary':
        case 'assessment.status':
        case 'plan.goals':
        case 'plan.actions':
        case 'checkins':
        // The manager logs check-ins themselves, so they read what was written.
        case 'checkins.notes':
          return true
        case 'report':
        case 'feedback360.rollup':
        case 'clifton':
          // Released only when the coach publishes and shares the report.
          return sharedWith(report, 'manager')
        // Verbatims, attributed responses, coaching notes and the personality
        // type narrative never travel upward.
        default:
          return false
      }
    }

    case 'hr': {
      if (engagement.hrPartnerId !== viewer.id) return false
      switch (resource) {
        case 'engagement.summary':
        case 'assessment.status':
        case 'plan.goals':
        case 'checkins':
          return true
        case 'report':
          return sharedWith(report, 'hr')
        default:
          return false
      }
    }

    default:
      return false
  }
}

/** Engagements a viewer is allowed to open at all. */
export function visibleEngagements(db: Database, viewer: User): Engagement[] {
  switch (viewer.role) {
    case 'coach':
      return db.engagements.filter((e) => e.coachId === viewer.id)
    case 'client':
      return db.engagements.filter((e) => e.clientId === viewer.id)
    case 'manager':
      return db.engagements.filter((e) => e.managerId === viewer.id)
    case 'hr':
      return db.engagements.filter((e) => e.hrPartnerId === viewer.id)
    default:
      return []
  }
}

export function reportFor(db: Database, engagementId: string): SynthesisReport | undefined {
  return db.reports.find((r) => r.engagementId === engagementId)
}

export const VISIBILITY_MATRIX: { resource: Resource; roles: Record<Role, 'full' | 'shared' | 'none'> }[] = [
  { resource: 'engagement.summary', roles: { coach: 'full', client: 'full', manager: 'full', hr: 'full' } },
  { resource: 'assessment.status', roles: { coach: 'full', client: 'full', manager: 'full', hr: 'full' } },
  { resource: 'feedback360.raw', roles: { coach: 'full', client: 'none', manager: 'none', hr: 'none' } },
  { resource: 'feedback360.rollup', roles: { coach: 'full', client: 'full', manager: 'shared', hr: 'none' } },
  { resource: 'feedback360.verbatims', roles: { coach: 'full', client: 'full', manager: 'none', hr: 'none' } },
  { resource: 'report.evidence', roles: { coach: 'full', client: 'full', manager: 'none', hr: 'none' } },
  { resource: 'checkins.notes', roles: { coach: 'full', client: 'full', manager: 'full', hr: 'none' } },
  { resource: 'clifton', roles: { coach: 'full', client: 'full', manager: 'shared', hr: 'none' } },
  { resource: 'enneagram', roles: { coach: 'full', client: 'full', manager: 'none', hr: 'none' } },
  { resource: 'report', roles: { coach: 'full', client: 'full', manager: 'shared', hr: 'shared' } },
  { resource: 'plan.goals', roles: { coach: 'full', client: 'full', manager: 'full', hr: 'full' } },
  { resource: 'plan.actions', roles: { coach: 'full', client: 'full', manager: 'full', hr: 'none' } },
  { resource: 'checkins', roles: { coach: 'full', client: 'full', manager: 'full', hr: 'full' } },
  { resource: 'session.shared', roles: { coach: 'full', client: 'full', manager: 'none', hr: 'none' } },
  { resource: 'session.private', roles: { coach: 'full', client: 'none', manager: 'none', hr: 'none' } },
  { resource: 'org.analytics', roles: { coach: 'full', client: 'none', manager: 'none', hr: 'full' } },
]
