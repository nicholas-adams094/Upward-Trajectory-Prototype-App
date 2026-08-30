import { useMemo, useState } from 'react'
import { useViewer } from '../auth/AuthContext'
import { resetDemoData, useDb } from '../data/store'
import { updateSettings } from '../data/actions'
import {
  DEFAULT_SETTINGS, DEFAULT_VISIBILITY, RESOURCE_GROUPS, RESOURCE_LABELS, RISKY_CELLS, isLocked,
} from '../lib/permissions'
import { MIN_GROUP, ROLE_LABELS, formatDate } from '../lib/metrics'
import { ROLES } from '../types'
import type { Cadence, Resource, Role, VisibilityLevel, VisibilityMatrix } from '../types'
import {
  Badge, Button, Card, CardBody, CardHeader, Field, PageHeader, ScrollableTable, Tabs, inputClass,
} from '../components/ui/primitives'

const LEVELS: { id: VisibilityLevel; label: string; short: string }[] = [
  { id: 'full', label: 'Always', short: 'Always' },
  { id: 'shared', label: 'On release', short: 'On release' },
  { id: 'none', label: 'Never', short: 'Never' },
]

const CADENCE_LABEL: Record<Cadence, string> = {
  once: 'One-off', weekly: 'Weekly', biweekly: 'Fortnightly', monthly: 'Monthly',
}

const sameMatrix = (a: VisibilityMatrix, b: VisibilityMatrix) =>
  JSON.stringify(a) === JSON.stringify(b)

export function Settings() {
  const db = useDb()
  const viewer = useViewer()
  const isCoach = viewer.role === 'coach'
  const [tab, setTab] = useState<'access' | 'measurement' | 'coaching' | 'data'>('access')

  const tabs = [
    { id: 'access' as const, label: 'Access' },
    { id: 'measurement' as const, label: 'Measurement' },
    { id: 'coaching' as const, label: 'Coaching defaults' },
    { id: 'data' as const, label: 'Demo data' },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        subtitle={
          isCoach
            ? 'Changes apply immediately, to every screen and every signed-in role.'
            : `Read-only. ${ROLE_LABELS[viewer.role]}s cannot change portal settings.`
        }
        actions={
          db.settings.updatedOn ? (
            <Badge>Last changed {formatDate(db.settings.updatedOn)}</Badge>
          ) : undefined
        }
      />

      <div className="mb-5">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'access' && <AccessSettings editable={isCoach} />}
      {tab === 'measurement' && <MeasurementSettings editable={isCoach} />}
      {tab === 'coaching' && <CoachingSettings editable={isCoach} />}
      {tab === 'data' && <DataSettings />}
    </>
  )
}

/* ----------------------------------------------------------------- access */

function AccessSettings({ editable }: { editable: boolean }) {
  const db = useDb()
  const viewer = useViewer()
  const matrix = db.settings.visibility

  const warnings = useMemo(
    () => RISKY_CELLS.filter((c) => matrix[c.resource][c.role] !== 'none'),
    [matrix],
  )
  const changed = !sameMatrix(matrix, DEFAULT_VISIBILITY)

  const set = (resource: Resource, role: Role, level: VisibilityLevel) => {
    updateSettings({ visibility: { ...matrix, [resource]: { ...matrix[resource], [role]: level } } }, viewer)
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Who sees what"
          subtitle={editable ? undefined : 'Only the coach can change these.'}
          action={
            editable && changed ? (
              <Button size="sm" onClick={() => updateSettings({ visibility: DEFAULT_VISIBILITY }, viewer)}>
                Restore defaults
              </Button>
            ) : undefined
          }
        />
        <CardBody className="space-y-6">
          {RESOURCE_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">{group.title}</h3>
              <ScrollableTable>
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="w-[38%] py-2 pr-4 text-[11.5px] font-semibold uppercase tracking-wide text-muted">Data</th>
                      {ROLES.map((r) => (
                        <th key={r} className={`py-2 pr-3 text-[11.5px] font-semibold uppercase tracking-wide ${r === viewer.role ? 'text-ink' : 'text-muted'}`}>
                          {ROLE_LABELS[r]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.resources.map((resource) => (
                      <tr key={resource} className="border-b border-hairline/60 last:border-0">
                        <td className="py-2 pr-4 text-[13px] text-ink">{RESOURCE_LABELS[resource]}</td>
                        {ROLES.map((role) => {
                          const locked = isLocked(resource, role)
                          const value = matrix[resource][role]
                          const risky = RISKY_CELLS.some((c) => c.resource === resource && c.role === role) && value !== 'none'
                          return (
                            <td key={role} className={`py-2 pr-3 ${role === viewer.role ? 'bg-accent-soft/40' : ''}`}>
                              {locked || !editable ? (
                                <LevelReadout value={value} locked={locked} />
                              ) : (
                                <select
                                  className={`w-full min-w-[104px] rounded-lg border bg-surface px-2 py-1.5 text-[12.5px] focus:border-accent focus:outline-none ${
                                    risky ? 'border-[#e0a3a3] text-[#a12d2d]' : 'border-hairline text-ink'
                                  }`}
                                  value={value}
                                  aria-label={`${RESOURCE_LABELS[resource]} — ${ROLE_LABELS[role]}`}
                                  onChange={(e) => set(resource, role, e.target.value as VisibilityLevel)}
                                >
                                  {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.short}</option>)}
                                </select>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="What the levels mean" />
          <CardBody className="space-y-2.5 text-[13px] text-ink-2">
            <p><span className="font-semibold text-ink">Always</span> — visible whenever that role opens the engagement.</p>
            <p><span className="font-semibold text-ink">On release</span> — visible only once the coach publishes the report to that role.</p>
            <p><span className="font-semibold text-ink">Never</span> — not rendered, at any point.</p>
            <p className="pt-1 text-[12.5px] text-muted">
              Locked cells cannot be changed: the coach owns the engagement record, and raw 360
              responses would identify the raters.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Confidentiality warnings"
            action={<Badge tone={warnings.length ? 'critical' : 'good'}>{warnings.length || 'None'}</Badge>}
          />
          <CardBody>
            {warnings.length ? (
              <ul className="space-y-2.5">
                {warnings.map((w) => (
                  <li key={`${w.resource}-${w.role}`} className="text-[13px] leading-snug">
                    <span className="font-semibold text-[#a12d2d]">{RESOURCE_LABELS[w.resource]} → {ROLE_LABELS[w.role]}</span>
                    <span className="mt-0.5 block text-ink-2">{w.warning}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-2">Nothing here breaks the coaching contract.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function LevelReadout({ value, locked }: { value: VisibilityLevel; locked: boolean }) {
  const cfg = {
    full: { icon: '●', className: 'text-[#0a6b0a]' },
    shared: { icon: '◐', className: 'text-[#8a5b00]' },
    none: { icon: '○', className: 'text-muted' },
  }[value]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${cfg.className}`}>
      <span aria-hidden="true">{cfg.icon}</span>
      {LEVELS.find((l) => l.id === value)!.label}
      {locked ? <span className="text-muted" title="Locked" aria-label="Locked">🔒</span> : null}
    </span>
  )
}

/* ------------------------------------------------------------ measurement */

function MeasurementSettings({ editable }: { editable: boolean }) {
  const db = useDb()
  const viewer = useViewer()
  const s = db.settings

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="360 anonymity" />
        <CardBody className="space-y-4">
          <Field
            label="Minimum responses before a rater group is shown"
            hint={`Manager ratings are attributed by design and are always shown. ${MIN_GROUP} is the industry floor.`}
          >
            <select
              className={inputClass}
              disabled={!editable}
              value={s.minGroup}
              onChange={(e) => updateSettings({ minGroup: Number(e.target.value) }, viewer)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n} response{n === 1 ? '' : 's'}</option>
              ))}
            </select>
          </Field>
          {s.minGroup < MIN_GROUP && (
            <p className="rounded-lg border border-[#f2cccc] bg-[#fbeaea] px-3 py-2.5 text-[12.5px] leading-snug text-[#a12d2d]">
              Below {MIN_GROUP}, a rater in a two-person group can subtract their own score from the
              group mean and read their colleague&rsquo;s.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Report release" />
        <CardBody className="space-y-3">
          <p className="text-[12.5px] text-muted">Roles pre-selected when the coach publishes a report.</p>
          {ROLES.filter((r) => r !== 'coach').map((role) => (
            <label key={role} className="flex items-center gap-2.5 text-[13.5px] text-ink">
              <input
                type="checkbox"
                className="h-6 w-6 accent-[var(--color-accent)]"
                disabled={!editable || role === 'client'}
                checked={role === 'client' || s.defaultReportAudience.includes(role)}
                onChange={(e) => updateSettings({
                  defaultReportAudience: e.target.checked
                    ? [...s.defaultReportAudience, role]
                    : s.defaultReportAudience.filter((r) => r !== role),
                }, viewer)}
              />
              {ROLE_LABELS[role]}
              {role === 'client' && <span className="text-[12px] text-muted">always</span>}
            </label>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}

/* --------------------------------------------------------------- coaching */

function CoachingSettings({ editable }: { editable: boolean }) {
  const db = useDb()
  const viewer = useViewer()
  const s = db.settings

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Plan defaults" />
        <CardBody className="space-y-4">
          <Field label="Default cadence for a new manager commitment">
            <select
              className={inputClass}
              disabled={!editable}
              value={s.defaultManagerCadence}
              onChange={(e) => updateSettings({ defaultManagerCadence: e.target.value as Cadence }, viewer)}
            >
              {(['once', 'weekly', 'biweekly', 'monthly'] as Cadence[]).map((c) => (
                <option key={c} value={c}>{CADENCE_LABEL[c]}</option>
              ))}
            </select>
          </Field>
          <Field label="Days until a new commitment is due">
            <input
              className={inputClass}
              type="number"
              min={1}
              max={60}
              disabled={!editable}
              value={s.commitmentLeadDays}
              onChange={(e) => updateSettings({ commitmentLeadDays: Math.max(1, Number(e.target.value)) }, viewer)}
            />
          </Field>
          <Field label="Weeks from a new goal to its target date">
            <input
              className={inputClass}
              type="number"
              min={1}
              max={52}
              disabled={!editable}
              value={s.goalHorizonWeeks}
              onChange={(e) => updateSettings({ goalHorizonWeeks: Math.max(1, Number(e.target.value)) }, viewer)}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Reinforcement" />
        <CardBody className="space-y-3">
          <label className="flex items-start gap-2.5 text-[13.5px] text-ink">
            <input
              type="checkbox"
              className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-accent)]"
              disabled={!editable}
              checked={s.requireReinforcementConfirmation}
              onChange={(e) => updateSettings({ requireReinforcementConfirmation: e.target.checked }, viewer)}
            />
            <span>
              Ask the client to confirm reinforcement their manager records
              <span className="mt-0.5 block text-[12.5px] text-muted">
                Dashboards then report confirmed follow-through alongside claimed.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------- data */

function DataSettings() {
  const db = useDb()
  const counts: [string, number][] = [
    ['Engagements', db.engagements.length],
    ['People', db.users.length],
    ['360 responses', db.responses.length],
    ['Goals', db.goals.length],
    ['Commitments', db.actions.length],
    ['Check-ins', db.checkIns.length],
  ]
  const isDefault = JSON.stringify(db.settings) === JSON.stringify({
    ...DEFAULT_SETTINGS, updatedOn: db.settings.updatedOn, updatedBy: db.settings.updatedBy,
  })

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="This browser" subtitle="Everything you change is stored locally and never leaves this device." />
        <CardBody>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {counts.map(([label, n]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-hairline/60 pb-2">
                <dt className="text-[13px] text-ink-2">{label}</dt>
                <dd className="tabular text-[14px] font-semibold text-ink">{n}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Reset" action={<Badge tone={isDefault ? 'neutral' : 'warning'}>{isDefault ? 'Defaults' : 'Customised'}</Badge>} />
        <CardBody className="space-y-3">
          <p className="text-[13px] text-ink-2">
            Restores the seeded engagements, plans and settings. Anything you have entered is lost.
          </p>
          <Button
            variant="danger"
            onClick={() => { if (confirm('Reset all demo data and settings to their seeded state?')) resetDemoData() }}
          >
            Reset demo data
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
