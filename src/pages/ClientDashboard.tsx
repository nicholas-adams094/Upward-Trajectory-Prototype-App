import { Link } from 'react-router-dom'
import { useViewer } from '../auth/AuthContext'
import { useDb } from '../data/store'
import { setActionStatus } from '../data/actions'
import { visibleEngagements, reportFor } from '../lib/permissions'
import {
  commitmentStats, engagementScore, formatDate, goalProgress, goalsFor, openActions, relativeDays,
  todayIso, userById,
} from '../lib/metrics'
import { ASSESSMENT_LABELS, PHASES } from '../types'
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Meter, PageHeader, StatTile, StatusPill,
} from '../components/ui/primitives'
import { PhaseTrack, Sparkline } from '../components/charts'

export function ClientDashboard() {
  const db = useDb()
  const viewer = useViewer()
  const engagement = visibleEngagements(db, viewer)[0]

  if (!engagement) {
    return <EmptyState title="No coaching engagement yet" body="Your assessments, report and plan appear here once your coach opens the engagement." />
  }

  const score = engagementScore(db, engagement)
  const goals = goalsFor(db, engagement.id)
  const actions = db.actions.filter((a) => a.engagementId === engagement.id)
  const myOpen = openActions(db, engagement.id, 'client').slice(0, 6)
  const stats = commitmentStats(actions, 'client')
  const nextSession = db.sessions
    .filter((s) => s.engagementId === engagement.id && s.status === 'scheduled' && s.date >= todayIso())
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0]
  const outstanding = db.assessments.filter((a) => a.engagementId === engagement.id && a.status !== 'complete')
  const report = reportFor(db, engagement.id)
  const coach = userById(db, engagement.coachId)!
  const manager = userById(db, engagement.managerId)!

  return (
    <>
      <PageHeader
        eyebrow="My development"
        title={`Good to see you, ${viewer.name.split(' ')[0]}.`}
        subtitle={engagement.sponsorGoal}
        actions={<Link to={`/engagements/${engagement.id}`}><Button variant="primary">Open my full record</Button></Link>}
      />

      <Card className="mb-5">
        <CardBody>
          <PhaseTrack phases={PHASES} activeIndex={score.phaseIndex} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {outstanding.length > 0 && (
            <Card>
              <CardHeader
                title="Waiting on you"
                subtitle="Outstanding"
                action={<Badge tone="warning">{outstanding.length} outstanding</Badge>}
              />
              <CardBody>
                <ul className="divide-y divide-hairline">
                  {outstanding.map((a) => {
                    const overdue = a.dueOn < todayIso()
                    return (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                        <div>
                          <p className="text-[13.5px] font-medium text-ink">{ASSESSMENT_LABELS[a.kind]}</p>
                          <p className={`text-[12px] ${overdue ? 'font-medium text-[#a12d2d]' : 'text-muted'}`}>
                            {overdue ? 'Overdue — was due ' : 'Due '}{formatDate(a.dueOn)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill status={a.status} />
                          <Link to={`/engagements/${engagement.id}`}><Button size="sm">Open</Button></Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="This week's commitments"
              subtitle="Due now"
              action={stats.due ? (
                <Badge tone={stats.rate >= 0.8 ? 'good' : stats.rate >= 0.6 ? 'warning' : 'critical'}>
                  {Math.round(stats.rate * 100)}% follow-through
                </Badge>
              ) : <Badge>Nothing due yet</Badge>}
            />
            <CardBody>
              {myOpen.length ? (
                <ul className="space-y-3">
                  {myOpen.map((a) => {
                    const goal = goals.find((g) => g.id === a.goalId)
                    const overdue = a.dueOn < todayIso()
                    return (
                      <li key={a.id} className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-accent)]"
                          checked={false}
                          onChange={() => setActionStatus(a.id, 'done', viewer)}
                          aria-label={a.title}
                        />
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium text-ink">{a.title}</p>
                          <p className="text-[12.5px] leading-snug text-ink-2">{a.detail}</p>
                          <p className="mt-0.5 text-[11.5px] text-muted">
                            {goal?.title} · due {relativeDays(a.dueOn)}
                            {overdue && <span className="ml-1 font-medium text-[#a12d2d]">overdue</span>}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-2">Nothing open right now. Your next commitments arrive after the next session.</p>
              )}
            </CardBody>
          </Card>

          {goals.length > 0 && (
            <Card>
              <CardHeader title="My goals" />
              <CardBody className="space-y-5">
                {goals.map((g) => {
                  const p = goalProgress(g, db.checkIns)
                  return (
                    <div key={g.id}>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13.5px] font-medium text-ink">{g.title}</p>
                        <div className="flex items-center gap-2">
                          <Sparkline values={p.checkIns.map((c) => c.rating)} />
                          <StatusPill status={g.status} />
                        </div>
                      </div>
                      <Meter label={`${g.baseline.toFixed(1)} → ${p.latest.toFixed(1)} of ${g.target.toFixed(1)}`} value={p.pct * 100} tone="series" />
                    </div>
                  )
                })}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {nextSession && (
            <Card>
              <CardHeader title="Next session with Chris" />
              <CardBody>
                <p className="text-[15px] font-semibold text-ink">{formatDate(nextSession.date)}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-2">{relativeDays(nextSession.date)} · {nextSession.durationMin} minutes</p>
              </CardBody>
            </Card>
          )}

          <div className="grid gap-3">
            <StatTile label="Overall progress" value={score.overall} unit="%" foot="Inputs collected, synthesised, behaviour moved" />
          </div>

          {report?.status === 'published' && (
            <Card>
              <CardHeader title="My report" subtitle={`Version ${report.version} · published ${formatDate(report.publishedOn!)}`} />
              <CardBody>
                <p className="text-[13.5px] leading-relaxed text-ink">{report.headline}</p>
                <Link to={`/engagements/${engagement.id}`} className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline">
                  Read the full report →
                </Link>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Who else can see this" action={<Link to="/settings" className="text-[12.5px] font-medium text-accent hover:underline">Settings →</Link>} />
            <CardBody className="space-y-1.5 text-[12.5px] leading-snug text-ink-2">
              <p><span className="font-medium text-ink">{coach.name}</span> — coach · everything</p>
              <p><span className="font-medium text-ink">{manager.name}</span> — manager · plan, progress{report?.sharedWith.includes('manager') ? ', report' : ''}</p>
              <p><span className="font-medium text-ink">Nobody else</span> — 360 comments, Enneagram, session notes</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
