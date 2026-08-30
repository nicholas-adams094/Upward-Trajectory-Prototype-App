import { useState } from 'react'
import { useViewer } from '../../../auth/AuthContext'
import { useDb } from '../../../data/store'
import {
  acknowledgeHandover, closeEngagement, reopenEngagement, setEngagementStatus, setPhase,
} from '../../../data/actions'
import { can, reportFor } from '../../../lib/permissions'
import {
  commitmentStats, engagementScore, formatDate, goalProgress, goalsFor, measureProgress,
  relativeDays, todayIso, userById,
} from '../../../lib/metrics'
import { PHASES } from '../../../types'
import type { Engagement, Phase } from '../../../types'
import {
  Badge, Button, Card, CardBody, CardHeader, Field, Meter, Modal, ScoreBreakdown, StatTile,
  StatusPill, inputClass,
} from '../../../components/ui/primitives'

export function Overview({ engagement }: { engagement: Engagement }) {
  const db = useDb()
  const viewer = useViewer()
  const report = reportFor(db, engagement.id)
  const ctx = { viewer, engagement, report }

  const score = engagementScore(db, engagement)
  const goals = goalsFor(db, engagement.id)
  const measures = measureProgress(goals)
  const handover = db.handovers.find((h) => h.engagementId === engagement.id)
  const [closing, setClosing] = useState(false)
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
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Assessment inputs" value={score.assessment} unit="%" foot="Self, 360, Clifton & Enneagram" />
          <StatTile
            label="Plan movement"
            value={score.plan}
            unit="%"
            foot={measures.total ? `${measures.met} of ${measures.total} measures met` : goals.length ? `${goals.length} goal${goals.length > 1 ? 's' : ''}` : 'No plan yet'}
          />
          <StatTile
            label="Manager reinforcement"
            value={score.hasReinforcementData ? score.reinforcement : '—'}
            unit={score.hasReinforcementData ? '%' : undefined}
            tone={managerStats.due >= 4 && managerStats.rate < 0.6 ? 'critical' : undefined}
            foot={
              managerStats.due
                ? db.settings.requireReinforcementConfirmation
                  ? `${managerStats.confirmed} of ${managerStats.done} confirmed by the client`
                  : `${managerStats.done} of ${managerStats.due} actions completed`
                : 'No actions due yet'
            }
          />
        </div>

        {handover && (
          <Card>
            <CardHeader
              title="Handover"
              subtitle={`Closed ${formatDate(handover.closedOn)} · review ${formatDate(handover.reviewOn)}`}
              action={
                viewer.role === 'coach'
                  ? <Button size="sm" onClick={() => reopenEngagement(engagement.id, viewer)}>Reopen</Button>
                  : (viewer.role === 'manager' && !handover.acknowledgedByManagerOn)
                      || (viewer.role === 'client' && !handover.acknowledgedByClientOn)
                    ? <Button size="sm" variant="primary" onClick={() => acknowledgeHandover(handover.id, viewer)}>Acknowledge</Button>
                    : <Badge tone="good">Acknowledged</Badge>
              }
            />
            <CardBody className="space-y-3">
              <p className="text-[13.5px] leading-relaxed text-ink">{handover.summary}</p>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">The manager now owns</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{handover.managerOwns}</p>
              </div>
              {handover.carriedGoalIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {handover.carriedGoalIds.map((gid) => (
                    <Badge key={gid}>{goals.find((g) => g.id === gid)?.title ?? 'Goal'}</Badge>
                  ))}
                </div>
              )}
              <p className="text-[12px] text-muted">
                Manager {handover.acknowledgedByManagerOn ? `acknowledged ${formatDate(handover.acknowledgedByManagerOn)}` : 'not yet acknowledged'} ·{' '}
                client {handover.acknowledgedByClientOn ? `acknowledged ${formatDate(handover.acknowledgedByClientOn)}` : 'not yet acknowledged'}
              </p>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Sponsor goal" />
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
          <CardHeader title="Activity" />
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
        <Card>
          <CardHeader title="Progress" />
          <CardBody>
            <ScoreBreakdown overall={score.overall} components={score.components} />
          </CardBody>
        </Card>

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
            <CardHeader title="Commitment follow-through" />
            <CardBody className="space-y-4">
              <Meter label="Client commitments" value={clientStats.rate * 100} />
              <Meter label="Manager reinforcement" value={managerStats.rate * 100} />
              {db.settings.requireReinforcementConfirmation && managerStats.done > 0 && (
                <Meter label="Confirmed by the client" value={managerStats.confirmedRate * 100} tone="series" />
              )}
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
            <CardHeader title="Manage" />
            <CardBody className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-ink-2">Phase</span>
                <select
                  value={engagement.phase}
                  disabled={engagement.status === 'complete'}
                  onChange={(e) => setPhase(engagement.id, e.target.value as Phase, viewer)}
                  className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13.5px] disabled:opacity-50"
                >
                  {PHASES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-medium text-ink-2">Status</span>
                <select
                  value={engagement.status}
                  onChange={(e) => {
                    const next = e.target.value
                    if (next === 'complete') setClosing(true)
                    else if (engagement.status === 'complete') reopenEngagement(engagement.id, viewer)
                    else setEngagementStatus(engagement.id, next as 'active' | 'paused', viewer)
                  }}
                  className="w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13.5px]"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="complete">Complete</option>
                </select>
              </label>
              {engagement.status !== 'complete' && (
                <Button className="w-full" onClick={() => setClosing(true)}>Close & hand over</Button>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {closing && <CloseModal engagement={engagement} onClose={() => setClosing(false)} />}
    </div>
  )
}

function CloseModal({ engagement, onClose }: { engagement: Engagement; onClose: () => void }) {
  const db = useDb()
  const viewer = useViewer()
  const goals = goalsFor(db, engagement.id)
  const manager = userById(db, engagement.managerId)
  const [summary, setSummary] = useState('')
  const [managerOwns, setManagerOwns] = useState('')
  const [carried, setCarried] = useState<string[]>(goals.filter((g) => g.status !== 'achieved').map((g) => g.id))
  const [reviewOn, setReviewOn] = useState(
    new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
  )

  return (
    <Modal
      open
      title="Close and hand over"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!summary.trim() || !managerOwns.trim()}
            onClick={() => {
              closeEngagement({
                engagementId: engagement.id, carriedGoalIds: carried,
                summary: summary.trim(), managerOwns: managerOwns.trim(), reviewOn,
              }, viewer)
              onClose()
            }}
          >
            Close engagement
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Where they landed">
          <textarea className={inputClass} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <Field label={`What ${manager?.name ?? 'the manager'} carries on`}>
          <textarea className={inputClass} rows={3} value={managerOwns} onChange={(e) => setManagerOwns(e.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-[12.5px] font-medium text-ink-2">Goals that stay live</p>
          <ul className="space-y-1.5">
            {goals.map((g) => (
              <li key={g.id}>
                <label className="flex items-center gap-2.5 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    className="h-6 w-6 shrink-0 accent-[var(--color-accent)]"
                    checked={carried.includes(g.id)}
                    onChange={(e) => setCarried(
                      e.target.checked ? [...carried, g.id] : carried.filter((x) => x !== g.id),
                    )}
                  />
                  {g.title}
                  <StatusPill status={g.status} />
                </label>
              </li>
            ))}
          </ul>
        </div>
        <Field label="Review date">
          <input className={inputClass} type="date" value={reviewOn} onChange={(e) => setReviewOn(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
