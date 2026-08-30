import { Link } from 'react-router-dom'
import { useViewer } from '../auth/AuthContext'
import { useDb } from '../data/store'
import { setActionStatus } from '../data/actions'
import { reportFor, visibleEngagements } from '../lib/permissions'
import {
  commitmentStats, engagementScore, formatDate, goalProgress, goalsFor, openActions, relativeDays,
  todayIso, userById,
} from '../lib/metrics'
import { PHASES } from '../types'
import {
  Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, Meter, PageHeader, StatTile, StatusPill,
} from '../components/ui/primitives'
import { Sparkline } from '../components/charts'

export function ManagerDashboard() {
  const db = useDb()
  const viewer = useViewer()
  const engagements = visibleEngagements(db, viewer)

  if (!engagements.length) {
    return <EmptyState title="Nobody on your team is in coaching yet" body="Plans and reinforcement actions appear here once someone on your team starts an engagement." />
  }

  const allActions = db.actions.filter((a) => engagements.some((e) => e.id === a.engagementId))
  const myStats = commitmentStats(allActions, 'manager')
  const dueNow = engagements
    .flatMap((e) => openActions(db, e.id, 'manager').map((a) => ({ a, e })))
    .sort((x, y) => (x.a.dueOn < y.a.dueOn ? -1 : 1))
    .slice(0, 8)
  const overdue = dueNow.filter(({ a }) => a.dueOn < todayIso()).length

  return (
    <>
      <PageHeader
        eyebrow="My team"
        title="Reinforcement dashboard"
        subtitle="The people you manage who are in coaching, and your part of their plan."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="People in coaching" value={engagements.length} foot="Direct reports with an active engagement" />
        <StatTile
          label="Your follow-through"
          value={Math.round(myStats.rate * 100)}
          unit="%"
          tone={myStats.rate >= 0.8 ? 'good' : myStats.rate >= 0.6 ? 'warning' : 'critical'}
          foot={`${myStats.done} of ${myStats.due} reinforcement actions completed on time`}
        />
        <StatTile
          label="Overdue on you"
          value={overdue}
          tone={overdue ? 'critical' : 'good'}
          foot={overdue ? 'These are the ones the coaching is waiting on' : 'Nothing past due — keep it there'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {engagements.map((e) => {
            const client = userById(db, e.clientId)!
            const score = engagementScore(db, e)
            const goals = goalsFor(db, e.id)
            const report = reportFor(db, e.id)
            const sharedReport = report?.status === 'published' && report.sharedWith.includes('manager') ? report : undefined
            const theirStats = commitmentStats(db.actions.filter((x) => x.engagementId === e.id), 'manager')

            return (
              <Card key={e.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2.5">
                      <Avatar name={client.name} accent={client.accent} size={30} />
                      <Link to={`/engagements/${e.id}`} className="hover:text-accent">{client.name}</Link>
                    </span>
                  }
                  subtitle={client.title}
                  action={<Badge tone="accent">{PHASES.find((p) => p.id === e.phase)!.label}</Badge>}
                />
                <CardBody className="space-y-4">
                  {sharedReport ? (
                    <div className="rounded-lg border border-hairline bg-surface-2 px-3.5 py-3">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">What to reinforce</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {sharedReport.doMoreOf.map((d, di) => (
                          <li key={di} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                            <span className="mt-0.5 shrink-0 text-accent" aria-hidden="true">↗</span>{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-hairline bg-surface-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-2">
                      <span aria-hidden="true">🔒 </span>
                      The synthesis report has not been released to you yet. You will see the strengths and
                      the &ldquo;do more of&rdquo; the moment the coach publishes it.
                    </p>
                  )}

                  {goals.length > 0 ? (
                    <div className="space-y-3.5">
                      {goals.map((g) => {
                        const p = goalProgress(g, db.checkIns)
                        return (
                          <div key={g.id}>
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[13px] font-medium text-ink">{g.title}</p>
                              <div className="flex items-center gap-2">
                                <Sparkline values={p.checkIns.map((c) => c.rating)} width={70} />
                                <StatusPill status={g.status} />
                              </div>
                            </div>
                            <Meter value={p.pct * 100} tone="series" />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[13px] text-ink-2">The coaching plan is still being built.</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
                    <span className="text-[12.5px] text-ink-2">
                      Overall progress <span className="tabular font-semibold text-ink">{score.overall}%</span>
                      <span className="mx-2 text-muted">·</span>
                      Your reinforcement{' '}
                      {theirStats.due === 0 ? (
                        <span className="font-medium text-muted">nothing due yet</span>
                      ) : (
                        <span className={`tabular font-semibold ${theirStats.rate < 0.6 ? 'text-[#a12d2d]' : 'text-ink'}`}>{Math.round(theirStats.rate * 100)}%</span>
                      )}
                    </span>
                    <Link to={`/engagements/${e.id}`}><Button size="sm">Open their plan</Button></Link>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Your reinforcement actions" />
            <CardBody>
              <ul className="space-y-3">
                {dueNow.map(({ a, e }) => {
                  const client = userById(db, e.clientId)!
                  const late = a.dueOn < todayIso()
                  return (
                    <li key={a.id} className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-accent)]"
                        checked={false}
                        onChange={() => setActionStatus(a.id, 'done', viewer)}
                        aria-label={a.title}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">{a.title}</p>
                        <p className="text-[12px] leading-snug text-ink-2">{a.detail}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted">
                          {client.name} · due {relativeDays(a.dueOn)}
                          {late && <span className="ml-1 font-medium text-[#a12d2d]">overdue</span>}
                        </p>
                      </div>
                    </li>
                  )
                })}
                {!dueNow.length && <li className="text-[13px] text-ink-2">Nothing outstanding. Next actions arrive with the next coaching session.</li>}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Your access" action={<Link to="/settings" className="text-[12.5px] font-medium text-accent hover:underline">Settings →</Link>} />
            <CardBody className="space-y-1.5 text-[12.5px] leading-snug text-ink-2">
              <p><span className="font-medium text-ink">Visible</span> — the plan, goals, movement, commitments, released reports.</p>
              <p><span className="font-medium text-ink">Withheld</span> — 360 responses and comments, Enneagram, session notes.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Coming up" />
            <CardBody>
              <ul className="space-y-2.5">
                {engagements.map((e) => {
                  const client = userById(db, e.clientId)!
                  return (
                    <li key={e.id} className="text-[12.5px] text-ink-2">
                      <span className="font-medium text-ink">{client.name}</span> — engagement closes {formatDate(e.targetEndOn)}
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
