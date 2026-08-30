import { Link } from 'react-router-dom'
import { useViewer } from '../auth/AuthContext'
import { useDb } from '../data/store'
import { visibleEngagements } from '../lib/permissions'
import { engagementScore, orgAnalytics, userById } from '../lib/metrics'
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

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title="Coaching portfolio"
        subtitle="Whether the investment is producing behaviour change — and where it is stalling — without reading anybody's coaching notes."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Leaders in coaching" value={a.engagements} foot={`${a.active} active engagements`} />
        <StatTile label="Average progress" value={a.avgProgress} unit="%" foot="Inputs collected, synthesised, behaviour moved" />
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
          foot="The single best predictor of whether coaching sticks"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Competency movement"
              subtitle="Where the cohort started against where it is now, averaged across every goal targeting that competency."
            />
            <CardBody>
              {a.competencyMovement.length ? (
                <GapChart
                  rows={a.competencyMovement.map((m) => ({ label: m.competency.name, a: m.baseline, b: m.latest }))}
                  aLabel="Baseline"
                  bLabel="Latest"
                  note="1–5 against shared behavioural anchors. The right-hand number is the movement."
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
              <CardHeader title="Where to intervene" subtitle="Not a performance list — a list of engagements that need something from you." />
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
            <CardHeader title="Reinforcement by manager" subtitle="Coaching that a manager does not reinforce reliably stalls. This is the number to manage." />
            <CardBody>
              <BarList
                rows={a.reinforcementByManager.map((m) => ({ label: m.name, value: m.rate, sub: `${m.clients} in coaching` }))}
                max={100}
                suffix="%"
                note="Reinforcement actions completed by their due date."
              />
            </CardBody>
          </Card>

          {a.cliftonDomains.length > 0 && (
            <Card>
              <CardHeader title="Strengths shape of the cohort" subtitle="Top-five themes by CliftonStrengths domain, aggregated. No individual profile is shown." />
              <CardBody>
                <BarList
                  rows={a.cliftonDomains.map((d) => ({ label: d.domain, value: d.count }))}
                  note="Counts of top-five themes falling in each domain across the cohort."
                />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="What you cannot see" />
            <CardBody className="space-y-2 text-[12.5px] leading-relaxed text-ink-2">
              <p>Individual 360 responses, written comments, Enneagram narratives, coaching session notes and the coach&rsquo;s private notes are never available to HR — by design, not by omission.</p>
              <p>Reports appear here only where the coach has explicitly released that version to HR.</p>
              <Link to="/access" className="inline-block font-medium text-accent hover:underline">The full matrix →</Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
