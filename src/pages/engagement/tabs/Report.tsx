import { useState } from 'react'
import { useViewer } from '../../../auth/AuthContext'
import { useDb } from '../../../data/store'
import { createDraftReport, publishReport, saveReport, unpublishReport } from '../../../data/actions'
import { can, reportFor } from '../../../lib/permissions'
import { ROLE_LABELS, competencyRollup, formatDate } from '../../../lib/metrics'
import type { Engagement, ReportTheme, Role, SynthesisReport } from '../../../types'
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Modal, Restricted, StatusPill, inputClass,
} from '../../../components/ui/primitives'

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

const AUDIENCE_WORD: Record<Role, string> = {
  client: 'the client',
  manager: 'their manager',
  hr: 'HR',
  coach: 'the coach',
}

function audienceLabel(roles: Role[]) {
  const parts = (['client', 'manager', 'hr'] as Role[]).filter((r) => roles.includes(r)).map((r) => AUDIENCE_WORD[r])
  if (parts.length <= 1) return parts[0] ?? 'nobody yet'
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function Report({ engagement }: { engagement: Engagement }) {
  const db = useDb()
  const viewer = useViewer()
  const report = reportFor(db, engagement.id)
  const ctx = { viewer, engagement, report }
  const isCoach = viewer.role === 'coach'
  const [editing, setEditing] = useState(false)
  const [publishing, setPublishing] = useState(false)

  if (!report) {
    return isCoach ? (
      <EmptyState
        title="No synthesis report yet"
        body="Once the assessments are in, the report is where the 360, the self-evaluation, CliftonStrengths and the Enneagram become one story the client can act on."
        action={<Button variant="primary" onClick={() => createDraftReport(engagement.id, viewer)}>Start the report</Button>}
      />
    ) : (
      <EmptyState title="The report is still being written" body="Your coach synthesises every assessment into a single report. It appears here as soon as it is published." />
    )
  }

  if (!can('report', ctx)) {
    return (
      <Restricted
        what="The synthesis report"
        why={
          report.status === 'draft'
            ? 'The report is still in draft. Nothing is released beyond the client until the coach publishes it and names who it goes to.'
            : `This version has been released to ${report.sharedWith.filter((r) => r !== 'client').map((r) => ROLE_LABELS[r]).join(' and ') || 'the client only'}.`
        }
      />
    )
  }

  // Everyone but the coach reads what was released, not the working draft.
  const released = report.published
  const view = isCoach ? report : released
  if (!view) {
    return viewer.id === engagement.clientId ? (
      <EmptyState
        title="Your coach is still writing this"
        body="The report pulls your 360, your self-evaluation, your CliftonStrengths and your Enneagram into one picture. It appears here as soon as your coach publishes it."
      />
    ) : (
      <Restricted
        what="The synthesis report"
        why="This report has not been released in its current form. Nothing reaches you until the coach publishes a version and names its audience."
      />
    )
  }
  const hasUnpublishedEdits =
    isCoach && report.status === 'published' && released !== undefined &&
    JSON.stringify([report.headline, report.signatureStrengths, report.doMoreOf, report.watchOuts, report.themes]) !==
      JSON.stringify([released.headline, released.signatureStrengths, released.doMoreOf, released.watchOuts, released.themes])

  const rollup = competencyRollup(db, engagement.id)
  const topGaps = rollup.filter((r) => r.gap !== null).sort((a, b) => Math.abs(b.gap!) - Math.abs(a.gap!)).slice(0, 3)

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={`Synthesis report — version ${report.version}`}
          subtitle={
            report.status === 'published'
              ? `Published ${formatDate(report.publishedOn!)} · shared with ${audienceLabel(report.sharedWith)}`
              : `Draft · last edited ${formatDate(report.updatedOn)}`
          }
          action={
            <div className="no-print flex items-center gap-2">
              {hasUnpublishedEdits && <Badge tone="warning"><span aria-hidden="true">✎</span> Unpublished edits</Badge>}
              <StatusPill status={report.status} />
              {isCoach && <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>}
              {isCoach && <Button size="sm" variant="primary" onClick={() => setPublishing(true)}>
                {report.status === 'published' ? 'Re-publish' : 'Publish'}
              </Button>}
            </div>
          }
        />
        <CardBody className="space-y-6">
          {view.headline && (
            <p className="border-l-2 border-accent pl-4 text-[17px] font-medium leading-snug text-ink">{view.headline}</p>
          )}

          <Section title="Signature strengths" items={view.signatureStrengths} tone="good" />
          <Section title="What we need more of" items={view.doMoreOf} tone="accent" />
          <Section title="Watch-outs" items={view.watchOuts} tone="warning" />

          {view.themes.length > 0 && can('report.evidence', ctx) && (
            <div>
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Themes in the evidence</h3>
              <div className="mt-3 space-y-5">
                {view.themes.map((t, ti) => (
                  <article key={ti}>
                    <h4 className="text-[15px] font-semibold text-ink">{t.title}</h4>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{t.narrative}</p>
                    <ul className="mt-2 space-y-1.5">
                      {t.evidence.map((ev, ei) => (
                        <li key={ei} className="border-l-2 border-hairline pl-3 text-[12.5px] italic leading-relaxed text-ink-2">{ev}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {topGaps.length > 0 && can('feedback360.rollup', ctx) && (
        <Card>
          <CardHeader title="The numbers behind the narrative" subtitle="The three largest gaps between self-perception and how the organisation experiences them." />
          <CardBody>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {topGaps.map((g) => (
                <li key={g.competency.id} className="rounded-lg border border-hairline bg-surface-2 px-3.5 py-3">
                  <p className="text-[13px] font-medium text-ink">{g.competency.name}</p>
                  <p className="tabular mt-1 text-[22px] font-semibold leading-none text-ink">
                    {g.gap! > 0 ? '+' : ''}{g.gap!.toFixed(1)}
                  </p>
                  <p className="mt-1 text-[11.5px] text-muted">self {g.self?.toFixed(1)} · others {g.others?.toFixed(1)}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {editing && <EditModal report={report} onClose={() => setEditing(false)} />}
      {publishing && <PublishModal report={report} onClose={() => setPublishing(false)} />}
    </div>
  )
}

function Section({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'accent' | 'warning' }) {
  if (!items.length) return null
  const bullet = { good: '✓', accent: '↗', warning: '!' }[tone]
  const color = { good: 'text-[#0a6b0a]', accent: 'text-accent', warning: 'text-[#8a5b00]' }[tone]
  return (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-2">
            <span className={`mt-0.5 shrink-0 font-semibold ${color}`} aria-hidden="true">{bullet}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EditModal({ report, onClose }: { report: SynthesisReport; onClose: () => void }) {
  const [headline, setHeadline] = useState(report.headline)
  const [strengths, setStrengths] = useState(report.signatureStrengths.join('\n'))
  const [doMore, setDoMore] = useState(report.doMoreOf.join('\n'))
  const [watch, setWatch] = useState(report.watchOuts.join('\n'))
  const [themes, setThemes] = useState<ReportTheme[]>(report.themes)

  const setTheme = (i: number, patch: Partial<ReportTheme>) =>
    setThemes(themes.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  return (
    <Modal
      open
      title="Edit the synthesis report"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              saveReport({
                ...report,
                headline,
                signatureStrengths: lines(strengths),
                doMoreOf: lines(doMore),
                watchOuts: lines(watch),
                themes: themes.filter((t) => t.title.trim()),
              })
              onClose()
            }}
          >
            Save draft
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Headline" hint="One sentence the client will remember six months from now.">
          <textarea className={inputClass} rows={2} value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </Field>
        <Field label="Signature strengths" hint="One per line.">
          <textarea className={inputClass} rows={4} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
        </Field>
        <Field label="What we need more of" hint="One per line. These become the coaching plan goals.">
          <textarea className={inputClass} rows={4} value={doMore} onChange={(e) => setDoMore(e.target.value)} />
        </Field>
        <Field label="Watch-outs" hint="One per line.">
          <textarea className={inputClass} rows={3} value={watch} onChange={(e) => setWatch(e.target.value)} />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-ink-2">Themes</span>
            <Button size="sm" onClick={() => setThemes([...themes, { title: '', narrative: '', evidence: [] }])}>Add theme</Button>
          </div>
          <div className="space-y-4">
            {themes.map((t, i) => (
              <div key={i} className="rounded-lg border border-hairline p-3">
                <input className={inputClass} placeholder="Theme title" value={t.title} onChange={(e) => setTheme(i, { title: e.target.value })} />
                <textarea className={`${inputClass} mt-2`} rows={3} placeholder="Narrative" value={t.narrative} onChange={(e) => setTheme(i, { narrative: e.target.value })} />
                <textarea
                  className={`${inputClass} mt-2`}
                  rows={3}
                  placeholder="Evidence — one quote per line"
                  value={t.evidence.join('\n')}
                  onChange={(e) => setTheme(i, { evidence: lines(e.target.value) })}
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="danger" onClick={() => setThemes(themes.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function PublishModal({ report, onClose }: { report: SynthesisReport; onClose: () => void }) {
  const viewer = useViewer()
  const [audience, setAudience] = useState<Role[]>(report.sharedWith.length ? report.sharedWith : ['client'])

  const toggle = (role: Role) =>
    setAudience(audience.includes(role) ? audience.filter((r) => r !== role) : [...audience, role])

  return (
    <Modal
      open
      title={report.status === 'published' ? 'Re-publish the report' : 'Publish the report'}
      onClose={onClose}
      footer={
        <>
          {report.status === 'published' && (
            <Button variant="danger" onClick={() => { unpublishReport(report.id, viewer); onClose() }}>Withdraw to draft</Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => { publishReport(report.id, audience.includes('client') ? audience : ['client', ...audience], viewer); onClose() }}
          >
            {report.status === 'published' ? `Publish version ${report.version + 1}` : 'Publish'}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-ink-2">
        Publishing releases this version to the people you name below. Everyone else keeps seeing nothing.
        You can withdraw it at any time — access is revoked immediately.
      </p>
      <ul className="mt-4 space-y-2">
        {(['client', 'manager', 'hr'] as Role[]).map((role) => (
          <li key={role}>
            <label className="flex items-start gap-3 rounded-lg border border-hairline px-3.5 py-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={role === 'client' || audience.includes(role)}
                disabled={role === 'client'}
                onChange={() => toggle(role)}
              />
              <span className="leading-snug">
                <span className="block text-[13.5px] font-medium text-ink">
                  {ROLE_LABELS[role]}
                  {role === 'client' && <Badge tone="neutral"><span className="ml-1">always</span></Badge>}
                </span>
                <span className="block text-[12.5px] text-ink-2">
                  {role === 'client' && 'The report is theirs. They always receive it.'}
                  {role === 'manager' && 'Sees the strengths, the "do more of" and the watch-outs so they can reinforce. Never the verbatims or the Enneagram.'}
                  {role === 'hr' && 'Sees the report for talent planning. Never the raw feedback or coaching notes.'}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
