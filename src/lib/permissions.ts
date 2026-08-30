import type {
  Database, Engagement, PortalSettings, Resource, Role, SynthesisReport, User, VisibilityMatrix,
} from '../types'
import { RESOURCES, ROLES } from '../types'

export type { Resource, VisibilityLevel, VisibilityMatrix } from '../types'

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

/** Grouping for the settings screen. */
export const RESOURCE_GROUPS: { title: string; resources: Resource[] }[] = [
  { title: 'Engagement', resources: ['engagement.summary', 'assessment.status', 'org.analytics'] },
  { title: '360 feedback', resources: ['feedback360.raw', 'feedback360.rollup', 'feedback360.verbatims'] },
  { title: 'Assessments & report', resources: ['clifton', 'enneagram', 'report', 'report.evidence'] },
  { title: 'Plan & progress', resources: ['plan.goals', 'plan.actions', 'checkins', 'checkins.notes'] },
  { title: 'Coaching sessions', resources: ['session.shared', 'session.private'] },
]

export const DEFAULT_VISIBILITY: VisibilityMatrix = {
  'engagement.summary': { coach: 'full', client: 'full', manager: 'full', hr: 'full' },
  'assessment.status': { coach: 'full', client: 'full', manager: 'full', hr: 'full' },
  'feedback360.raw': { coach: 'full', client: 'none', manager: 'none', hr: 'none' },
  'feedback360.rollup': { coach: 'full', client: 'full', manager: 'shared', hr: 'none' },
  'feedback360.verbatims': { coach: 'full', client: 'full', manager: 'none', hr: 'none' },
  'report.evidence': { coach: 'full', client: 'full', manager: 'none', hr: 'none' },
  'checkins.notes': { coach: 'full', client: 'full', manager: 'full', hr: 'none' },
  clifton: { coach: 'full', client: 'full', manager: 'shared', hr: 'none' },
  enneagram: { coach: 'full', client: 'full', manager: 'none', hr: 'none' },
  report: { coach: 'full', client: 'full', manager: 'shared', hr: 'shared' },
  'plan.goals': { coach: 'full', client: 'full', manager: 'full', hr: 'full' },
  'plan.actions': { coach: 'full', client: 'full', manager: 'full', hr: 'none' },
  checkins: { coach: 'full', client: 'full', manager: 'full', hr: 'full' },
  'session.shared': { coach: 'full', client: 'full', manager: 'none', hr: 'none' },
  'session.private': { coach: 'full', client: 'none', manager: 'none', hr: 'none' },
  'org.analytics': { coach: 'full', client: 'none', manager: 'none', hr: 'full' },
}

export const DEFAULT_SETTINGS: PortalSettings = {
  visibility: DEFAULT_VISIBILITY,
  minGroup: 3,
  defaultReportAudience: ['client', 'manager'],
  defaultManagerCadence: 'weekly',
  commitmentLeadDays: 7,
  goalHorizonWeeks: 6,
  requireReinforcementConfirmation: true,
  updatedOn: '',
  updatedBy: '',
}

/**
 * Cells the portal will not let anyone open up. The coach column is the
 * engagement's own record, and a client reading raw 360 responses would
 * identify their own raters — no setting can undo either.
 */
export const LOCKED_CELLS: { resource: Resource; role: Role }[] = [
  ...RESOURCES.map((resource) => ({ resource, role: 'coach' as Role })),
  { resource: 'feedback360.raw', role: 'client' },
  { resource: 'feedback360.raw', role: 'manager' },
  { resource: 'feedback360.raw', role: 'hr' },
]

export const isLocked = (resource: Resource, role: Role) =>
  LOCKED_CELLS.some((c) => c.resource === resource && c.role === role)

/**
 * Choices that are allowed but break the confidentiality Chris sells. The
 * settings screen names them rather than silently preventing them.
 */
export const RISKY_CELLS: { resource: Resource; role: Role; warning: string }[] = [
  { resource: 'session.private', role: 'client', warning: 'Coach private notes would be readable by the client.' },
  { resource: 'session.private', role: 'manager', warning: 'Coach private notes would travel to the manager.' },
  { resource: 'session.private', role: 'hr', warning: 'Coach private notes would travel to HR.' },
  { resource: 'session.shared', role: 'manager', warning: 'Session content would reach the manager — coaching starts to read as a performance review.' },
  { resource: 'session.shared', role: 'hr', warning: 'Session content would reach HR — coaching starts to read as a performance review.' },
  { resource: 'enneagram', role: 'manager', warning: 'A personality type in the hands of a line manager invites labelling.' },
  { resource: 'enneagram', role: 'hr', warning: 'A personality type in an HR record invites labelling.' },
  { resource: 'feedback360.verbatims', role: 'manager', warning: 'Written comments can identify their author even without a name.' },
  { resource: 'feedback360.verbatims', role: 'hr', warning: 'Written comments can identify their author even without a name.' },
  { resource: 'checkins.notes', role: 'hr', warning: 'HR would read what was written on every check-in, not just the movement.' },
]

export interface AccessContext {
  viewer: User
  engagement?: Engagement
  report?: SynthesisReport
}

/**
 * The live matrix. `can()` is called from render, where threading settings
 * through every call site would mean touching every component; the store keeps
 * this in step with the database instead, synchronously, before it notifies.
 */
let activeVisibility: VisibilityMatrix = DEFAULT_VISIBILITY

export function applyVisibility(matrix: VisibilityMatrix | undefined) {
  activeVisibility = normaliseVisibility(matrix)
}

export function getActiveVisibility(): VisibilityMatrix {
  return activeVisibility
}

/** Fill in anything a stored or partial matrix is missing, and re-lock the locked cells. */
export function normaliseVisibility(matrix: VisibilityMatrix | undefined): VisibilityMatrix {
  const next = {} as VisibilityMatrix
  for (const resource of RESOURCES) {
    const row = {} as Record<Role, 'full' | 'shared' | 'none'>
    for (const role of ROLES) {
      const stored = matrix?.[resource]?.[role]
      row[role] = stored === 'full' || stored === 'shared' || stored === 'none'
        ? stored
        : DEFAULT_VISIBILITY[resource][role]
      if (isLocked(resource, role)) row[role] = DEFAULT_VISIBILITY[resource][role]
    }
    next[resource] = row
  }
  return next
}

const isPublishedTo = (report: SynthesisReport | undefined, role: Role) =>
  !!report && report.status === 'published' && report.sharedWith.includes(role)

/** Whether this viewer is a party to this engagement at all. */
function isParty(viewer: User, engagement: Engagement): boolean {
  switch (viewer.role) {
    case 'coach': return engagement.coachId === viewer.id
    case 'client': return engagement.clientId === viewer.id
    case 'manager': return engagement.managerId === viewer.id
    case 'hr': return engagement.hrPartnerId === viewer.id
    default: return false
  }
}

export function can(resource: Resource, ctx: AccessContext): boolean {
  const { viewer, engagement, report } = ctx
  const level = activeVisibility[resource]?.[viewer.role] ?? DEFAULT_VISIBILITY[resource][viewer.role]
  if (level === 'none') return false

  // Org-wide analytics are not scoped to a single engagement.
  if (resource === 'org.analytics') return level === 'full'

  if (!engagement) return viewer.role === 'coach'
  if (!isParty(viewer, engagement)) return false

  return level === 'full' || isPublishedTo(report, viewer.role)
}

/** Engagements a viewer is allowed to open at all. */
export function visibleEngagements(db: Database, viewer: User): Engagement[] {
  return db.engagements.filter((e) => isParty(viewer, e))
}

export function reportFor(db: Database, engagementId: string): SynthesisReport | undefined {
  return db.reports.find((r) => r.engagementId === engagementId)
}
