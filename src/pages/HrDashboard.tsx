import { Link } from 'react-router-dom'
import { useViewer } from '../auth/AuthContext'
import { useDb } from '../data/store'
import { visibleEngagements } from '../lib/permissions'
import { engagementScore, orgAnalytics, userById, waveMovement, waveRounds } from '../lib/metrics'
import { PHASES } from '../types'
import {
  Avatar, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatTile,
} from '../components/ui/primitives'
import { BarList, GapChart } from '../components/charts'

export function HrDashboard() {
  const db = useDb()
  const viewer = useViewer()
  const engagements = visibleEngagements(db, viewer)
  const org = db.orgs.find((o) => o.id === viewer.orgId)!

  if (!engagements.length) {
    return <EmptyState title="No engagements yet" body="Coaching engagements you are named on as the HR partner appear here." />
  }

  const a = orgAnalytics(db, engagements)
  const totalPhase = Object.values(a.phaseCounts).reduce((s, n) => s + n, 0)

  // Movement the raters themselves scored, not movement the coaching team logged.
  const remeasured = engagements
    .map((e) => {
      const rounds = waveRounds(db, e.id)
      if (rounds.length < 2) return null
      const rows = waveMovement(db, e.id, rounds[rounds.length - 1], rounds[0], { minGroup: db.settings.minGroup })
        .filter((m) => m.delta !== null)
      if (!rows.length) return null
      const avg = rows.reduce((sum, m) => sum + m.delta!, 0) / rows.length
      return { engagement: e, rows, avg: Math.round(avg * 10) / 10 }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="Coaching portfolio"
        subtitle="Progress, reinforcement and risk across the people you sponsor."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Leaders in coaching" value={a.engagements} foot={`${a.active} active engagements`} />
        <StatTile label="Average progress" value={a.avgProgress} unit="%" foot="Assessments, report and goal movement" />
        <StatTile
          label="Goals achieved"
          value={`${a.goalsAchieved}/${a.goalsTotal}`}
          tone={a.goalsAtRisk ? 'warning' : a.goalsAchieved ? 'good' : undefined}
          foot={a.goalsAtRisk ? `${a.goalsAtRisk} goal${a.goalsAtRisk > 1 ? 's' : ''} at risk` : 'None at risk'}
        />
        <StatTile
          label="Manager reinforcement"
          value={a.avgReinforcement}
          unit="%"
          tone={a.avgReinforcement < 65 ? 'critical' : 'good'}
          foot="Actions completed by their due date"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {remeasured.length > 0 && (
            <Card>
              <CardHeader
                title="Rater-verified movement"
                subtitle="Engagements with a completed re-measure 360"
                action={<Badge tone="good">{remeasured.length}</Badge>}
              />
              <CardBody>
                <BarList
                  rows={remeasured.map((r) => ({
                    label: userById(db, r.engagement.clientId)?.name ?? 'Client',
                    value: r.avg,
                    sub: `${r.rows.length} competenc${r.rows.length === 1 ? 'y' : 'ies'} re-rated`,
                  }))}
                  max={Math.max(1, ...remeasured.map((r) => Math.abs(r.avg)))}
                  note="Change in the average score the same raters gave, baseline to re-measure"
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Competency movement"
              subtitle="Averaged across every goal targeting that competency"
            />
            <CardBody>
              {a.competencyMovement.length ? (
                <GapChart
                  rows={a.competencyMovement.map((m) => ({ label: m.competency.name, a: m.baseline, b: m.latest }))}
                  aLabel="Baseline"
                  bLabel="Latest"
                  note="1–5 · right-hand number is the movement"
                />
              ) : (
                <p className="text-[13px] text-ink-2">No goals have been set yet, so there is nothing to move.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Where each engagement sits" />
            <CardBody>
              <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full" role="img" aria-label="Engagements by phase">
                {PHASES.map((p, i) => {
                  const n = a.phaseCounts[p.id] ?? 0
                  if (!n) return null
                  const shades = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']
                  return (
                    <span
                      key={p.id}
                      style={{ width: `${(n / totalPhase) * 100}%`, background: shades[i], marginRight: 2 }}
                      title={`${p.label}: ${n}`}
                    />
                  )
                })}
              </div>
              <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
                {PHASES.map((p, i) => {
                  const n = a.phaseCounts[p.id] ?? 0
                  if (!n) return null
                  const shades = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']
                  return (
                    <li key={p.id} className="flex items-center gap-1.5 text-[12px] text-ink-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: shades[i] }} aria-hidden="true" />
                      {p.label} <span className="tabular font-semibold text-ink">{n}</span>
                    </li>
                  )
                })}
              </ul>

              <ul className="divide-y divide-hairline">
                {engagements.map((e) => {
                  const client = userById(db, e.clientId)!
                  const manager = userById(db, e.managerId)!
                  const score = engagementScore(db, e)
                  return (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} accent={client.accent} size={32} />
                        <div className="leading-tight">
                          <Link to={`/engagements/${e.id}`} className="text-[13.5px] font-medium text-ink hover:text-accent">{client.name}</Link>
                          <p className="text-[11.5px] text-muted">{client.title} · manager {manager.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="accent">{PHASES.find((p) => p.id === e.phase)!.label}</Badge>
                        <span className="tabular text-[13px] font-semibold text-ink">{score.overall}%</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          {a.atRisk.length > 0 && (
            <Card>
              <CardHeader title="Where to intervene" />
              <CardBody>
                <ul className="space-y-2.5">
                  {a.atRisk.map(({ engagement, reason }) => {
                    const client = userById(db, engagement.clientId)!
                    return (
                      <li key={engagement.id} className="leading-snug">
                        <Link to={`/engagements/${engagement.id}`} className="text-[13px] font-medium text-ink hover:text-accent">{client.name}</Link>
                        <p className="text-[12px] text-[#a12d2d]"><span aria-hidden="true">! </span>{reason}</p>
                      </li>
                    )
                  })}
                </ul>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Reinforcement by manager" />
            <CardBody>
              <BarList
                rows={a.reinforcementByManager.map((m) => ({ label: m.name, value: m.rate, sub: `${m.clients} in coaching` }))}
                max={100}
                suffix="%"
                note="Completed by their due date"
              />
            </CardBody>
          </Card>

          {a.cliftonDomains.length > 0 && (
            <Card>
              <CardHeader title="Strengths shape of the cohort" subtitle="Aggregated · no individual profile" />
              <CardBody>
                <BarList
                  rows={a.cliftonDomains.map((d) => ({ label: d.domain, value: d.count }))}
                  note="Top-five themes per domain"
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Your access" action={<Link to="/settings" className="text-[12.5px] font-medium text-accent hover:underline">Settings →</Link>} />
            <CardBody className="space-y-1.5 text-[12.5px] leading-snug text-ink-2">
              <p><span className="font-medium text-ink">Visible</span> — engagement status, goals, progress, reinforcement, released reports.</p>
              <p><span className="font-medium text-ink">Withheld</span> — 360 responses and comments, Enneagram, session notes.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
