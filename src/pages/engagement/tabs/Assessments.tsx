import { useState } from 'react'
import { useViewer } from '../../../auth/AuthContext'
import { useDb } from '../../../data/store'
import {
  inviteRespondent, saveClifton, saveEnneagram, submitFeedback, submitSelfEvaluation,
} from '../../../data/actions'
import { CLIFTON_THEMES, DOMAIN_BLURB, DOMAIN_ORDER, ENNEAGRAM_TYPES } from '../../../lib/frameworks'
import { formatDate, relativeDays, todayIso } from '../../../lib/metrics'
import { can, reportFor } from '../../../lib/permissions'
import { ASSESSMENT_LABELS, RELATIONSHIP_LABELS } from '../../../types'
import type { AssessmentKind, CliftonTheme, Engagement, Ratings, Relationship } from '../../../types'
import {
  Badge, Button, Card, CardBody, CardHeader, Field, Modal, Restricted, StatusPill, inputClass,
} from '../../../components/ui/primitives'
import { RatingScale } from '../../../components/ui/RatingScale'

const KIND_BLURB: Record<AssessmentKind, string> = {
  self: 'How the client rates themselves against the same eight competencies their raters use.',
  feedback360: 'Structured ratings and written comments from the manager, peers, direct reports and key stakeholders.',
  clifton: 'The top five CliftonStrengths themes and their domains.',
  enneagram: 'Type, wing, core motivation and the stress and growth paths.',
}

export function Assessments({ engagement }: { engagement: Engagement }) {
  const db = useDb()
  const viewer = useViewer()
  const report = reportFor(db, engagement.id)
  const ctx = { viewer, engagement, report }
  const [modal, setModal] = useState<null | { kind: 'self' | 'clifton' | 'enneagram' | 'invite' } | { kind: 'rate'; respondentId: string }>(null)

  const assessments = db.assessments.filter((a) => a.engagementId === engagement.id)
  const a360 = assessments.find((a) => a.kind === 'feedback360')
  const raters = a360 ? db.respondents.filter((r) => r.assessmentId === a360.id) : []
  const submitted = raters.filter((r) => r.status === 'submitted').length

  const isClient = viewer.id === engagement.clientId
  const isCoach = viewer.role === 'coach'

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {assessments.map((a) => {
          const overdue = a.status !== 'complete' && a.dueOn < todayIso()
          return (
            <Card key={a.id}>
              <CardHeader
                title={ASSESSMENT_LABELS[a.kind]}
                subtitle={KIND_BLURB[a.kind]}
                action={<StatusPill status={a.status} />}
              />
              <CardBody>
                <p className={`text-[12.5px] ${overdue ? 'font-medium text-[#a12d2d]' : 'text-ink-2'}`}>
                  {a.status === 'complete'
                    ? `Completed ${formatDate(a.completedOn!)}`
                    : `${overdue ? 'Overdue — was due' : 'Due'} ${formatDate(a.dueOn)} (${relativeDays(a.dueOn)})`}
                </p>

                {a.kind === 'feedback360' && (
                  <p className="mt-2 text-[12.5px] text-ink-2">
                    <span className="tabular font-semibold text-ink">{submitted}</span> of{' '}
                    <span className="tabular font-semibold text-ink">{raters.length}</span> raters in
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {a.kind === 'self' && (isClient || isCoach) && (
                    <Button variant="primary" size="sm" onClick={() => setModal({ kind: 'self' })}>
                      {a.status === 'complete' ? 'Review answers' : 'Complete self-evaluation'}
                    </Button>
                  )}
                  {a.kind === 'clifton' && (isClient || isCoach) && (
                    <Button variant={a.status === 'complete' ? 'secondary' : 'primary'} size="sm" onClick={() => setModal({ kind: 'clifton' })}>
                      {a.status === 'complete' ? 'Edit top 5' : 'Enter top 5'}
                    </Button>
                  )}
                  {a.kind === 'enneagram' && (isClient || isCoach) && (
                    <Button variant={a.status === 'complete' ? 'secondary' : 'primary'} size="sm" onClick={() => setModal({ kind: 'enneagram' })}>
                      {a.status === 'complete' ? 'Edit result' : 'Enter result'}
                    </Button>
                  )}
                  {a.kind === 'feedback360' && isCoach && (
                    <Button variant="primary" size="sm" onClick={() => setModal({ kind: 'invite' })}>Invite a rater</Button>
                  )}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {a360 && (
        <Card>
          <CardHeader
            title="360 rater panel"
            subtitle={
              isCoach
                ? 'Only you see who said what. Chase the outstanding raters from here.'
                : 'You can see how many responses are in, not who they came from.'
            }
          />
          <CardBody>
            {isCoach ? (
              <ul className="divide-y divide-hairline">
                {raters.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink">{r.name}</p>
                      <p className="text-[12px] text-muted">{RELATIONSHIP_LABELS[r.relationship]} · {r.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.status === 'submitted' ? (
                        <Badge tone="good"><span aria-hidden="true">✓</span> Submitted {formatDate(r.submittedOn!)}</Badge>
                      ) : (
                        <>
                          <Badge tone="warning"><span aria-hidden="true">◑</span> Awaiting response</Badge>
                          <Button size="sm" onClick={() => setModal({ kind: 'rate', respondentId: r.id })}>Open their form</Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
                {raters.length === 0 && <p className="py-3 text-[13px] text-ink-2">No raters invited yet.</p>}
              </ul>
            ) : (
              <div className="grid gap-3 sm:grid-cols-4">
                {(['manager', 'peer', 'direct_report', 'stakeholder'] as Relationship[]).map((rel) => {
                  const group = raters.filter((r) => r.relationship === rel)
                  const done = group.filter((r) => r.status === 'submitted').length
                  return (
                    <div key={rel} className="rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
                      <p className="text-[12px] text-muted">{RELATIONSHIP_LABELS[rel]}</p>
                      <p className="tabular mt-0.5 text-[18px] font-semibold text-ink">{done}<span className="text-[13px] text-ink-2">/{group.length}</span></p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {!can('feedback360.rollup', ctx) && (
        <Restricted
          what="360 results"
          why="Scores are released to managers only once the coach publishes the synthesis report, and never in a form that identifies an individual rater."
        />
      )}

      {modal?.kind === 'self' && <SelfEvalModal engagement={engagement} onClose={() => setModal(null)} />}
      {modal?.kind === 'clifton' && <CliftonModal engagement={engagement} onClose={() => setModal(null)} />}
      {modal?.kind === 'enneagram' && <EnneagramModal engagement={engagement} onClose={() => setModal(null)} />}
      {modal?.kind === 'invite' && a360 && <InviteModal assessmentId={a360.id} onClose={() => setModal(null)} />}
      {modal?.kind === 'rate' && <RaterModal respondentId={modal.respondentId} onClose={() => setModal(null)} />}
    </div>
  )
}

/* ---------------------------------------------------------------- modals */

function SelfEvalModal({ engagement, onClose }: { engagement: Engagement; onClose: () => void }) {
  const db = useDb()
  const viewer = useViewer()
  const assessment = db.assessments.find((a) => a.engagementId === engagement.id && a.kind === 'self')
  const respondent = db.respondents.find((r) => r.assessmentId === assessment?.id && r.relationship === 'self')
  const existing = db.responses.find((r) => r.respondentId === respondent?.id)

  const [ratings, setRatings] = useState<Ratings>(existing?.ratings ?? {})
  const [keepDoing, setKeepDoing] = useState(existing?.keepDoing ?? '')
  const [doMoreOf, setDoMoreOf] = useState(existing?.doMoreOf ?? '')
  const complete = db.competencies.every((c) => ratings[c.id])

  return (
    <Modal
      open
      title="Self-evaluation"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!complete}
            onClick={() => { submitSelfEvaluation(engagement.id, ratings, keepDoing, doMoreOf, viewer); onClose() }}
          >
            Submit self-evaluation
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] leading-relaxed text-ink-2">
        Rate yourself against the same eight competencies your raters are using. The gap between these
        numbers and theirs is usually the most useful thing in the whole report.
      </p>
      <RatingScale competencies={db.competencies} value={ratings} onChange={setRatings} />
      <div className="mt-5 space-y-4">
        <Field label="What should you keep doing?">
          <textarea className={inputClass} rows={3} value={keepDoing} onChange={(e) => setKeepDoing(e.target.value)} />
        </Field>
        <Field label="What do you need to do more of?">
          <textarea className={inputClass} rows={3} value={doMoreOf} onChange={(e) => setDoMoreOf(e.target.value)} />
        </Field>
      </div>
      {!complete && <p className="mt-3 text-[12.5px] text-[#a12d2d]">Rate all eight competencies to submit.</p>}
    </Modal>
  )
}

function RaterModal({ respondentId, onClose }: { respondentId: string; onClose: () => void }) {
  const db = useDb()
  const respondent = db.respondents.find((r) => r.id === respondentId)!
  const [ratings, setRatings] = useState<Ratings>({})
  const [keepDoing, setKeepDoing] = useState('')
  const [doMoreOf, setDoMoreOf] = useState('')
  const complete = db.competencies.every((c) => ratings[c.id])

  return (
    <Modal
      open
      title={`360 feedback — ${respondent.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!complete} onClick={() => { submitFeedback(respondentId, ratings, keepDoing, doMoreOf); onClose() }}>
            Submit response
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-lg border border-hairline bg-surface-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-2">
        In production this form lives behind a one-time link emailed to the rater. Your name is never
        attached to a score anyone but the coach sees, and your written comments are shared unattributed.
      </p>
      <RatingScale competencies={db.competencies} value={ratings} onChange={setRatings} />
      <div className="mt-5 space-y-4">
        <Field label="What should they keep doing?">
          <textarea className={inputClass} rows={3} value={keepDoing} onChange={(e) => setKeepDoing(e.target.value)} />
        </Field>
        <Field label="What do you need them to do more of?">
          <textarea className={inputClass} rows={3} value={doMoreOf} onChange={(e) => setDoMoreOf(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function CliftonModal({ engagement, onClose }: { engagement: Engagement; onClose: () => void }) {
  const db = useDb()
  const viewer = useViewer()
  const existing = db.clifton.find((c) => c.engagementId === engagement.id)
  const [picks, setPicks] = useState<string[]>(existing?.themes.map((t) => t.theme) ?? ['', '', '', '', ''])

  const themes: CliftonTheme[] = picks
    .map((theme, i) => {
      const found = CLIFTON_THEMES.find((t) => t.theme === theme)
      return found ? { rank: i + 1, theme: found.theme, domain: found.domain } : null
    })
    .filter((t): t is CliftonTheme => t !== null)

  return (
    <Modal
      open
      title="CliftonStrengths — top 5"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={themes.length !== 5} onClick={() => { saveClifton(engagement.id, themes, viewer); onClose() }}>
            Save top 5
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] leading-relaxed text-ink-2">
        Enter the top five themes from the Gallup report, in rank order. The portal groups them into the
        four domains so the shape of the profile is visible at a glance.
      </p>
      <div className="space-y-3">
        {picks.map((pick, i) => (
          <Field key={i} label={`Theme ${i + 1}`}>
            <select
              className={inputClass}
              value={pick}
              onChange={(e) => setPicks(picks.map((p, j) => (j === i ? e.target.value : p)))}
            >
              <option value="">Select a theme…</option>
              {DOMAIN_ORDER.map((domain) => (
                <optgroup key={domain} label={domain}>
                  {CLIFTON_THEMES.filter((t) => t.domain === domain).map((t) => (
                    <option key={t.theme} value={t.theme} disabled={picks.includes(t.theme) && picks[i] !== t.theme}>
                      {t.theme}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        ))}
      </div>
      {themes.length === 5 && (
        <div className="mt-4 rounded-lg border border-hairline bg-surface-2 px-3.5 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Domain shape</p>
          <ul className="mt-1.5 space-y-1">
            {DOMAIN_ORDER.map((d) => {
              const n = themes.filter((t) => t.domain === d).length
              return n ? (
                <li key={d} className="text-[12.5px] text-ink-2">
                  <span className="font-medium text-ink">{d}</span> ×{n} — {DOMAIN_BLURB[d]}
                </li>
              ) : null
            })}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function EnneagramModal({ engagement, onClose }: { engagement: Engagement; onClose: () => void }) {
  const db = useDb()
  const viewer = useViewer()
  const existing = db.enneagram.find((c) => c.engagementId === engagement.id)
  const [type, setType] = useState(existing?.type ?? 0)
  const [wing, setWing] = useState(existing?.wing ?? '')
  const [coreMotivation, setCore] = useState(existing?.coreMotivation ?? '')
  const [underStress, setStress] = useState(existing?.underStress ?? '')
  const [inGrowth, setGrowth] = useState(existing?.inGrowth ?? '')
  const [blindSpot, setBlind] = useState(existing?.blindSpot ?? '')
  const meta = ENNEAGRAM_TYPES.find((t) => t.type === type)

  return (
    <Modal
      open
      title="Enneagram result"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!type}
            onClick={() => {
              saveEnneagram(engagement.id, {
                type, typeName: meta?.name ?? '', wing, coreMotivation: coreMotivation || meta?.motivation || '',
                underStress, inGrowth, blindSpot,
              }, viewer)
              onClose()
            }}
          >
            Save result
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type">
          <select className={inputClass} value={type || ''} onChange={(e) => setType(Number(e.target.value))}>
            <option value="">Select a type…</option>
            {ENNEAGRAM_TYPES.map((t) => (
              <option key={t.type} value={t.type}>Type {t.type} — {t.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Wing" hint="e.g. 3w2">
          <input className={inputClass} value={wing} onChange={(e) => setWing(e.target.value)} />
        </Field>
        <Field label="Core motivation" hint={meta ? `Default for this type: ${meta.motivation}` : undefined}>
          <textarea className={inputClass} rows={2} value={coreMotivation} onChange={(e) => setCore(e.target.value)} placeholder={meta?.motivation} />
        </Field>
        <Field label="Under stress">
          <textarea className={inputClass} rows={2} value={underStress} onChange={(e) => setStress(e.target.value)} />
        </Field>
        <Field label="In growth">
          <textarea className={inputClass} rows={2} value={inGrowth} onChange={(e) => setGrowth(e.target.value)} />
        </Field>
        <Field label="Leadership blind spot" hint="The behavioural implication the coaching plan will work on.">
          <textarea className={inputClass} rows={2} value={blindSpot} onChange={(e) => setBlind(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function InviteModal({ assessmentId, onClose }: { assessmentId: string; onClose: () => void }) {
  const viewer = useViewer()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [relationship, setRelationship] = useState<'manager' | 'peer' | 'direct_report' | 'stakeholder'>('peer')

  return (
    <Modal
      open
      title="Invite a 360 rater"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !email.trim()}
            onClick={() => { inviteRespondent(assessmentId, { name: name.trim(), email: email.trim(), relationship }, viewer); onClose() }}
          >
            Send invitation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Relationship to the client" hint="Groups with fewer than two responses are suppressed in the roll-up so no individual rater can be identified.">
          <select className={inputClass} value={relationship} onChange={(e) => setRelationship(e.target.value as typeof relationship)}>
            <option value="manager">Manager</option>
            <option value="peer">Peer</option>
            <option value="direct_report">Direct report</option>
            <option value="stakeholder">Stakeholder</option>
          </select>
        </Field>
      </div>
    </Modal>
  )
}
