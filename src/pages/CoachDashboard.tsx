import { Link } from 'react-router-dom'
import { useViewer } from '../auth/AuthContext'
import { useDb } from '../data/store'
import { visibleEngagements } from '../lib/permissions'
import {
  engagementScore, formatDate, goalsFor, orgAnalytics, relativeDays, todayIso, userById,
} from '../lib/metrics'
import { PHASES } from '../types'
import {
  Avatar, Badge, Card, CardBody, CardHeader, Meter, PageHeader, StatTile,
} from '../components/ui/primitives'
import { BarList } from '../components/charts'

export function CoachDashboard() {
  const db = useDb()
  const viewer = useViewer()
  const engagements = visibleEngagements(db, viewer)
  const analytics = orgAnalytics(db, engagements)

  const upcoming = db.sessions
    .filter((s) => s.status === 'scheduled' && s.date >= todayIso() && engagements.some((e) => e.id === s.engagementId))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 5)

  const outstandingRaters = engagements.flatMap((e) => {
    const a360 = db.assessments.find((a) => a.engagementId === e.id && a.kind === 'feedback360')
    if (!a360 || a360.status === 'complete') return []
    const waiting = db.respondents.filter((r) => r.assessmentId === a360.id && r.status !== 'submitted')
    return waiting.length ? [{ engagement: e, waiting: waiting.length, dueOn: a360.dueOn }] : []
  })

  return (
    <>
      <PageHeader
        eyebrow="Upward Trajectory"
        title="Practice dashboard"
        subtitle="Every engagement, what needs your attention, and whether the managers are doing their half of the work."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active engagements" value={analytics.active} foot={`Across ${new Set(engagements.map((e) => e.orgId)).size} client organisations`} />
        <StatTile label="Average progress" value={analytics.avgProgress} unit="%" foot="Averaged across the book" />
        <StatTile
          label="Manager reinforcement"
          value={analytics.avgReinforcement}
          unit="%"
          tone={analytics.avgReinforcement < 65 ? 'warning' : 'good'}
          foot="Reinforcement actions completed on time"
        />
        <StatTile
          label="Needs attention"
          value={analytics.atRisk.length}
          tone={analytics.atRisk.length ? 'critical' : 'good'}
          foot="Engagements with something slipping"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {analytics.atRisk.length > 0 && (
            <Card>
              <CardHeader title="Needs your attention" subtitle="Ranked by what will stall the engagement soonest." />
              <CardBody>
                <ul className="divide-y divide-hairline">
                  {analytics.atRisk.map(({ engagement, reason }) => {
                    const client = userById(db, engagement.clientId)!
                    return (
                      <li key={engagement.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={client.name} accent={client.accent} size={32} />
                          <div className="leading-tight">
                            <Link to={`/engagements/${engagement.id}`} className="text-[13.5px] font-medium text-ink hover:text-accent">{client.name}</Link>
                            <p className="text-[12px] text-muted">{client.title}</p>
                          </div>
                        </div>
                        <Badge tone="critical"><span aria-hidden="true">!</span>{reason}</Badge>
                      </li>
                    )
                  })}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="The book" subtitle="Every engagement with its phase and composite progress." />
            <CardBody>
              <ul className="divide-y divide-hairline">
                {engagements.map((e) => {
                  const client = userById(db, e.clientId)!
                  const org = db.orgs.find((o) => o.id === e.orgId)!
                  const score = engagementScore(db, e)
                  const goals = goalsFor(db, e.id)
                  return (
                    <li key={e.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={client.name} accent={client.accent} size={36} />
                          <div className="leading-tight">
                            <Link to={`/engagements/${e.id}`} className="text-[14px] font-medium text-ink hover:text-accent">{client.name}</Link>
                            <p className="text-[12px] text-muted">{client.title} · {org.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="accent">{PHASES.find((p) => p.id === e.phase)!.label}</Badge>
                          {goals.length > 0 && <Badge>{goals.length} goal{goals.length > 1 ? 's' : ''}</Badge>}
                        </div>
                      </div>
                      <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
                        <Meter label="Inputs" value={score.assessment} tone="series" />
                        {goals.length ? (
                          <>
                            <Meter label="Plan movement" value={score.plan} tone="series" />
                            <Meter label="Reinforcement" value={score.reinforcement} tone="series" />
                          </>
                        ) : (
                          <p className="self-center text-[12px] text-muted sm:col-span-2">
                            No coaching plan yet · {PHASES.find((p) => p.id === e.phase)!.blurb}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Upcoming sessions" />
            <CardBody>
              <ul className="space-y-3">
                {upcoming.map((s) => {
                  const e = engagements.find((x) => x.id === s.engagementId)!
                  const client = userById(db, e.clientId)!
                  return (
                    <li key={s.id} className="flex items-center gap-3">
                      <Avatar name={client.name} accent={client.accent} size={28} />
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-[13px] font-medium text-ink">{client.name}</p>
                        <p className="text-[11.5px] text-muted">{formatDate(s.date)} · {relativeDays(s.date)}</p>
                      </div>
                    </li>
                  )
                })}
                {!upcoming.length && <li className="text-[13px] text-ink-2">Nothing scheduled.</li>}
              </ul>
            </CardBody>
          </Card>

          {outstandingRaters.length > 0 && (
            <Card>
              <CardHeader title="Chasing 360 raters" subtitle="Assessment windows that are still open." />
              <CardBody>
                <ul className="space-y-3">
                  {outstandingRaters.map(({ engagement, waiting, dueOn }) => {
                    const client = userById(db, engagement.clientId)!
                    const overdue = dueOn < todayIso()
                    return (
                      <li key={engagement.id}>
                        <Link to={`/engagements/${engagement.id}`} className="text-[13px] font-medium text-ink hover:text-accent">{client.name}</Link>
                        <p className={`text-[11.5px] ${overdue ? 'font-medium text-[#a12d2d]' : 'text-muted'}`}>
                          {waiting} rater{waiting > 1 ? 's' : ''} outstanding · {overdue ? 'window closed ' : 'closes '}{formatDate(dueOn)}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Reinforcement by manager" subtitle="Who is doing their half of the work." />
            <CardBody>
              <BarList
                rows={analytics.reinforcementByManager.map((m) => ({ label: m.name, value: m.rate, sub: `${m.clients} client${m.clients > 1 ? 's' : ''}` }))}
                max={100}
                suffix="%"
                note="Manager reinforcement actions completed by their due date."
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
