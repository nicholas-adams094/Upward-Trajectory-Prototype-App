import { useState } from 'react'
import { useViewer } from '../../../auth/AuthContext'
import { useDb } from '../../../data/store'
import { addAction, addGoal, setActionStatus } from '../../../data/actions'
import { can, reportFor } from '../../../lib/permissions'
import {
  commitmentStats, formatDate, formatShort, goalProgress, goalsFor, relativeDays, todayIso,
} from '../../../lib/metrics'
import type { Action, Cadence, Engagement, Goal } from '../../../types'
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Meter, Modal, Restricted,
  StatusPill, inputClass,
} from '../../../components/ui/primitives'
import { Sparkline } from '../../../components/charts'

const CADENCE_LABEL: Record<Cadence, string> = { once: 'One-off', weekly: 'Weekly', biweekly: 'Fortnightly', monthly: 'Monthly' }

export function Plan({ engagement }: { engagement: Engagement }) {
  const db = useDb()
  const viewer = useViewer()
  const report = reportFor(db, engagement.id)
  const ctx = { viewer, engagement, report }
  const [newGoal, setNewGoal] = useState(false)
  const [newAction, setNewAction] = useState<Goal | null>(null)

  const goals = goalsFor(db, engagement.id)
  const isCoach = viewer.role === 'coach'
  const isManager = viewer.id === engagement.managerId
  const isClient = viewer.id === engagement.clientId
  const showActions = can('plan.actions', ctx)

  if (!goals.length) {
    return (
      <>
        <EmptyState
          title="The coaching plan has not been built yet"
          body="The plan turns the report's 'what we need more of' into named goals, each with behavioural measures, weekly commitments for the client and reinforcement actions for their manager."
          action={isCoach ? <Button variant="primary" onClick={() => setNewGoal(true)}>Add the first goal</Button> : undefined}
        />
        {newGoal && <GoalModal engagement={engagement} onClose={() => setNewGoal(false)} />}
      </>
    )
  }

  return (
    <div className="space-y-5">
      {isManager && (
        <div className="rounded-xl border border-hairline bg-accent-soft/60 px-4 py-3.5">
          <p className="text-[13.5px] font-semibold text-ink">Your part of the plan</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            An hour a week with a coach does not change behaviour on its own. The reinforcement actions
            below are yours — they are what turn a coaching goal into something the team actually
            experiences.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-[12.5px] leading-relaxed text-muted">
          Every goal is rated on the same 1–5 behavioural anchors as the 360. The baseline is the
          observed starting point for that specific behaviour, agreed at the report debrief — it is
          narrower than the competency&rsquo;s 360 average, which covers the whole competency.
        </p>
        {isCoach && <Button variant="primary" size="sm" onClick={() => setNewGoal(true)}>Add a goal</Button>}
      </div>

      {goals.map((goal) => {
        const p = goalProgress(goal, db.checkIns)
        const actions = db.actions.filter((a) => a.goalId === goal.id)
        const clientActions = collapse(actions.filter((a) => a.owner === 'client'))
        const managerActions = collapse(actions.filter((a) => a.owner === 'manager'))
        const competency = db.competencies.find((c) => c.id === goal.competencyId)

        return (
          <Card key={goal.id}>
            <CardHeader
              title={goal.title}
              subtitle={goal.description}
              action={<StatusPill status={goal.status} />}
            />
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[220px] flex-1">
                  <Meter label={`${goal.baseline.toFixed(1)} → ${p.latest.toFixed(1)} of ${goal.target.toFixed(1)}`} value={p.pct * 100} tone="series" />
                </div>
                <Sparkline values={p.checkIns.map((c) => c.rating)} />
                <div className="flex flex-wrap gap-2">
                  {competency && <Badge>{competency.name}</Badge>}
                  <Badge tone={p.momentum >= 0 ? 'good' : 'serious'}>
                    <span aria-hidden="true">{p.momentum >= 0 ? '↗' : '↘'}</span>
                    {p.momentum >= 0 ? '+' : ''}{p.momentum.toFixed(1)} over 4 check-ins
                  </Badge>
                  <Badge>Target {formatDate(goal.targetDate)}</Badge>
                </div>
              </div>

              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">How we will know it worked</h3>
                <ul className="mt-1.5 space-y-1">
                  {goal.measures.map((m, mi) => (
                    <li key={mi} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                      <span className="mt-0.5 shrink-0 text-muted" aria-hidden="true">□</span>{m}
                    </li>
                  ))}
                </ul>
              </div>

              {showActions ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <ActionColumn
                    title="Client commitments"
                    subtitle={`${Math.round(commitmentStats(actions, 'client').rate * 100)}% follow-through`}
                    actions={clientActions}
                    canTick={isClient || isCoach}
                    onAdd={isCoach ? () => setNewAction(goal) : undefined}
                  />
                  <ActionColumn
                    title="Manager reinforcement"
                    subtitle={`${Math.round(commitmentStats(actions, 'manager').rate * 100)}% follow-through`}
                    actions={managerActions}
                    canTick={isManager || isCoach}
                    onAdd={isCoach ? () => setNewAction(goal) : undefined}
                    highlight={isManager}
                  />
                </div>
              ) : (
                <Restricted
                  what="Individual commitments"
                  why="HR sees the goals and the movement against them. The week-to-week commitments stay between the client, their manager and the coach."
                />
              )}
            </CardBody>
          </Card>
        )
      })}

      {newGoal && <GoalModal engagement={engagement} onClose={() => setNewGoal(false)} />}
      {newAction && <ActionModal goal={newAction} onClose={() => setNewAction(null)} />}
    </div>
  )
}

/** Recurring actions repeat weekly; show the live one plus the recent history. */
function collapse(actions: Action[]) {
  return [...actions].sort((a, b) => (a.dueOn < b.dueOn ? 1 : -1)).slice(0, 6)
}

function ActionColumn({
  title, subtitle, actions, canTick, onAdd, highlight,
}: {
  title: string
  subtitle: string
  actions: Action[]
  canTick: boolean
  onAdd?: () => void
  highlight?: boolean
}) {
  const viewer = useViewer()
  return (
    <div className={`rounded-lg border px-3.5 py-3 ${highlight ? 'border-accent/40 bg-accent-soft/40' : 'border-hairline bg-surface-2'}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-ink">{title}</p>
          <p className="text-[11.5px] text-muted">{subtitle}</p>
        </div>
        {onAdd && <Button size="sm" variant="ghost" onClick={onAdd}>+ Add</Button>}
      </div>
      <ul className="space-y-2">
        {actions.map((a) => {
          const overdue = a.status === 'open' && a.dueOn < todayIso()
          return (
            <li key={a.id} className="flex items-start gap-2.5">
              {a.status === 'skipped' ? (
                <span className="mt-0.5 w-3.5 shrink-0 text-center text-[13px] text-[#a12d2d]" aria-hidden="true">✕</span>
              ) : (
                <input
                  type="checkbox"
                  className="mt-1 shrink-0"
                  checked={a.status === 'done'}
                  disabled={!canTick}
                  onChange={(e) => setActionStatus(a.id, e.target.checked ? 'done' : 'open', viewer)}
                  aria-label={a.title}
                />
              )}
              <span className="min-w-0 leading-snug">
                <span className={`block text-[13px] ${a.status === 'done' ? 'text-muted line-through' : a.status === 'skipped' ? 'text-muted' : 'text-ink'}`}>{a.title}</span>
                <span className="block text-[11.5px] text-muted">
                  {CADENCE_LABEL[a.cadence]} ·{' '}
                  {a.status === 'done'
                    ? `done ${formatDate(a.completedOn ?? a.dueOn)}`
                    : a.status === 'skipped'
                      ? `missed ${formatShort(a.dueOn)}`
                      : `due ${relativeDays(a.dueOn)}`}
                  {overdue && <span className="ml-1 font-medium text-[#a12d2d]">overdue</span>}
                </span>
                {a.detail && a.status === 'open' && <span className="mt-0.5 block text-[12px] leading-snug text-ink-2">{a.detail}</span>}
              </span>
            </li>
          )
        })}
        {!actions.length && <li className="text-[12.5px] text-muted">Nothing here yet.</li>}
      </ul>
    </div>
  )
}

function GoalModal({ engagement, onClose }: { engagement: Engagement; onClose: () => void }) {
  const db = useDb()
  const viewer = useViewer()
  const report = db.reports.find((r) => r.engagementId === engagement.id)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [competencyId, setCompetencyId] = useState(db.competencies[0].id)
  const [baseline, setBaseline] = useState(2.5)
  const [target, setTarget] = useState(4)
  const [measures, setMeasures] = useState('')

  return (
    <Modal
      open
      title="Add a coaching goal"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!title.trim() || target <= baseline}
            onClick={() => {
              addGoal({
                engagementId: engagement.id, title: title.trim(), description, competencyId,
                baseline, target,
                targetDate: new Date(Date.now() + 42 * 86_400_000).toISOString().slice(0, 10),
                measures: measures.split('\n').map((m) => m.trim()).filter(Boolean),
              }, viewer)
              onClose()
            }}
          >
            Add goal
          </Button>
        </>
      }
    >
      {report && report.doMoreOf.length > 0 && (
        <div className="mb-4 rounded-lg border border-hairline bg-surface-2 px-3.5 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">From the report — what we need more of</p>
          <ul className="mt-1.5 space-y-1">
            {report.doMoreOf.map((d) => (
              <li key={d}>
                <button className="text-left text-[12.5px] leading-snug text-accent hover:underline" onClick={() => setDescription(d)}>
                  {d}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-4">
        <Field label="Goal"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Give away three whole outcomes" /></Field>
        <Field label="What this means in practice">
          <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Competency">
          <select className={inputClass} value={competencyId} onChange={(e) => setCompetencyId(e.target.value)}>
            {db.competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Baseline" hint="Where the 360 put them today.">
            <input className={inputClass} type="number" min={1} max={5} step={0.1} value={baseline} onChange={(e) => setBaseline(Number(e.target.value))} />
          </Field>
          <Field label="Target" hint="Where good looks like at close.">
            <input className={inputClass} type="number" min={1} max={5} step={0.1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </Field>
        </div>
        {target <= baseline && (
          <p className="text-[12.5px] text-[#a12d2d]">The target must be above the baseline, or progress can never be shown.</p>
        )}
        <Field label="How we will know it worked" hint="One measure per line.">
          <textarea className={inputClass} rows={3} value={measures} onChange={(e) => setMeasures(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function ActionModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const viewer = useViewer()
  const [owner, setOwner] = useState<Action['owner']>('client')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [cadence, setCadence] = useState<Cadence>('weekly')

  return (
    <Modal
      open
      title={`Add a commitment — ${goal.title}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!title.trim()}
            onClick={() => {
              addAction({
                goalId: goal.id, engagementId: goal.engagementId, owner, title: title.trim(), detail, cadence,
                dueOn: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
              }, viewer)
              onClose()
            }}
          >
            Add commitment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Owner" hint="Manager actions are the reinforcement that happens between coaching sessions.">
          <select className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value as Action['owner'])}>
            <option value="client">Client</option>
            <option value="manager">Manager</option>
            <option value="coach">Coach</option>
          </select>
        </Field>
        <Field label="Commitment"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Detail"><textarea className={inputClass} rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} /></Field>
        <Field label="Cadence">
          <select className={inputClass} value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
            {(['once', 'weekly', 'biweekly', 'monthly'] as Cadence[]).map((c) => (
              <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  )
}
