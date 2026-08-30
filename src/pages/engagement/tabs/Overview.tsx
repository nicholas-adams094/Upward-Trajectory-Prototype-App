import { useViewer } from '../../../auth/AuthContext'
import { useDb } from '../../../data/store'
import { setPhase } from '../../../data/actions'
import { can, reportFor } from '../../../lib/permissions'
import {
  commitmentStats, engagementScore, formatDate, goalProgress, goalsFor, relativeDays, todayIso, userById,
} from '../../../lib/metrics'
import { PHASES } from '../../../types'
import type { Engagement, Phase } from '../../../types'
import { Card, CardBody, CardHeader, Meter, StatTile, StatusPill } from '../../../components/ui/primitives'

export function Overview({ engagement }: { engagement: Engagement }) {
  const db = useDb()
  const viewer = useViewer()
  const report = reportFor(db, engagement.id)
  const ctx = { viewer, engagement, report }

  const score = engagementScore(db, engagement)
  const goals = goalsFor(db, engagement.id)
  const actions = db.actions.filter((a) => a.engagementId === engagement.id)
  const clientStats = commitmentStats(actions, 'client')
  const managerStats = commitmentStats(actions, 'manager')
  const nextSession = db.sessions
    .filter((s) => s.engagementId === engagement.id && s.status === 'scheduled' && s.date >= todayIso())
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0]
  // Every event kind maps to the resource it describes, so the feed cannot
  // become a side channel around the rest of the model.
  const ACTIVITY_RESOURCE = {
    assessment: 'assessment.status',
    report: 'report',
    plan: 'plan.goals',
    session: 'session.shared',
    checkin: 'checkins',
    action: 'plan.actions',
    system: 'engagement.summary',
  } as const
  const activity = db.activity
    .filter((a) => a.engagementId === engagement.id && can(ACTIVITY_RESOURCE[a.kind], ctx))
    .slice(0, 8)

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Assessment inputs" value={score.assessment} unit="%" foot="Self, 360, Clifton & Enneagram" />
          <StatTile
            label="Plan movement"
            value={score.plan}
            unit="%"
            foot={goals.length ? `${goals.length} goal${goals.length > 1 ? 's' : ''} in the plan` : 'No plan yet'}
          />
          <StatTile
            label="Manager reinforcement"
            value={score.hasReinforcementData ? score.reinforcement : '—'}
            unit={score.hasReinforcementData ? '%' : undefined}
            tone={managerStats.due >= 4 && managerStats.rate < 0.6 ? 'critical' : undefined}
            foot={managerStats.due ? `${managerStats.done} of ${managerStats.due} actions completed` : 'No actions due yet'}
          />
        </div>

        <Card>
          <CardHeader title="The sponsor goal" subtitle="Agreed in the three-way at contracting. Everything downstream is measured against this." />
          <CardBody>
            <p className="text-[14px] leading-relaxed text-ink">{engagement.sponsorGoal}</p>
            <p className="mt-3 text-[12.5px] text-muted">
              Target close {formatDate(engagement.targetEndOn)} · {relativeDays(engagement.targetEndOn)}
            </p>
          </CardBody>
        </Card>

        {goals.length > 0 && (
          <Card>
            <CardHeader title="Goals at a glance" />
            <CardBody className="space-y-4">
              {goals.map((g) => {
                const p = goalProgress(g, db.checkIns)
                return (
                  <div key={g.id}>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13.5px] font-medium text-ink">{g.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="tabular text-[12px] text-ink-2">{g.baseline.toFixed(1)} → {p.latest.toFixed(1)} <span className="text-muted">(target {g.target.toFixed(1)})</span></span>
                        <StatusPill status={g.status} />
                      </div>
                    </div>
                    <Meter value={p.pct * 100} tone="series" />
                  </div>
                )
              })}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Activity" subtitle="Everything that has happened on this engagement, newest first." />
          <CardBody>
            <ol className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span className="min-w-0 leading-snug">
                    <span className="block text-[13px] text-ink">{a.summary}</span>
                    <span className="block text-[11.5px] text-muted">
                      {formatDate(a.at)} · {userById(db, a.actorId)?.name ?? 'System'}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        {nextSession && can('session.shared', ctx) && (
          <Card>
            <CardHeader title="Next coaching session" />
            <CardBody>
              <p className="text-[15px] font-semibold text-ink">{formatDate(nextSession.date)}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-2">{relativeDays(nextSession.date)} · {nextSession.durationMin} minutes</p>
            </CardBody>
          </Card>
        )}

        {can('plan.actions', ctx) && (
          <Card>
            <CardHeader title="Commitment follow-through" subtitle="Behaviour change happens between the sessions." />
            <CardBody className="space-y-4">
              <Meter label="Client commitments" value={clientStats.rate * 100} />
              <Meter label="Manager reinforcement" value={managerStats.rate * 100} />
              {managerStats.overdue > 0 && (
                <p className="text-[12.5px] leading-snug text-[#a12d2d]">
                  <span aria-hidden="true">! </span>
                  {managerStats.overdue} manager action{managerStats.overdue > 1 ? 's are' : ' is'} past due.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {viewer.role === 'coach' && (
          <Card>
            <CardHeader title="Move the engagement" subtitle="Coach only." />
            <CardBody>
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-ink-2">Current phase</span>
                <select
                  value={engagement.phase}
                  onChange={(e) => setPhase(engagement.id, e.target.value as Phase, viewer)}
                  className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13.5px]"
                >
                  {PHASES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-[12px] leading-snug text-muted">{PHASES[score.phaseIndex].blurb}</p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
