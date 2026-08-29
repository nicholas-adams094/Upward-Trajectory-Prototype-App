import { Card, CardBody, CardHeader, PageHeader, ScrollableTable } from '../components/ui/primitives'
import { RESOURCE_LABELS, VISIBILITY_MATRIX } from '../lib/permissions'
import { ROLE_LABELS } from '../lib/metrics'
import type { Role } from '../types'
import { useViewer } from '../auth/AuthContext'

const ROLES: Role[] = ['coach', 'client', 'manager', 'hr']

function Cell({ value }: { value: 'full' | 'shared' | 'none' }) {
  const cfg = {
    full: { icon: '●', label: 'Yes', className: 'text-[#0a6b0a]' },
    shared: { icon: '◐', label: 'When released', className: 'text-[#8a5b00]' },
    none: { icon: '○', label: 'No', className: 'text-muted' },
  }[value]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${cfg.className}`}>
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

export function AccessModel() {
  const viewer = useViewer()

  return (
    <>
      <PageHeader
        eyebrow="Confidentiality"
        title="Who sees what"
        subtitle="The portal is shared by four audiences with genuinely different rights. Every screen in this app checks this matrix before it renders — nothing is hidden by convention alone."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title="Visibility matrix" subtitle={`You are signed in as a ${ROLE_LABELS[viewer.role].toLowerCase()}. Your column is highlighted.`} />
          <CardBody>
            <ScrollableTable hint="Scroll the table sideways to see every role.">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="py-2 pr-4 text-[11.5px] font-semibold uppercase tracking-wide text-muted">Data</th>
                  {ROLES.map((r) => (
                    <th
                      key={r}
                      className={`py-2 pr-4 text-[11.5px] font-semibold uppercase tracking-wide ${r === viewer.role ? 'text-ink' : 'text-muted'}`}
                    >
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VISIBILITY_MATRIX.map((row) => (
                  <tr key={row.resource} className="border-b border-hairline/60 last:border-0">
                    <td className="py-2.5 pr-4 text-[13px] text-ink">{RESOURCE_LABELS[row.resource]}</td>
                    {ROLES.map((r) => (
                      <td key={r} className={`py-2.5 pr-4 ${r === viewer.role ? 'bg-accent-soft/40' : ''}`}>
                        <Cell value={row.roles[r]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </ScrollableTable>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="The three rules behind the matrix" />
            <CardBody className="space-y-4 text-[13px] leading-relaxed text-ink-2">
              <div>
                <p className="font-semibold text-ink">1. Raw feedback stays in the coaching room.</p>
                <p className="mt-1">Individual 360 responses are only ever seen by the coach. The client gets the roll-up and the unattributed comments. Rater groups with fewer than two responses are suppressed so a single peer can never be identified by arithmetic — the manager column is the deliberate exception, because a rating from your manager is attributed by design.</p>
              </div>
              <div>
                <p className="font-semibold text-ink">2. Nothing travels upward until the coach releases it.</p>
                <p className="mt-1">The synthesis report is a draft until published, and publishing names exactly who it goes to. A manager or HR partner sees the strengths language and the plan only once the coach has shared that version.</p>
              </div>
              <div>
                <p className="font-semibold text-ink">3. Progress is shared; the process is not.</p>
                <p className="mt-1">Managers and HR see goals, commitments and movement over time — the things they need in order to reinforce. Session notes, the Enneagram narrative and the coach&rsquo;s private notes never leave the coach–client relationship.</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Why the manager column matters" />
            <CardBody className="text-[13px] leading-relaxed text-ink-2">
              Coaching fails when it is an hour a week with an outsider. The manager column is
              deliberately generous on the plan and deliberately closed on the coaching — enough to
              reinforce the behaviour every day, not enough to turn the coaching into a performance
              review.
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
