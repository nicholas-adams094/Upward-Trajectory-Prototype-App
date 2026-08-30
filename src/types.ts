/**
 * Domain model for the Upward Trajectory coaching portal.
 *
 * The shape follows the coaching lifecycle Chris described:
 *   intake -> assessment (360 + self + CliftonStrengths + Enneagram)
 *   -> synthesis report -> coaching plan -> weekly coaching + manager
 *   reinforcement -> tracked progress visible to client, manager and HR.
 */

export type Role = 'coach' | 'client' | 'manager' | 'hr'

export interface Org {
  id: string
  name: string
  industry: string
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  orgId: string
  title: string
  department?: string
  /** Day-to-day manager. Drives the manager dashboard roster. */
  managerId?: string
  accent: string
}

/** Where an engagement sits in the coaching lifecycle. */
export type Phase = 'intake' | 'assessment' | 'synthesis' | 'coaching' | 'sustain'

export const PHASES: { id: Phase; label: string; blurb: string }[] = [
  { id: 'intake', label: 'Intake', blurb: 'Contracting, goals of the sponsor, stakeholder map' },
  { id: 'assessment', label: 'Assessment', blurb: '360 feedback, self-evaluation, CliftonStrengths, Enneagram' },
  { id: 'synthesis', label: 'Synthesis', blurb: 'Coach synthesises all inputs into one report' },
  { id: 'coaching', label: 'Coaching', blurb: 'Weekly coaching plus manager reinforcement' },
  { id: 'sustain', label: 'Sustain', blurb: 'Re-measure, hand off to the manager, close out' },
]

export interface Engagement {
  id: string
  clientId: string
  coachId: string
  managerId: string
  hrPartnerId: string
  orgId: string
  startedOn: string
  targetEndOn: string
  phase: Phase
  status: 'active' | 'paused' | 'complete'
  sponsorGoal: string
  closedOn?: string
}

export type AssessmentKind = 'self' | 'feedback360' | 'clifton' | 'enneagram'
export type AssessmentStatus = 'not_started' | 'in_progress' | 'complete'

export const ASSESSMENT_LABELS: Record<AssessmentKind, string> = {
  self: 'Self-evaluation',
  feedback360: '360° feedback',
  clifton: 'CliftonStrengths',
  enneagram: 'Enneagram',
}

export interface Assessment {
  id: string
  engagementId: string
  kind: AssessmentKind
  status: AssessmentStatus
  assignedOn: string
  dueOn: string
  completedOn?: string
  /** Which measurement wave this belongs to. 1 is the baseline. */
  round: number
}

/** A round of measurement. Wave 1 is the baseline; later waves are re-measures. */
export interface FeedbackWave {
  round: number
  label: string
  openedOn: string
  closedOn?: string
}

export type Relationship = 'self' | 'manager' | 'peer' | 'direct_report' | 'stakeholder'

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  self: 'Self',
  manager: 'Manager',
  peer: 'Peer',
  direct_report: 'Direct report',
  stakeholder: 'Stakeholder',
}

export interface Respondent {
  id: string
  assessmentId: string
  name: string
  email: string
  relationship: Relationship
  status: 'invited' | 'submitted' | 'declined'
  invitedOn: string
  submittedOn?: string
}

export interface Competency {
  id: string
  name: string
  description: string
}

/** competencyId -> 1..5 */
export type Ratings = Record<string, number>

export interface FeedbackResponse {
  id: string
  assessmentId: string
  respondentId: string
  relationship: Relationship
  submittedOn: string
  ratings: Ratings
  keepDoing: string
  doMoreOf: string
}

export type CliftonDomain = 'Executing' | 'Influencing' | 'Relationship Building' | 'Strategic Thinking'

export interface CliftonTheme {
  rank: number
  theme: string
  domain: CliftonDomain
}

export interface CliftonResult {
  id: string
  engagementId: string
  recordedOn: string
  themes: CliftonTheme[]
}

export interface EnneagramResult {
  id: string
  engagementId: string
  recordedOn: string
  type: number
  typeName: string
  wing: string
  coreMotivation: string
  underStress: string
  inGrowth: string
  blindSpot: string
}

export interface ReportTheme {
  title: string
  narrative: string
  evidence: string[]
}

/** The exact content that was released, frozen at publish time. */
export interface PublishedReport {
  version: number
  publishedOn: string
  headline: string
  signatureStrengths: string[]
  doMoreOf: string[]
  watchOuts: string[]
  themes: ReportTheme[]
}

export interface SynthesisReport {
  id: string
  engagementId: string
  status: 'draft' | 'published'
  version: number
  updatedOn: string
  publishedOn?: string
  headline: string
  signatureStrengths: string[]
  doMoreOf: string[]
  watchOuts: string[]
  themes: ReportTheme[]
  /** Who the coach has released this version to, beyond the client. */
  sharedWith: Role[]
  /**
   * What everyone other than the coach reads. The fields above are the coach's
   * working copy; edits to them do not reach the audience until re-published.
   */
  published?: PublishedReport
}

export type GoalStatus = 'not_started' | 'on_track' | 'at_risk' | 'achieved'

export interface Goal {
  id: string
  engagementId: string
  title: string
  description: string
  competencyId: string
  createdOn: string
  targetDate: string
  status: GoalStatus
  /** 1-5 behavioural anchors: where they started and where we want them. */
  baseline: number
  target: number
  measures: Measure[]
}

/** A behavioural measure, ticked off when it has actually been observed. */
export interface Measure {
  id: string
  text: string
  metOn?: string
  metBy?: string
}

export type ActionOwner = 'client' | 'manager' | 'coach'
export type Cadence = 'once' | 'weekly' | 'biweekly' | 'monthly'

export interface Action {
  id: string
  goalId: string
  engagementId: string
  owner: ActionOwner
  title: string
  detail: string
  cadence: Cadence
  dueOn: string
  status: 'open' | 'done' | 'skipped'
  completedOn?: string
  /** Shared by every occurrence of a repeating commitment. */
  seriesId: string
  /** 1-based position within the series. */
  occurrence: number
  /** Set when the person on the receiving end confirms it actually happened. */
  confirmedBy?: string
  confirmedOn?: string
  /** Set when the recipient says it did not happen as recorded. */
  disputedOn?: string
}

export const CADENCE_DAYS: Record<Cadence, number> = { once: 0, weekly: 7, biweekly: 14, monthly: 28 }

/** A dated observation of a goal, from whoever is closest to the behaviour. */
export interface CheckIn {
  id: string
  goalId: string
  engagementId: string
  byUserId: string
  byRole: Role
  date: string
  rating: number
  note: string
}

export interface CoachingSession {
  id: string
  engagementId: string
  date: string
  durationMin: number
  topic: string
  sharedNotes: string
  /** Coach-only. Never leaves the coach's view. */
  privateNotes: string
  status: 'scheduled' | 'held' | 'missed'
}

export interface ActivityEvent {
  id: string
  engagementId: string
  at: string
  actorId: string
  summary: string
  kind: 'assessment' | 'report' | 'plan' | 'session' | 'checkin' | 'action' | 'system'
}

/* ------------------------------------------------------------- handover */

/** What the manager keeps running once the coach steps out. */
export interface Handover {
  id: string
  engagementId: string
  closedOn: string
  /** Goals the manager continues to own after close. */
  carriedGoalIds: string[]
  summary: string
  managerOwns: string
  reviewOn: string
  acknowledgedByManagerOn?: string
  acknowledgedByClientOn?: string
}

/* ------------------------------------------------------------- settings */

/** Every distinct thing the portal can show. Access is decided per role. */
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

export const RESOURCES: Resource[] = [
  'engagement.summary', 'assessment.status', 'feedback360.raw', 'feedback360.rollup',
  'feedback360.verbatims', 'report.evidence', 'checkins.notes', 'clifton', 'enneagram',
  'report', 'plan.goals', 'plan.actions', 'checkins', 'session.shared', 'session.private',
  'org.analytics',
]

export const ROLES: Role[] = ['coach', 'client', 'manager', 'hr']

/**
 * `full` — always visible.
 * `shared` — visible only once the coach publishes the report to that role.
 * `none` — never visible.
 */
export type VisibilityLevel = 'full' | 'shared' | 'none'

export type VisibilityMatrix = Record<Resource, Record<Role, VisibilityLevel>>

export interface PortalSettings {
  visibility: VisibilityMatrix
  /** Responses a rater group needs before its scores are shown. */
  minGroup: number
  /** Roles a newly published report is released to by default. */
  defaultReportAudience: Role[]
  /** Cadence pre-selected on a new manager commitment. */
  defaultManagerCadence: Cadence
  /** How many days out a new commitment is due. */
  commitmentLeadDays: number
  /** Weeks between a goal being set and its target date. */
  goalHorizonWeeks: number
  /** Ask the client to confirm reinforcement their manager records. */
  requireReinforcementConfirmation: boolean
  updatedOn: string
  updatedBy: string
}

export interface Database {
  orgs: Org[]
  users: User[]
  competencies: Competency[]
  engagements: Engagement[]
  assessments: Assessment[]
  respondents: Respondent[]
  responses: FeedbackResponse[]
  clifton: CliftonResult[]
  enneagram: EnneagramResult[]
  reports: SynthesisReport[]
  goals: Goal[]
  actions: Action[]
  checkIns: CheckIn[]
  sessions: CoachingSession[]
  activity: ActivityEvent[]
  waves: FeedbackWave[]
  handovers: Handover[]
  settings: PortalSettings
}
