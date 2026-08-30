import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useViewer } from '../../auth/AuthContext'
import { useDb } from '../../data/store'
import { can, reportFor } from '../../lib/permissions'
import { PHASES } from '../../types'
import { ROLE_LABELS, engagementScore, formatDate, userById } from '../../lib/metrics'
import { Avatar, Badge, Card, CardBody, StatusPill, Tabs } from '../../components/ui/primitives'
import { PhaseTrack } from '../../components/charts'
import { Overview } from './tabs/Overview'
import { Assessments } from './tabs/Assessments'
import { Feedback } from './tabs/Feedback'
import { Report } from './tabs/Report'
import { Plan } from './tabs/Plan'
import { Progress } from './tabs/Progress'
import { Sessions } from './tabs/Sessions'

type TabId = 'overview' | 'assessments' | 'feedback' | 'report' | 'plan' | 'progress' | 'sessions'

export function EngagementDetail() {
  const { id } = useParams()
  const db = useDb()
  const viewer = useViewer()
  const [tab, setTab] = useState<TabId>('overview')

  const engagement = db.engagements.find((e) => e.id === id)
  if (!engagement) {
    return <Card><CardBody>Engagement not found.</CardBody></Card>
  }

  const report = reportFor(db, engagement.id)
  const ctx = { viewer, engagement, report }
  if (!can('engagement.summary', ctx)) {
    return (
      <Card>
        <CardBody className="py-10 text-center">
          <p className="text-[14px] font-semibold text-ink">You do not have access to this engagement</p>
          <p className="mt-1.5 text-[13px] text-ink-2">
            Only the coach, the client, their manager and the named HR partner can open it.
          </p>
        </CardBody>
      </Card>
    )
  }

  const client = userById(db, engagement.clientId)!
  const manager = userById(db, engagement.managerId)!
  const hr = userById(db, engagement.hrPartnerId)!
  const coach = userById(db, engagement.coachId)!
  const org = db.orgs.find((o) => o.id === engagement.orgId)!
  const score = engagementScore(db, engagement)

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    ...(can('assessment.status', ctx) ? [{ id: 'assessments' as const, label: 'Assessments' }] : []),
    ...(can('feedback360.rollup', ctx) ? [{ id: 'feedback' as const, label: '360 results' }] : []),
    ...(can('report', ctx) ? [{ id: 'report' as const, label: 'Report' }] : []),
    ...(can('plan.goals', ctx) ? [{ id: 'plan' as const, label: 'Coaching plan' }] : []),
    ...(can('checkins', ctx) ? [{ id: 'progress' as const, label: 'Progress' }] : []),
    ...(can('session.shared', ctx) ? [{ id: 'sessions' as const, label: 'Sessions' }] : []),
  ]
  const active = tabs.some((t) => t.id === tab) ? tab : 'overview'

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <Avatar name={client.name} accent={client.accent} size={52} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{client.name}</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-2">{client.title} · {org.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={engagement.status === 'active' ? 'active' : 'paused'} />
              <Badge tone="accent">{PHASES[score.phaseIndex].label} phase</Badge>
              <Badge>Started {formatDate(engagement.startedOn)}</Badge>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">Overall progress</p>
          <p className="mt-1 text-[30px] font-semibold leading-none tracking-tight text-ink">{score.overall}<span className="text-[16px] text-ink-2">%</span></p>
          <p className="mt-1 text-[11.5px] text-muted">Inputs collected, synthesised, behaviour moved</p>
        </div>
      </div>

      <Card className="mb-5">
        <CardBody>
          <PhaseTrack phases={PHASES} activeIndex={score.phaseIndex} />
        </CardBody>
      </Card>

      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-hairline bg-surface px-4 py-3 text-[12.5px]">
        {[{ u: coach, r: 'Coach' }, { u: manager, r: 'Manager' }, { u: hr, r: 'HR partner' }].map(({ u, r }) => (
          <span key={u.id} className="flex items-center gap-2">
            <Avatar name={u.name} accent={u.accent} size={24} />
            <span className="leading-tight">
              <span className="block font-medium text-ink">{u.name}</span>
              <span className="block text-[11.5px] text-muted">{r}</span>
            </span>
          </span>
        ))}
        <span className="ml-auto flex items-center text-[12px] text-muted">
          Viewing as {ROLE_LABELS[viewer.role].toLowerCase()}
          <Link to="/access" className="ml-1.5 text-accent underline-offset-2 hover:underline">what you can see</Link>
        </span>
      </div>

      <div className="mb-4">
        <Tabs tabs={tabs} active={active} onChange={setTab} />
      </div>

      {active === 'overview' && <Overview engagement={engagement} />}
      {active === 'assessments' && <Assessments engagement={engagement} />}
      {active === 'feedback' && <Feedback engagement={engagement} />}
      {active === 'report' && <Report engagement={engagement} />}
      {active === 'plan' && <Plan engagement={engagement} />}
      {active === 'progress' && <Progress engagement={engagement} />}
      {active === 'sessions' && <Sessions engagement={engagement} />}
    </>
  )
}
