import type {
  Action, ActivityEvent, Assessment, AssessmentKind, CheckIn, CliftonTheme, CoachingSession,
  Competency, Database, EnneagramResult, Engagement, FeedbackResponse, Goal, Org, Ratings,
  Relationship, Respondent, SynthesisReport, User,
} from '../types'

/* ------------------------------------------------------------------ dates */

/**
 * Every seeded date is relative to the day the demo is opened, so a link shared
 * today still reads correctly in a month: sessions stay upcoming, commitments
 * stay due, and nothing silently rots into "overdue by six weeks".
 *
 * Ratings and text remain deterministic — only the calendar moves.
 */
export const TODAY = (() => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
})()

const DAY = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
export const daysAgo = (n: number) => iso(new Date(TODAY.getTime() - n * DAY))
export const daysAhead = (n: number) => iso(new Date(TODAY.getTime() + n * DAY))

/* -------------------------------------------------------- deterministic rng */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const clamp = (n: number, lo = 1, hi = 5) => Math.min(hi, Math.max(lo, n))
const round1 = (n: number) => Math.round(n * 10) / 10

/* ------------------------------------------------------------ competencies */

export const COMPETENCIES: Competency[] = [
  { id: 'c-strategic', name: 'Strategic thinking', description: 'Sees round corners; connects the day-to-day to where the business is going.' },
  { id: 'c-influence', name: 'Influence & presence', description: 'Lands a point of view with senior stakeholders without needing authority.' },
  { id: 'c-delegation', name: 'Delegation', description: 'Gives real ownership away and holds people to the outcome, not the method.' },
  { id: 'c-feedback', name: 'Direct feedback', description: 'Says the hard thing early, kindly, and in a way that changes behaviour.' },
  { id: 'c-decisiveness', name: 'Decisiveness', description: 'Makes the call with 70% of the information and communicates the why.' },
  { id: 'c-collab', name: 'Cross-functional collaboration', description: 'Builds coalitions across functions rather than escalating.' },
  { id: 'c-develop', name: 'Developing others', description: 'Coaches, stretches and grows the bench beneath them.' },
  { id: 'c-resilience', name: 'Resilience under pressure', description: 'Stays regulated and clear-headed when the week goes sideways.' },
]

const CIDS = COMPETENCIES.map((c) => c.id)

/* -------------------------------------------------------------------- orgs */

export const ORGS: Org[] = [
  { id: 'org-upward', name: 'Upward Trajectory', industry: 'Career coaching & consulting' },
  { id: 'org-northwind', name: 'Northwind Health', industry: 'Healthcare' },
  { id: 'org-kestrel', name: 'Kestrel Logistics', industry: 'Transport & logistics' },
]

/* ------------------------------------------------------------------- users */

export const USERS: User[] = [
  { id: 'u-chris', name: 'Chris Woods', email: 'chris@upwardtrajectory.com', role: 'coach', orgId: 'org-upward', title: 'Owner & Executive Coach', accent: '#5b53d3' },

  // Northwind Health
  { id: 'u-dana', name: 'Dana Whitfield', email: 'dana.whitfield@northwind.health', role: 'manager', orgId: 'org-northwind', title: 'VP, Clinical Operations', department: 'Operations', accent: '#0f766e' },
  { id: 'u-priya', name: 'Priya Raman', email: 'priya.raman@northwind.health', role: 'hr', orgId: 'org-northwind', title: 'Director, Talent Development', department: 'People', accent: '#b45309' },
  { id: 'u-marcus', name: 'Marcus Bell', email: 'marcus.bell@northwind.health', role: 'client', orgId: 'org-northwind', title: 'Senior Director, Patient Access', department: 'Operations', managerId: 'u-dana', accent: '#2563eb' },
  { id: 'u-lena', name: 'Lena Ortiz', email: 'lena.ortiz@northwind.health', role: 'client', orgId: 'org-northwind', title: 'Director, Revenue Cycle', department: 'Finance Ops', managerId: 'u-dana', accent: '#be185d' },
  { id: 'u-tobi', name: 'Tobi Adeyemi', email: 'tobi.adeyemi@northwind.health', role: 'client', orgId: 'org-northwind', title: 'Manager, Care Coordination', department: 'Operations', managerId: 'u-dana', accent: '#7c3aed' },

  // Kestrel Logistics
  { id: 'u-raj', name: 'Raj Patel', email: 'raj.patel@kestrel.co', role: 'manager', orgId: 'org-kestrel', title: 'VP, Network Operations', department: 'Operations', accent: '#0369a1' },
  { id: 'u-simone', name: 'Simone Clarke', email: 'simone.clarke@kestrel.co', role: 'hr', orgId: 'org-kestrel', title: 'Head of People', department: 'People', accent: '#a16207' },
  { id: 'u-nadia', name: 'Nadia Kovacs', email: 'nadia.kovacs@kestrel.co', role: 'client', orgId: 'org-kestrel', title: 'Director, Regional Operations', department: 'Operations', managerId: 'u-raj', accent: '#c2410c' },
  { id: 'u-glen', name: 'Glen Harper', email: 'glen.harper@kestrel.co', role: 'client', orgId: 'org-kestrel', title: 'Senior Manager, Fleet', department: 'Operations', managerId: 'u-raj', accent: '#15803d' },
  { id: 'u-amara', name: 'Amara Osei', email: 'amara.osei@kestrel.co', role: 'client', orgId: 'org-kestrel', title: 'Director, Customer Solutions', department: 'Commercial', managerId: 'u-raj', accent: '#9333ea' },
]

/* ---------------------------------------------------------- engagement spec */

interface RaterSpec {
  name: string
  email: string
  relationship: Relationship
  submitted: boolean
  keep: string
  more: string
}

interface GoalSpec {
  id: string
  title: string
  description: string
  competencyId: string
  baseline: number
  target: number
  latest: number
  weeks: number
  measures: string[]
  clientActions: { title: string; detail: string; cadence: Action['cadence']; doneRatio: number }[]
  managerActions: { title: string; detail: string; cadence: Action['cadence']; doneRatio: number }[]
}

interface EngagementSpec {
  engagement: Engagement
  assessments: Record<AssessmentKind, { status: Assessment['status']; dueIn: number; completedDaysAgo?: number }>
  raters: RaterSpec[]
  selfRatings: Ratings
  selfKeep: string
  selfMore: string
  raterMeans: Ratings
  clifton?: CliftonTheme[]
  enneagram?: Omit<EnneagramResult, 'id' | 'engagementId' | 'recordedOn'>
  report?: Omit<SynthesisReport, 'id' | 'engagementId' | 'updatedOn' | 'publishedOn' | 'version'> & { publishedDaysAgo?: number }
  goals: GoalSpec[]
  sessions: { weeksAgo: number; topic: string; sharedNotes: string; privateNotes: string; status: CoachingSession['status'] }[]
  nextSessionInDays?: number
}

const r = (pairs: [string, number][]): Ratings => Object.fromEntries(pairs)

const SPECS: EngagementSpec[] = [
  /* ------------------------------------------------ Marcus Bell — coaching */
  {
    engagement: {
      id: 'e-marcus', clientId: 'u-marcus', coachId: 'u-chris', managerId: 'u-dana', hrPartnerId: 'u-priya',
      orgId: 'org-northwind', startedOn: daysAgo(126), targetEndOn: daysAhead(56), phase: 'coaching', status: 'active',
      sponsorGoal: 'Ready to run a two-region P&L within 12 months. Needs to lead through his directors instead of doing the work himself.',
    },
    assessments: {
      self: { status: 'complete', dueIn: -110, completedDaysAgo: 112 },
      feedback360: { status: 'complete', dueIn: -100, completedDaysAgo: 103 },
      clifton: { status: 'complete', dueIn: -108, completedDaysAgo: 115 },
      enneagram: { status: 'complete', dueIn: -108, completedDaysAgo: 114 },
    },
    raters: [
      { name: 'Dana Whitfield', email: 'dana.whitfield@northwind.health', relationship: 'manager', submitted: true,
        keep: 'He never misses. If Marcus has it, it is handled.',
        more: 'Marcus is the best individual contributor on my team. That is the problem — lead through the three of them.' },
      { name: 'Ines Duarte', email: 'ines.duarte@northwind.health', relationship: 'peer', submitted: true,
        keep: 'He frames the operational problem better than anyone in the building.',
        more: 'He will tell me the truth about a process and not about a person.' },
      { name: 'Ben Okafor', email: 'ben.okafor@northwind.health', relationship: 'peer', submitted: true,
        keep: 'Calm in a room that is not.',
        more: 'Bring the recommendation into the meeting, not the corridor afterwards.' },
      { name: 'Claire Nyman', email: 'claire.nyman@northwind.health', relationship: 'peer', submitted: true,
        keep: 'The one person I can hand a genuinely ugly problem to.',
        more: 'Let his directors own something visible. We only ever see Marcus.' },
      { name: 'Sam Rios', email: 'sam.rios@northwind.health', relationship: 'direct_report', submitted: true,
        keep: 'He backs us publicly, every single time.',
        more: 'I find out a deliverable moved because it is already done. Leave it with me.' },
      { name: 'Yuki Tanaka', email: 'yuki.tanaka@northwind.health', relationship: 'direct_report', submitted: true,
        keep: 'He is straight with me about where the business actually is.',
        more: 'The performance conversation happened three months after the performance.' },
      { name: 'Peter Ilnicki', email: 'peter.ilnicki@northwind.health', relationship: 'direct_report', submitted: true,
        keep: 'Turns up prepared. Always. It sets the standard for the rest of us.',
        more: 'Let us fail small. Right now nothing is allowed to fail at all.' },
      { name: 'Rosa Almeida', email: 'rosa.almeida@northwind.health', relationship: 'stakeholder', submitted: true,
        keep: 'When Marcus talks, the room settles.',
        more: 'Say the difficult thing while it still matters.' },
      { name: 'Hugh Bannerman', email: 'hugh.bannerman@northwind.health', relationship: 'stakeholder', submitted: true,
        keep: 'The only operations leader who answers the question I actually asked.',
        more: 'He under-sells himself in front of the exec team. Own the recommendation.' },
      { name: 'Denise Kwan', email: 'denise.kwan@northwind.health', relationship: 'stakeholder', submitted: true,
        keep: 'Good to work with. Responsive, no surprises.',
        more: 'Honestly nothing major from where I sit — maybe more visibility on what his team is doing.' },
    ],
    selfRatings: r([['c-strategic', 3], ['c-influence', 2], ['c-delegation', 4], ['c-feedback', 2], ['c-decisiveness', 4], ['c-collab', 4], ['c-develop', 3], ['c-resilience', 3]]),
    selfKeep: 'I deliver. Whatever the quarter throws at us, the numbers land.',
    selfMore: 'Step back sooner. I know what I should do; under pressure I take it back.',
    raterMeans: r([['c-strategic', 4.1], ['c-influence', 4.3], ['c-delegation', 2.3], ['c-feedback', 2.4], ['c-decisiveness', 4.2], ['c-collab', 3.6], ['c-develop', 2.8], ['c-resilience', 3.9]]),
    clifton: [
      { rank: 1, theme: 'Achiever', domain: 'Executing' },
      { rank: 2, theme: 'Strategic', domain: 'Strategic Thinking' },
      { rank: 3, theme: 'Command', domain: 'Influencing' },
      { rank: 4, theme: 'Responsibility', domain: 'Executing' },
      { rank: 5, theme: 'Relator', domain: 'Relationship Building' },
    ],
    enneagram: {
      type: 3, typeName: 'The Achiever', wing: '3w2',
      coreMotivation: 'To be valuable and worthwhile through visible accomplishment.',
      underStress: 'Moves to Type 9 — disengages, goes quiet, absorbs work rather than confronting it.',
      inGrowth: 'Moves to Type 6 — becomes loyal, transparent about risk and team-first.',
      blindSpot: 'Mistakes personal output for leadership. Taking work back feels like service; the team reads it as distrust.',
    },
    report: {
      status: 'published',
      headline: 'A high-output operator whose next level depends on subtraction, not addition.',
      signatureStrengths: [
        'Executive presence — rated 4.2 by his raters against a self-rating of 2. The largest gap in the set, and it runs in his favour.',
        'Decisiveness under ambiguity — 4.1 across the panel, and his direct reports put him at 4.0.',
        'Pattern recognition (Strategic #2) applied to operational bottlenecks nobody else has framed yet.',
      ],
      doMoreOf: [
        'Hand whole outcomes — not tasks — to his three directors and let the first version be theirs.',
        'Say the hard thing inside 48 hours. Direct feedback is his lowest score at 2.2, and his direct reports put it at 1.9.',
        'Narrate his thinking out loud in leadership forums so the team can learn the pattern, not just the answer.',
      ],
      watchOuts: [
        'Under load he goes quiet and absorbs the work rather than confronting it. The team experiences it as being cut out.',
        'Achiever + Responsibility makes rescuing feel virtuous. It is the behaviour capping his span.',
      ],
      themes: [
        {
          title: 'The delegation ceiling',
          narrative: 'Delegation is the one competency Marcus rates himself well above the room — 3.5 against 2.3, the largest over-rating in the set. Direct reports put it lowest of all, which tells us the cost lands on the people closest to him.',
          evidence: [
            'Direct report: "I find out a deliverable moved because it is already done."',
            'Manager: "Marcus is the best individual contributor on my team. That is the problem."',
            'Self-evaluation rated delegation 4 — well above how the team experiences it.',
          ],
        },
        {
          title: 'Feedback arrives late and pre-softened',
          narrative: 'Direct feedback rates 2.2, and 1.9 from his direct reports. This is not an avoidance of conflict — Command sits at #3 — it is a 3-ish reluctance to be experienced as unlikeable by people he rates.',
          evidence: [
            'Peer: "He will tell me the truth about a process and not about a person."',
            'Direct report: "The performance conversation happened three months after the performance."',
          ],
        },
        {
          title: 'Presence is already there',
          narrative: 'The gap between how Marcus sees his influence and how the organisation sees it is the most actionable finding in the report. He is holding back a capability he already has.',
          evidence: ['Stakeholder: "When Marcus talks, the room settles." Self-rating: 2.'],
        },
      ],
      sharedWith: ['client', 'manager', 'hr'],
      publishedDaysAgo: 92,
    },
    goals: [
      {
        id: 'g-m1', title: 'Give away three whole outcomes', competencyId: 'c-delegation',
        description: 'Transfer end-to-end ownership of three named outcomes to his directors — including the exec-forum readout — and stay out of the delivery.',
        baseline: 2.3, target: 4.0, latest: 3.6, weeks: 13,
        measures: ['Each director owns a named outcome in writing', 'Marcus does not present their work at the ops review', 'Directors report ownership at 4+ in the pulse check'],
        clientActions: [
          { title: 'Name the outcome owner in the weekly ops doc', detail: 'Before the Monday review, write the owner next to each outcome. If it is you, ask why.', cadence: 'weekly', doneRatio: 0.85 },
          { title: 'Run a "what would you do" pause', detail: 'When a director brings a problem, ask for their recommendation before offering yours.', cadence: 'weekly', doneRatio: 0.77 },
        ],
        managerActions: [
          { title: 'Ask who owns it, not how it is going', detail: 'In your 1:1 with Marcus, open with "who owned that?" rather than "what is the status?"', cadence: 'weekly', doneRatio: 0.85 },
          { title: 'Invite a director to the ops review in his place', detail: 'Once a month, ask Marcus to send a director to present. Reinforces the transfer publicly.', cadence: 'monthly', doneRatio: 0.75 },
        ],
      },
      {
        id: 'g-m2', title: 'The 48-hour feedback rule', competencyId: 'c-feedback',
        description: 'Deliver performance feedback within 48 hours of the observed behaviour, unsoftened, using the situation-behaviour-impact frame.',
        baseline: 2.2, target: 4.0, latest: 3.4, weeks: 13,
        measures: ['Zero feedback items older than a week in the coaching log', 'Direct reports rate clarity of feedback at 4+', 'No surprises in the mid-year reviews'],
        clientActions: [
          { title: 'Log every deferred conversation', detail: 'If you notice something and do not say it, write it down with the date. Bring the list to coaching.', cadence: 'weekly', doneRatio: 0.92 },
          { title: 'One SBI conversation per week', detail: 'Situation, behaviour, impact. Practise on something small before you need it on something large.', cadence: 'weekly', doneRatio: 0.69 },
        ],
        managerActions: [
          { title: 'Model it back', detail: 'Give Marcus one piece of same-week feedback yourself. He calibrates off you.', cadence: 'weekly', doneRatio: 0.69 },
        ],
      },
      {
        id: 'g-m3', title: 'Claim the room', competencyId: 'c-influence',
        description: 'Take the point of view he already holds into senior forums without pre-qualifying it.',
        baseline: 3.4, target: 4.5, latest: 4.2, weeks: 13,
        measures: ['Opens with the recommendation, not the background', 'Two exec-forum agenda items owned per quarter'],
        clientActions: [
          { title: 'Lead with the recommendation', detail: 'First sentence is what you think should happen. Context second.', cadence: 'weekly', doneRatio: 0.92 },
        ],
        managerActions: [
          { title: 'Give him the agenda item', detail: 'Hand Marcus a standing slot in the VP forum rather than a slot in your section.', cadence: 'monthly', doneRatio: 1 },
        ],
      },
    ],
    sessions: [
      { weeksAgo: 12, topic: 'Report debrief — the delegation ceiling', sharedNotes: 'Walked the 360 data. Marcus recognised the direct-report gap immediately. Agreed the three outcomes to transfer.', privateNotes: 'Defensive for the first 20 minutes, then genuinely moved by the "best IC on my team" quote. Do not over-index on the presence finding yet — he will use it to avoid the delegation work.', status: 'held' },
      { weeksAgo: 9, topic: 'Transferring the first outcome', sharedNotes: 'Sam now owns the access-throughput programme end to end. Marcus wrote the ownership note.', privateNotes: 'He rewrote Sam\'s deck the night before. Named it; he saw it. Watch for a repeat.', status: 'held' },
      { weeksAgo: 6, topic: 'Feedback that arrives on time', sharedNotes: 'Practised three SBI conversations. Two delivered inside the week.', privateNotes: 'The Yuki conversation is the real one and he keeps deferring it. Push next session.', status: 'held' },
      { weeksAgo: 3, topic: 'The Yuki conversation', sharedNotes: 'Delivered. Went better than expected. Yuki asked for more of it.', privateNotes: 'Big unlock. Confidence is now the lever, not skill.', status: 'held' },
      { weeksAgo: 1, topic: 'Mid-point re-measure', sharedNotes: 'Pulse check back from the team: delegation up from 2.3 to 3.6, feedback 2.4 to 3.4. Reviewed what holds.', privateNotes: 'Ready to talk about the two-region role with Dana. Suggest Dana raises it, not him.', status: 'held' },
    ],
    nextSessionInDays: 4,
  },

  /* -------------------------------------------------- Lena Ortiz — synthesis */
  {
    engagement: {
      id: 'e-lena', clientId: 'u-lena', coachId: 'u-chris', managerId: 'u-dana', hrPartnerId: 'u-priya',
      orgId: 'org-northwind', startedOn: daysAgo(48), targetEndOn: daysAhead(134), phase: 'synthesis', status: 'active',
      sponsorGoal: 'Technically outstanding, organisationally isolated. Needs to build coalitions instead of escalating.',
    },
    assessments: {
      self: { status: 'complete', dueIn: -30, completedDaysAgo: 32 },
      feedback360: { status: 'complete', dueIn: -21, completedDaysAgo: 19 },
      clifton: { status: 'complete', dueIn: -30, completedDaysAgo: 34 },
      enneagram: { status: 'complete', dueIn: -30, completedDaysAgo: 33 },
    },
    raters: [
      { name: 'Dana Whitfield', email: 'dana.whitfield@northwind.health', relationship: 'manager', submitted: true,
        keep: 'The analysis is never wrong. Not once in three years.',
        more: 'Bring me the problem after you have talked to the person, not before.' },
      { name: 'Marcus Bell', email: 'marcus.bell@northwind.health', relationship: 'peer', submitted: true,
        keep: "She raises the standard of everyone's thinking.",
        more: 'I would rather Lena tell me I am wrong than tell Dana I am wrong.' },
      { name: 'Hana Levy', email: 'hana.levy@northwind.health', relationship: 'peer', submitted: true,
        keep: 'Rigorous, prepared, unflappable under scrutiny.',
        more: 'Socialise the recommendation before the forum and it would pass first time.' },
      { name: 'Owen Pryce', email: 'owen.pryce@northwind.health', relationship: 'direct_report', submitted: true,
        keep: 'She teaches me something in every single review.',
        more: 'Tell me what you need from me, not only what is wrong.' },
      { name: 'Fatima Nasser', email: 'fatima.nasser@northwind.health', relationship: 'direct_report', submitted: true,
        keep: 'The standard is clear and it never moves.',
        more: 'Some flexibility on the route, as long as the outcome holds.' },
      { name: 'Greg Salinas', email: 'greg.salinas@northwind.health', relationship: 'stakeholder', submitted: true,
        keep: 'The numbers are always right and always on time.',
        more: 'The analysis is always right. I still dread the meeting.' },
      { name: 'Ravi Menon', email: 'ravi.menon@northwind.health', relationship: 'peer', submitted: true,
        keep: 'She does the reading. You never have to check her numbers.',
        more: 'Bring me in before the decision rather than after it. I keep finding out late.' },
      { name: 'Aoife Brennan', email: 'aoife.brennan@northwind.health', relationship: 'direct_report', submitted: true,
        keep: 'Clear expectations, always.',
        more: 'It would help to hear when something went well, not only when it did not.' },
      { name: 'Tomas Vidal', email: 'tomas.vidal@northwind.health', relationship: 'stakeholder', submitted: true,
        keep: 'Reliable. The month-end close has not slipped once.',
        more: 'Less email, more conversation.' },
      { name: 'Priya Raman', email: 'priya.raman@northwind.health', relationship: 'stakeholder', submitted: true,
        keep: 'One of the sharpest analytical minds in the finance function.',
        more: 'She needs to build allies before she needs them, not during.' },
    ],
    selfRatings: r([['c-strategic', 4], ['c-influence', 3], ['c-delegation', 4], ['c-feedback', 5], ['c-decisiveness', 5], ['c-collab', 3], ['c-develop', 4], ['c-resilience', 4]]),
    selfKeep: 'I am rigorous and I do not let things through that are not right.',
    selfMore: 'Probably bring people with me earlier. I tend to arrive with the answer already worked out.',
    raterMeans: r([['c-strategic', 4.4], ['c-influence', 3.1], ['c-delegation', 3.4], ['c-feedback', 4.2], ['c-decisiveness', 4.4], ['c-collab', 2.2], ['c-develop', 3.2], ['c-resilience', 3.3]]),
    clifton: [
      { rank: 1, theme: 'Analytical', domain: 'Strategic Thinking' },
      { rank: 2, theme: 'Deliberative', domain: 'Executing' },
      { rank: 3, theme: 'Focus', domain: 'Executing' },
      { rank: 4, theme: 'Learner', domain: 'Strategic Thinking' },
      { rank: 5, theme: 'Discipline', domain: 'Executing' },
    ],
    enneagram: {
      type: 1, typeName: 'The Reformer', wing: '1w9',
      coreMotivation: 'To be right, good, and beyond reproach.',
      underStress: 'Moves to Type 4 — withdraws, becomes resentful that standards are not shared.',
      inGrowth: 'Moves to Type 7 — playful, open to other routes to the same outcome.',
      blindSpot: 'Being right is treated as sufficient. The work of bringing people along reads as politics.',
    },
    report: {
      status: 'draft',
      headline: 'The analysis is never the problem. The coalition is.',
      signatureStrengths: [
        'Analytical rigour — 4.3 on strategic thinking, the highest in the cohort.',
        'Says the hard thing without flinching — direct feedback at 4.0, and she is the only leader in the cohort above 3.5 on it.',
      ],
      doMoreOf: [
        'Socialise a recommendation with two peers before it reaches the forum.',
        'Separate "this is wrong" from "here is what I need from you".',
      ],
      watchOuts: [
        'Cross-functional collaboration sits at 2.3 — nearly a full point below her next-lowest score, and the only rating in the set below 3.',
        'Escalation is her default conflict route. It works, and it is spending goodwill she will need.',
      ],
      themes: [
        {
          title: 'Escalation as a first resort',
          narrative: 'Her peers and her stakeholder describe the same pattern: a disagreement becomes a message to Dana within a day. Lena reads this as efficiency. They read it as being reported on.',
          evidence: [
            'Peer: "I would rather Lena tell me I am wrong than tell Dana I am wrong."',
            'Stakeholder: "The analysis is always right. I still dread the meeting."',
          ],
        },
        {
          title: 'The 1w9 standards trap',
          narrative: 'Deliberative and Discipline in the top five, with an Enneagram 1 core, produces a leader who has already decided what "good" looks like before the conversation starts.',
          evidence: ['Self-rating on collaboration (3) is her joint-lowest self-score — she already knows.'],
        },
      ],
      sharedWith: ['client'],
    },
    goals: [],
    sessions: [
      { weeksAgo: 6, topic: 'Contracting and stakeholder map', sharedNotes: 'Agreed the rater list and the sponsor goal with Dana in the room.', privateNotes: 'Lena chose her raters carefully — three of the six are people who agree with her. Added Greg deliberately.', status: 'held' },
      { weeksAgo: 2, topic: 'Assessment close-out', sharedNotes: 'All six raters in. Clifton and Enneagram complete. Report drafting now.', privateNotes: 'The 2.2 collaboration number is going to land hard. Plan the debrief carefully — lead with the 4.4.', status: 'held' },
    ],
    nextSessionInDays: 6,
  },

  /* ------------------------------------------------ Tobi Adeyemi — assessment */
  {
    engagement: {
      id: 'e-tobi', clientId: 'u-tobi', coachId: 'u-chris', managerId: 'u-dana', hrPartnerId: 'u-priya',
      orgId: 'org-northwind', startedOn: daysAgo(24), targetEndOn: daysAhead(158), phase: 'assessment', status: 'active',
      sponsorGoal: 'First-time people leader. Promote-from-within who is still doing the job they were promoted out of.',
    },
    assessments: {
      self: { status: 'complete', dueIn: -6, completedDaysAgo: 8 },
      feedback360: { status: 'in_progress', dueIn: 3 },
      clifton: { status: 'complete', dueIn: -6, completedDaysAgo: 11 },
      enneagram: { status: 'not_started', dueIn: 3 },
    },
    raters: [
      { name: 'Dana Whitfield', email: 'dana.whitfield@northwind.health', relationship: 'manager', submitted: true,
        keep: 'Everyone wants to work for Tobi. That is not nothing.',
        more: 'Hold the boundary. You are the manager now, not the best coordinator.' },
      { name: 'Priya Raman', email: 'priya.raman@northwind.health', relationship: 'stakeholder', submitted: true,
        keep: 'The most trusted first-line manager we have promoted this year.',
        more: 'Stop doing the job you were promoted out of.' },
      { name: 'Nikhil Rao', email: 'nikhil.rao@northwind.health', relationship: 'peer', submitted: true,
        keep: 'Genuinely generous with time and context.',
        more: 'Say no sometimes. The team would respect it more, not less.' },
      { name: 'Ellie Park', email: 'ellie.park@northwind.health', relationship: 'peer', submitted: false,
        keep: '',
        more: '' },
      { name: 'Josh Mbeki', email: 'josh.mbeki@northwind.health', relationship: 'direct_report', submitted: true,
        keep: 'Nobody has ever made me feel more supported at work.',
        more: 'Tell me when it is not good enough. I would rather know.' },
      { name: 'Carla Fenn', email: 'carla.fenn@northwind.health', relationship: 'direct_report', submitted: false,
        keep: '',
        more: '' },
      { name: 'Aiden Cross', email: 'aiden.cross@northwind.health', relationship: 'direct_report', submitted: false,
        keep: '',
        more: '' },
    ],
    selfRatings: r([['c-strategic', 2], ['c-influence', 2], ['c-delegation', 2], ['c-feedback', 3], ['c-decisiveness', 3], ['c-collab', 4], ['c-develop', 4], ['c-resilience', 3]]),
    selfKeep: 'I look after my team. People come to me and I make time for them.',
    selfMore: 'Be firmer. I say yes too quickly and then I am the one absorbing it.',
    raterMeans: r([['c-strategic', 3.0], ['c-influence', 3.2], ['c-delegation', 2.4], ['c-feedback', 3.1], ['c-decisiveness', 3.3], ['c-collab', 4.3], ['c-develop', 3.6], ['c-resilience', 3.4]]),
    clifton: [
      { rank: 1, theme: 'Empathy', domain: 'Relationship Building' },
      { rank: 2, theme: 'Harmony', domain: 'Relationship Building' },
      { rank: 3, theme: 'Restorative', domain: 'Executing' },
      { rank: 4, theme: 'Includer', domain: 'Relationship Building' },
      { rank: 5, theme: 'Adaptability', domain: 'Relationship Building' },
    ],
    goals: [],
    sessions: [
      { weeksAgo: 3, topic: 'Kick-off', sharedNotes: 'Set up the assessment window. Rater list agreed with Dana.', privateNotes: 'Four Relationship Building themes in the top five. The whole engagement will be about whether Tobi can hold a boundary.', status: 'held' },
    ],
    nextSessionInDays: 9,
  },

  /* ----------------------------------------------- Nadia Kovacs — coaching */
  {
    engagement: {
      id: 'e-nadia', clientId: 'u-nadia', coachId: 'u-chris', managerId: 'u-raj', hrPartnerId: 'u-simone',
      orgId: 'org-kestrel', startedOn: daysAgo(98), targetEndOn: daysAhead(84), phase: 'coaching', status: 'active',
      sponsorGoal: 'Runs the best region in the network on numbers and the worst on retention. Fix the second without losing the first.',
    },
    assessments: {
      self: { status: 'complete', dueIn: -80, completedDaysAgo: 84 },
      feedback360: { status: 'complete', dueIn: -74, completedDaysAgo: 76 },
      clifton: { status: 'complete', dueIn: -80, completedDaysAgo: 86 },
      enneagram: { status: 'complete', dueIn: -80, completedDaysAgo: 85 },
    },
    raters: [
      { name: 'Raj Patel', email: 'raj.patel@kestrel.co', relationship: 'manager', submitted: true,
        keep: 'Best numbers in the network, quarter after quarter.',
        more: 'If Nadia went under a bus we would lose the region for two quarters. Build a bench.' },
      { name: 'Glen Harper', email: 'glen.harper@kestrel.co', relationship: 'peer', submitted: true,
        keep: 'She will fight for her people against anyone, including me.',
        more: 'You can tell what kind of week it is from the first Slack message.' },
      { name: 'Marta Silva', email: 'marta.silva@kestrel.co', relationship: 'peer', submitted: true,
        keep: 'No meeting with Nadia ends without a decision.',
        more: 'Explain the why. We only ever get the what.' },
      { name: 'Dev Anand', email: 'dev.anand@kestrel.co', relationship: 'direct_report', submitted: true,
        keep: 'She is the reason I have stayed four years.',
        more: 'I have been here four years and I have never run a thing end to end.' },
      { name: 'Kayla Brennan', email: 'kayla.brennan@kestrel.co', relationship: 'direct_report', submitted: true,
        keep: 'You always know exactly where you stand.',
        more: 'Some weeks the intensity is the loudest thing in the room.' },
      { name: 'Tom Whitaker', email: 'tom.whitaker@kestrel.co', relationship: 'direct_report', submitted: true,
        keep: 'She takes the hit for the team every time.',
        more: 'Let us make the call sometimes, even if we make it worse than you would.' },
      { name: 'Simone Clarke', email: 'simone.clarke@kestrel.co', relationship: 'stakeholder', submitted: true,
        keep: 'Operationally the strongest leader in the business.',
        more: 'Retention in that region is the one number that will not move.' },
      { name: 'Owen Fitzgerald', email: 'owen.fitzgerald@kestrel.co', relationship: 'peer', submitted: true,
        keep: 'If Nadia says it will land, it lands.',
        more: 'Slow down in the handover. Things move faster than the rest of us can follow.' },
      { name: 'Beatriz Rocha', email: 'beatriz.rocha@kestrel.co', relationship: 'stakeholder', submitted: true,
        keep: 'Straight answers, every time. That is rarer than it should be.',
        more: 'Nothing I can think of.' },
      { name: 'Hal Mortimer', email: 'hal.mortimer@kestrel.co', relationship: 'stakeholder', submitted: true,
        keep: 'She fixed the depot problem nobody else would touch.',
        more: 'Her team seem to be holding a lot. Worth checking they are alright.' },
    ],
    selfRatings: r([['c-strategic', 4], ['c-influence', 4], ['c-delegation', 3], ['c-feedback', 4], ['c-decisiveness', 5], ['c-collab', 4], ['c-develop', 2], ['c-resilience', 5]]),
    selfKeep: 'Nobody is unclear about where they stand with me, or where the region stands.',
    selfMore: 'Grow the people under me instead of carrying the region myself.',
    raterMeans: r([['c-strategic', 3.7], ['c-influence', 4.1], ['c-delegation', 2.9], ['c-feedback', 3.4], ['c-decisiveness', 4.6], ['c-collab', 3.3], ['c-develop', 2.1], ['c-resilience', 3.6]]),
    clifton: [
      { rank: 1, theme: 'Competition', domain: 'Influencing' },
      { rank: 2, theme: 'Activator', domain: 'Influencing' },
      { rank: 3, theme: 'Significance', domain: 'Influencing' },
      { rank: 4, theme: 'Maximizer', domain: 'Influencing' },
      { rank: 5, theme: 'Self-Assurance', domain: 'Influencing' },
    ],
    enneagram: {
      type: 8, typeName: 'The Challenger', wing: '8w7',
      coreMotivation: 'To protect herself and her people by staying in control.',
      underStress: 'Moves to Type 5 — withdraws information, decides alone, stops explaining.',
      inGrowth: 'Moves to Type 2 — protective energy turns outward into development of others.',
      blindSpot: 'Intensity that feels like standard-setting from the inside feels like weather from the outside.',
    },
    report: {
      status: 'published',
      headline: 'The strongest operator in the network is also its biggest single point of failure.',
      signatureStrengths: [
        'Decisiveness at 4.3, with her directs at 4.2 — the most decisive leader in the cohort.',
        'Five Influencing themes in the top five. There is no ambiguity about who is in charge.',
      ],
      doMoreOf: [
        'Develop a successor deliberately. Developing others sits at 2.0 — 1.8 from her own directs — and it is the number holding the region hostage.',
        'Explain the why once more than feels necessary. Under pressure she withholds information without noticing.',
      ],
      watchOuts: [
        'Retention is the symptom; developing others is the cause. Peers and directs describe the same unpredictability — one calls it "the loudest thing in the room".',
        'Resilience self-rated 4.5 against a rater mean of 3.6 — she is running hotter than she thinks.',
      ],
      themes: [
        {
          title: 'No bench',
          narrative: 'Nadia has no named successor and her three directs describe execution roles, not leadership ones. The region\'s performance is entirely load-bearing on one person.',
          evidence: ['Direct report: "I have been here four years and I have never run a thing end to end."', 'Manager: "If Nadia went under a bus we would lose the region for two quarters."'],
        },
        {
          title: 'Intensity as weather',
          narrative: 'What Nadia experiences as clarity, her team experiences as an unpredictable climate. The behaviour is not aggressive — it is unbuffered.',
          evidence: ['Peer: "You can tell what kind of week it is from the first Slack message."'],
        },
      ],
      sharedWith: ['client', 'manager', 'hr'],
      publishedDaysAgo: 68,
    },
    goals: [
      {
        id: 'g-n1', title: 'Build a named successor', competencyId: 'c-develop',
        description: 'Identify a successor, give them a real region-level outcome, and coach them weekly.',
        baseline: 2.0, target: 4.0, latest: 3.1, weeks: 10,
        measures: ['Successor named to Raj in writing', 'Successor owns one region-level outcome', 'Nadia takes a full week off with no escalations'],
        clientActions: [
          { title: 'Weekly development 1:1 with Dev', detail: 'Thirty minutes on his growth, not on the region\'s numbers.', cadence: 'weekly', doneRatio: 0.7 },
          { title: 'Hand over the network call', detail: 'Dev runs the Thursday network call. You attend on mute.', cadence: 'weekly', doneRatio: 0.5 },
        ],
        managerActions: [
          { title: 'Ask Dev directly for the region update', detail: 'Go to Dev, not Nadia, for the weekly number. Makes the transfer real.', cadence: 'weekly', doneRatio: 0.6 },
        ],
      },
      {
        id: 'g-n2', title: 'Buffer the weather', competencyId: 'c-resilience',
        description: 'Create a predictable communication rhythm so the team stops reading her mood for signal.',
        baseline: 3.3, target: 4.2, latest: 3.5, weeks: 10,
        measures: ['Monday note goes out every week regardless of the week', 'Team pulse on predictability at 4+'],
        clientActions: [
          { title: 'Monday priorities note', detail: 'Same time, same format, whatever kind of week it is.', cadence: 'weekly', doneRatio: 0.6 },
        ],
        managerActions: [
          { title: 'Name the weather when you see it', detail: 'Same-week, private, specific. Nadia responds to directness.', cadence: 'weekly', doneRatio: 0.4 },
        ],
      },
    ],
    sessions: [
      { weeksAgo: 9, topic: 'Report debrief', sharedNotes: 'Agreed the successor goal. Nadia pushed back on "intensity" and then accepted the pattern.', privateNotes: 'She heard "you are the problem". Reframe to "you are the constraint" next time.', status: 'held' },
      { weeksAgo: 5, topic: 'Successor selection', sharedNotes: 'Dev Anand named. Development 1:1s started.', privateNotes: 'She picked the most similar person to herself. Fine for now; revisit.', status: 'held' },
      { weeksAgo: 2, topic: 'Handover friction', sharedNotes: 'Nadia took back the network call twice. Reset the commitment.', privateNotes: 'Raj is not doing his part — he still calls Nadia for the number. Raise with him directly.', status: 'held' },
    ],
    nextSessionInDays: 2,
  },

  /* -------------------------------------------------- Glen Harper — sustain */
  {
    engagement: {
      id: 'e-glen', clientId: 'u-glen', coachId: 'u-chris', managerId: 'u-raj', hrPartnerId: 'u-simone',
      orgId: 'org-kestrel', startedOn: daysAgo(232), targetEndOn: daysAhead(14), phase: 'sustain', status: 'active',
      sponsorGoal: 'Deep technical credibility, no organisational voice. Get him into the room and heard.',
    },
    assessments: {
      self: { status: 'complete', dueIn: -210, completedDaysAgo: 220 },
      feedback360: { status: 'complete', dueIn: -204, completedDaysAgo: 208 },
      clifton: { status: 'complete', dueIn: -210, completedDaysAgo: 222 },
      enneagram: { status: 'complete', dueIn: -210, completedDaysAgo: 221 },
    },
    raters: [
      { name: 'Raj Patel', email: 'raj.patel@kestrel.co', relationship: 'manager', submitted: true,
        keep: 'Zero regretted attrition in fleet in two years. That is Glen.',
        more: "I get Glen's real opinion in the car park. I need it in the room." },
      { name: 'Nadia Kovacs', email: 'nadia.kovacs@kestrel.co', relationship: 'peer', submitted: true,
        keep: 'He is the person I check my thinking with before anyone else.',
        more: 'Say it out loud. Nobody else in that room knows how good he is.' },
      { name: 'Marta Silva', email: 'marta.silva@kestrel.co', relationship: 'peer', submitted: true,
        keep: 'Steady when everything around him is not.',
        more: "Take a position early instead of summarising everyone else's." },
      { name: 'Ronan Doyle', email: 'ronan.doyle@kestrel.co', relationship: 'direct_report', submitted: true,
        keep: 'He has made me better at my job, deliberately and patiently.',
        more: 'Push back upward on our behalf. We would back you.' },
      { name: 'Aisha Bello', email: 'aisha.bello@kestrel.co', relationship: 'direct_report', submitted: true,
        keep: 'Fair, patient, never rattled.',
        more: 'Decide in the meeting. Waiting costs us a week every time.' },
      { name: 'Priya Shah', email: 'priya.shah@kestrel.co', relationship: 'peer', submitted: true,
        keep: 'Thoughtful. He listens properly, which sounds small and is not.',
        more: 'I would like to hear his view in the room rather than reading it in the minutes.' },
      { name: 'Callum Reid', email: 'callum.reid@kestrel.co', relationship: 'direct_report', submitted: true,
        keep: 'Genuinely fair. Never had a nasty surprise from him.',
        more: 'Push harder for us with the exec team. We do not always feel represented.' },
    ],
    selfRatings: r([['c-strategic', 3], ['c-influence', 2], ['c-delegation', 4], ['c-feedback', 3], ['c-decisiveness', 3], ['c-collab', 4], ['c-develop', 4], ['c-resilience', 4]]),
    selfKeep: 'I keep things steady and I bring people on. Fleet has not lost anyone in two years.',
    selfMore: 'Say what I think in the room, at the time, instead of afterwards.',
    raterMeans: r([['c-strategic', 3.4], ['c-influence', 2.2], ['c-delegation', 3.6], ['c-feedback', 3.0], ['c-decisiveness', 2.8], ['c-collab', 3.8], ['c-develop', 3.9], ['c-resilience', 4.2]]),
    clifton: [
      { rank: 1, theme: 'Consistency', domain: 'Executing' },
      { rank: 2, theme: 'Developer', domain: 'Relationship Building' },
      { rank: 3, theme: 'Input', domain: 'Strategic Thinking' },
      { rank: 4, theme: 'Deliberative', domain: 'Executing' },
      { rank: 5, theme: 'Connectedness', domain: 'Relationship Building' },
    ],
    enneagram: {
      type: 9, typeName: 'The Peacemaker', wing: '9w1',
      coreMotivation: 'To maintain inner and outer peace.',
      underStress: 'Moves to Type 6 — anxious, seeks reassurance, defers the decision.',
      inGrowth: 'Moves to Type 3 — takes a position and drives it.',
      blindSpot: 'Withholding a view to keep the peace is experienced by others as having no view.',
    },
    report: {
      status: 'published',
      headline: 'The most trusted person in the network, and the least heard.',
      signatureStrengths: [
        'Developing others at 3.7 and resilience at 4.3 — the steadiest leader in the cohort.',
        'Developer + Connectedness produces a team that stays. Fleet has had zero regretted attrition in two years.',
      ],
      doMoreOf: [
        'State a position in the first five minutes of a forum, not the last five.',
        'Bring the decision to the room rather than to the corridor afterwards.',
      ],
      watchOuts: [
        'Influence at 2.2 and decisiveness at 2.6 are the two lowest scores, and both trace to the same reluctance to sit in disagreement.',
      ],
      themes: [
        {
          title: 'Present but silent',
          narrative: 'Glen attends every forum that matters and speaks in almost none of them. His views arrive afterwards, one-to-one, and by then the decision is made.',
          evidence: ['Manager: "I get Glen\'s real opinion in the car park."', 'Peer: "He is the person I check my thinking with. Nobody else in that room knows that."'],
        },
      ],
      sharedWith: ['client', 'manager', 'hr'],
      publishedDaysAgo: 190,
    },
    goals: [
      {
        id: 'g-g1', title: 'Speak first, not last', competencyId: 'c-influence',
        description: 'Open with a position in senior forums within the first five minutes.',
        baseline: 2.2, target: 4.0, latest: 4.1, weeks: 26,
        measures: ['A stated position in every network forum', 'Raj no longer hears the real view afterwards', 'Peers rate influence at 4+'],
        clientActions: [
          { title: 'Write the position before the meeting', detail: 'One sentence, in your notes, before you walk in.', cadence: 'weekly', doneRatio: 0.92 },
        ],
        managerActions: [
          { title: 'Ask Glen first', detail: 'Open the round with Glen rather than closing with him.', cadence: 'weekly', doneRatio: 0.88 },
        ],
      },
      {
        id: 'g-g2', title: 'Make the call in the room', competencyId: 'c-decisiveness',
        description: 'Close decisions in the meeting rather than taking them away to consider.',
        baseline: 2.6, target: 4.0, latest: 3.9, weeks: 26,
        measures: ['Decisions logged in-meeting', 'No more than one deferred decision per forum'],
        clientActions: [
          { title: 'Name the decision and the date', detail: 'If you defer, say when you will decide before you leave the room.', cadence: 'weekly', doneRatio: 0.85 },
        ],
        managerActions: [
          { title: 'Do not rescue the silence', detail: 'When Glen pauses, wait. Do not fill it.', cadence: 'weekly', doneRatio: 0.81 },
        ],
      },
    ],
    sessions: [
      { weeksAgo: 20, topic: 'Report debrief', sharedNotes: 'The car-park quote landed hard and productively.', privateNotes: 'He was relieved. He has known this about himself for a decade.', status: 'held' },
      { weeksAgo: 12, topic: 'Position-first practice', sharedNotes: 'Four forums, four opening positions. Raj noticed unprompted.', privateNotes: 'Fastest behaviour change I have seen from a 9. Motivation was never the issue.', status: 'held' },
      { weeksAgo: 4, topic: 'Re-measure and handover', sharedNotes: 'Pulse check: influence 2.2 → 4.1, decisiveness 2.8 → 3.9. Both goals achieved. Moving to a monthly sustain rhythm with Raj owning reinforcement.', privateNotes: 'Clean close. Good case study candidate — ask about using it.', status: 'held' },
    ],
    nextSessionInDays: 21,
  },

  /* --------------------------------------------------- Amara Osei — intake */
  {
    engagement: {
      id: 'e-amara', clientId: 'u-amara', coachId: 'u-chris', managerId: 'u-raj', hrPartnerId: 'u-simone',
      orgId: 'org-kestrel', startedOn: daysAgo(5), targetEndOn: daysAhead(177), phase: 'intake', status: 'active',
      sponsorGoal: 'Newly promoted into a director role with three teams she has never run. Ninety-day landing.',
    },
    assessments: {
      self: { status: 'not_started', dueIn: 9 },
      feedback360: { status: 'not_started', dueIn: 16 },
      clifton: { status: 'in_progress', dueIn: 9 },
      enneagram: { status: 'not_started', dueIn: 9 },
    },
    raters: [],
    selfRatings: {},
    selfKeep: '',
    selfMore: '',
    raterMeans: {},
    goals: [],
    sessions: [
      { weeksAgo: 0, topic: 'Contracting', sharedNotes: 'Three-way with Raj. Sponsor goal agreed. Assessment window opens Monday.', privateNotes: 'Simone wants this to be the template for the wider director cohort. Keep the artefacts clean.', status: 'held' },
    ],
    nextSessionInDays: 7,
  },
]

const CHECKIN_NOTES: Record<'coach' | 'manager' | 'client', string[]> = {
  coach: [
    'Coach observation from the weekly session.',
    'Reviewed against the behavioural measures in session.',
    'Specific, repeatable and unprompted this week.',
    'Slipped under load — named it and reset the commitment.',
    'Held it through a genuinely bad week. That is the test.',
  ],
  manager: [
    'Observed in the weekly ops review.',
    'Saw it in the 1:1 — done without being asked.',
    'Not visible to me this week.',
    'Better. Still needs a nudge to start.',
    'Two clear examples in front of the wider team.',
  ],
  client: [
    'Self-assessment against the behavioural measures.',
    'Did it twice this week. The second one was hard.',
    'Slipped under pressure — noticed it, which is new.',
    'Felt natural for the first time.',
    'Deliberate, not automatic yet.',
  ],
}

/* ------------------------------------------------------------ construction */

function buildRatings(base: Ratings, seed: string, spread: number): Ratings {
  const rand = mulberry32(hash(seed))
  const out: Ratings = {}
  for (const id of CIDS) {
    const b = base[id]
    if (b === undefined) continue
    out[id] = clamp(round1(b + (rand() - 0.5) * 2 * spread))
  }
  return out
}

function build(): Database {
  const assessments: Assessment[] = []
  const respondents: Respondent[] = []
  const responses: FeedbackResponse[] = []
  const clifton: Database['clifton'] = []
  const enneagram: EnneagramResult[] = []
  const reports: SynthesisReport[] = []
  const goals: Goal[] = []
  const actions: Action[] = []
  const checkIns: CheckIn[] = []
  const sessions: CoachingSession[] = []
  const activity: ActivityEvent[] = []

  for (const spec of SPECS) {
    const e = spec.engagement
    const rand = mulberry32(hash(e.id))

    activity.push({
      id: `act-${e.id}-start`, engagementId: e.id, at: e.startedOn, actorId: e.coachId,
      kind: 'system', summary: 'Engagement opened and sponsor goal agreed in a three-way with the manager.',
    })

    /* assessments */
    for (const kind of ['self', 'feedback360', 'clifton', 'enneagram'] as AssessmentKind[]) {
      const a = spec.assessments[kind]
      const id = `a-${e.id}-${kind}`
      assessments.push({
        id, engagementId: e.id, kind, status: a.status,
        assignedOn: e.startedOn,
        dueOn: a.dueIn >= 0 ? daysAhead(a.dueIn) : daysAgo(-a.dueIn),
        completedOn: a.completedDaysAgo !== undefined ? daysAgo(a.completedDaysAgo) : undefined,
      })
      if (a.completedDaysAgo !== undefined) {
        activity.push({
          id: `act-${id}`, engagementId: e.id, at: daysAgo(a.completedDaysAgo), actorId: e.clientId,
          kind: 'assessment', summary: `${kind === 'feedback360' ? '360° feedback' : kind === 'self' ? 'Self-evaluation' : kind === 'clifton' ? 'CliftonStrengths' : 'Enneagram'} completed.`,
        })
      }
    }

    /* self-evaluation response, stored as a respondent of relationship "self" */
    if (Object.keys(spec.selfRatings).length) {
      const selfAId = `a-${e.id}-self`
      const selfRid = `r-${e.id}-self`
      const submittedOn = spec.assessments.self.completedDaysAgo !== undefined ? daysAgo(spec.assessments.self.completedDaysAgo) : daysAgo(1)
      const client = USERS.find((u) => u.id === e.clientId)!
      respondents.push({
        id: selfRid, assessmentId: selfAId, name: client.name, email: client.email,
        relationship: 'self', status: 'submitted', invitedOn: e.startedOn, submittedOn,
      })
      responses.push({
        id: `resp-${selfRid}`, assessmentId: selfAId, respondentId: selfRid, relationship: 'self',
        submittedOn, ratings: spec.selfRatings,
        keepDoing: spec.selfKeep,
        doMoreOf: spec.selfMore,
      })
    }

    /* 360 raters */
    const a360 = `a-${e.id}-feedback360`
    const closedDaysAgo = spec.assessments.feedback360.completedDaysAgo
    spec.raters.forEach((rater, i) => {
      const rid = `r-${e.id}-${i}`
      // Anchor submissions to the assessment window, not to today: a rater
      // cannot answer before being invited or after the window closed.
      const submittedOn = closedDaysAgo !== undefined
        ? daysAgo(closedDaysAgo + 1 + Math.round(rand() * 6))
        : daysAgo(1 + Math.round(rand() * 5))
      respondents.push({
        id: rid, assessmentId: a360, name: rater.name, email: rater.email,
        relationship: rater.relationship, status: rater.submitted ? 'submitted' : 'invited',
        invitedOn: e.startedOn, submittedOn: rater.submitted ? submittedOn : undefined,
      })
      if (!rater.submitted) return

      // Direct reports feel the delegation/feedback cost most; managers rate a shade higher.
      const tilt = rater.relationship === 'direct_report' ? -0.3 : rater.relationship === 'manager' ? 0.15 : 0
      const base: Ratings = {}
      for (const cid of CIDS) {
        const m = spec.raterMeans[cid]
        if (m === undefined) continue
        const soft = cid === 'c-delegation' || cid === 'c-feedback' || cid === 'c-develop' ? tilt : tilt * 0.4
        base[cid] = m + soft
      }
      responses.push({
        id: `resp-${rid}`, assessmentId: a360, respondentId: rid, relationship: rater.relationship,
        submittedOn, ratings: buildRatings(base, rid, 0.45),
        keepDoing: rater.keep,
        doMoreOf: rater.more,
      })
    })

    /* strengths + enneagram */
    if (spec.clifton) {
      clifton.push({
        id: `cl-${e.id}`, engagementId: e.id,
        recordedOn: daysAgo(spec.assessments.clifton.completedDaysAgo ?? 1), themes: spec.clifton,
      })
    }
    if (spec.enneagram) {
      enneagram.push({
        id: `en-${e.id}`, engagementId: e.id,
        recordedOn: daysAgo(spec.assessments.enneagram.completedDaysAgo ?? 1), ...spec.enneagram,
      })
    }

    /* report */
    if (spec.report) {
      const { publishedDaysAgo, ...rest } = spec.report
      const version = rest.status === 'published' ? 2 : 1
      const publishedOn = publishedDaysAgo !== undefined ? daysAgo(publishedDaysAgo) : undefined
      reports.push({
        id: `rep-${e.id}`, engagementId: e.id, version,
        updatedOn: publishedOn ?? daysAgo(3),
        publishedOn,
        ...rest,
        published: publishedOn
          ? {
              version, publishedOn,
              headline: rest.headline,
              signatureStrengths: rest.signatureStrengths,
              doMoreOf: rest.doMoreOf,
              watchOuts: rest.watchOuts,
              themes: rest.themes,
            }
          : undefined,
      })
      if (publishedDaysAgo !== undefined) {
        activity.push({
          id: `act-${e.id}-rep`, engagementId: e.id, at: daysAgo(publishedDaysAgo), actorId: e.coachId,
          kind: 'report', summary: 'Synthesis report published to the client, manager and HR.',
        })
      }
    }

    /* goals, actions, check-ins */
    for (const g of spec.goals) {
      const status: Goal['status'] =
        g.latest >= g.target ? 'achieved' : g.latest - g.baseline < (g.target - g.baseline) * 0.35 ? 'at_risk' : 'on_track'
      goals.push({
        id: g.id, engagementId: e.id, title: g.title, description: g.description, competencyId: g.competencyId,
        createdOn: daysAgo(g.weeks * 7 + 3), targetDate: daysAhead(e.phase === 'sustain' ? 14 : 42),
        status, baseline: g.baseline, target: g.target, measures: g.measures,
      })
      activity.push({
        id: `act-${g.id}`, engagementId: e.id, at: daysAgo(g.weeks * 7 + 3), actorId: e.coachId,
        kind: 'plan', summary: `Goal added to the coaching plan: ${g.title}`,
      })

      // Weekly check-ins tracing baseline -> latest with a little week-to-week noise.
      const grand = mulberry32(hash(g.id))
      const raters: [string, 'coach' | 'manager' | 'client'][] = [[e.coachId, 'coach'], [e.managerId, 'manager'], [e.clientId, 'client']]
      for (let w = 0; w < g.weeks; w++) {
        const t = g.weeks === 1 ? 1 : w / (g.weeks - 1)
        const eased = t * t * (3 - 2 * t)
        const value = clamp(round1(g.baseline + (g.latest - g.baseline) * eased + (grand() - 0.5) * 0.34))
        const [byUserId, byRole] = raters[w % raters.length]
        checkIns.push({
          id: `ci-${g.id}-${w}`, goalId: g.id, engagementId: e.id, byUserId, byRole,
          date: daysAgo((g.weeks - w) * 7),
          rating: value,
          // Offset by goal as well as week, or three goals share one date and one note.
          note: CHECKIN_NOTES[byRole][(w + hash(g.id)) % CHECKIN_NOTES[byRole].length],
        })
      }

      const mkActions = (
        list: GoalSpec['clientActions'], owner: 'client' | 'manager', prefix: string,
      ) => {
        list.forEach((spec2, ai) => {
          const weeksPerPeriod = spec2.cadence === 'monthly' ? 4 : spec2.cadence === 'biweekly' ? 2 : 1
          const occurrences = spec2.cadence === 'once' ? 1 : Math.max(1, Math.min(13, Math.round(g.weeks / weeksPerPeriod)))
          const run: Action[] = []
          for (let k = 0; k < occurrences; k++) {
            // k counts forward in time; the last occurrence is the live one.
            const periodsBack = occurrences - 1 - k
            const dueOffset = periodsBack * weeksPerPeriod * 7
            const isLive = k === occurrences - 1
            const done = !isLive && grand() < spec2.doneRatio
            // The live occurrence is the only open one — a recurring nudge missed
            // three weeks ago is a miss, not a task. Some land a little late so the
            // dashboards have genuine overdue work on them.
            const liftLate = isLive && grand() < 0.3
            run.push({
              id: `ac-${prefix}-${g.id}-${ai}-${k}`, goalId: g.id, engagementId: e.id, owner,
              title: spec2.title, detail: spec2.detail, cadence: spec2.cadence,
              dueOn: isLive
                ? (liftLate ? daysAgo(2) : daysAhead(Math.max(2, weeksPerPeriod * 7 - 3)))
                : daysAgo(dueOffset),
              status: isLive ? 'open' : done ? 'done' : 'skipped',
              completedOn: !isLive && done ? daysAgo(dueOffset + 1) : undefined,
            })
          }
          actions.push(...run)
        })
      }
      mkActions(g.clientActions, 'client', 'cl')
      mkActions(g.managerActions, 'manager', 'mg')
    }

    /* sessions */
    spec.sessions.forEach((s, i) => {
      const date = daysAgo(s.weeksAgo * 7)
      sessions.push({
        id: `s-${e.id}-${i}`, engagementId: e.id, date, durationMin: 60,
        topic: s.topic, sharedNotes: s.sharedNotes, privateNotes: s.privateNotes, status: s.status,
      })
      activity.push({
        id: `act-s-${e.id}-${i}`, engagementId: e.id, at: date, actorId: e.coachId,
        kind: 'session', summary: 'Coaching session held.',
      })
    })
    if (spec.nextSessionInDays !== undefined) {
      sessions.push({
        id: `s-${e.id}-next`, engagementId: e.id, date: daysAhead(spec.nextSessionInDays), durationMin: 60,
        topic: 'Weekly coaching', sharedNotes: '', privateNotes: '', status: 'scheduled',
      })
    }
  }

  activity.sort((a, b) => (a.at < b.at ? 1 : -1))

  return {
    orgs: ORGS,
    users: USERS,
    competencies: COMPETENCIES,
    engagements: SPECS.map((s) => s.engagement),
    assessments, respondents, responses, clifton, enneagram, reports, goals, actions, checkIns, sessions, activity,
  }
}

export function seedDatabase(): Database {
  return build()
}
