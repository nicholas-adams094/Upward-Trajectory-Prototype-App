import { useState } from 'react'
import { useViewer } from '../../../auth/AuthContext'
import { useDb } from '../../../data/store'
import { addCheckIn } from '../../../data/actions'
import { ROLE_LABELS, formatDate, goalProgress, goalsFor, userById } from '../../../lib/metrics'
import { can, reportFor } from '../../../lib/permissions'
import { RATING_ANCHORS } from '../../../lib/frameworks'
import type { Engagement } from '../../../types'
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Modal, StatTile, inputClass,
} from '../../../components/ui/primitives'
import { TrendChart } from '../../../components/charts'

export function Progress({ engagement }: { engagement: Engagement }) {
  const db = useDb()
  const viewer = useViewer()
  const [checkingIn, setCheckingIn] = useState(false)

  const report = reportFor(db, engagement.id)
  const showNotes = can('checkins.notes', { viewer, engagement, report })
  const goals = goalsFor(db, engagement.id)
  const progress = goals.map((g) => goalProgress(g, db.checkIns))
  const canCheckIn = viewer.role === 'coach' || viewer.id === engagement.clientId || viewer.id === engagement.managerId

  if (!goals.length) {
    return <EmptyState title="Nothing to track yet" body="Progress is measured against the coaching plan. Once goals exist, every check-in from the coach, the client and the manager plots here." />
  }

  const series = progress.map((p) => ({
    id: p.goal.id,
    label: p.goal.title,
    target: p.goal.target,
    points: p.checkIns.map((c) => ({ date: c.date, value: c.rating })),
  }))

  const recent = db.checkIns
    .filter((c) => c.engagementId === engagement.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 12)

  const totalMovement = progress.reduce((s, p) => s + (p.latest - p.goal.baseline), 0) / progress.length
  const achieved = goals.filter((g) => g.status === 'achieved').length

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Average movement" value={`${totalMovement >= 0 ? '+' : ''}${totalMovement.toFixed(1)}`} foot="Points on the 1–5 scale since baseline" tone={totalMovement > 0 ? 'good' : undefined} />
        <StatTile label="Goals achieved" value={`${achieved}/${goals.length}`} foot="Hit or passed their target rating" />
        <StatTile label="Check-ins logged" value={db.checkIns.filter((c) => c.engagementId === engagement.id).length} foot="From the coach, the client and the manager" />
      </div>

      <Card>
        <CardHeader
          title="Movement over time"
          subtitle="Every goal, every check-in. The dashed line is that goal's target."
          action={canCheckIn ? <Button size="sm" variant="primary" onClick={() => setCheckingIn(true)}>Add a check-in</Button> : undefined}
        />
        <CardBody>
          <TrendChart series={series} note="Ratings use the same 1–5 behavioural anchors as the 360, so a check-in is directly comparable to the baseline." />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recent check-ins" subtitle={showNotes ? 'Logged by the person doing it, the person managing them, and the coach.' : 'Ratings only — what was written on a check-in stays in the coaching relationship.'} />
        <CardBody>
          <ul className="divide-y divide-hairline">
            {recent.map((c) => {
              const goal = goals.find((g) => g.id === c.goalId)
              const by = userById(db, c.byUserId)
              return (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-ink">{goal?.title ?? 'Goal'}</p>
                    {showNotes ? <p className="text-[12.5px] leading-snug text-ink-2">{c.note}</p> : null}
                    <p className="mt-0.5 text-[11.5px] text-muted">{by?.name ?? 'Unknown'} · {ROLE_LABELS[c.byRole]} · {formatDate(c.date)}</p>
                  </div>
                  <Badge tone={c.rating >= (goal?.target ?? 4) ? 'good' : c.rating < (goal?.baseline ?? 0) + 0.5 ? 'serious' : 'neutral'}>
                    {c.rating.toFixed(1)}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </CardBody>
      </Card>

      {checkingIn && <CheckInModal engagement={engagement} onClose={() => setCheckingIn(false)} />}
    </div>
  )
}

function CheckInModal({ engagement, onClose }: { engagement: Engagement; onClose: () => void }) {
  const db = useDb()
  const viewer = useViewer()
  const goals = goalsFor(db, engagement.id)
  const [goalId, setGoalId] = useState(goals[0]?.id ?? '')
  const [rating, setRating] = useState(3)
  const [note, setNote] = useState('')
  const goal = goals.find((g) => g.id === goalId)

  return (
    <Modal
      open
      title="Add a check-in"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!goalId}
            onClick={() => { addCheckIn({ goalId, engagementId: engagement.id, rating, note }, viewer); onClose() }}
          >
            Log check-in
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] leading-relaxed text-ink-2">
        You are logging this as <span className="font-medium text-ink">{viewer.name}</span> ({ROLE_LABELS[viewer.role].toLowerCase()}).
        Everyone&rsquo;s ratings sit on the same chart — the disagreement between them is often the useful part.
      </p>
      <div className="space-y-4">
        <Field label="Goal">
          <select className={inputClass} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </Field>
        {goal && (
          <p className="rounded-lg border border-hairline bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-ink-2">
            Baseline <span className="tabular font-semibold text-ink">{goal.baseline.toFixed(1)}</span> ·
            target <span className="tabular font-semibold text-ink">{goal.target.toFixed(1)}</span>
          </p>
        )}
        <Field label={`Rating today — ${rating.toFixed(1)}`} hint={RATING_ANCHORS[Math.round(rating)]}>
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)]"
          />
        </Field>
        <Field label="What did you actually see?" hint="Behaviour, not impression.">
          <textarea className={inputClass} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
