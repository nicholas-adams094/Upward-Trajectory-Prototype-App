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
  measures: string[]
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
}

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
}
