import { useViewer } from '../../../auth/AuthContext'
import { useDb } from '../../../data/store'
import { can, reportFor } from '../../../lib/permissions'
import { competencyRollup, formatDate, suppressedGroups } from '../../../lib/metrics'
import { DOMAIN_BLURB, DOMAIN_ORDER } from '../../../lib/frameworks'
import { RELATIONSHIP_LABELS } from '../../../types'
import type { Engagement, Relationship } from '../../../types'
import { Badge, Card, CardBody, CardHeader, EmptyState, Restricted, ScrollableTable } from '../../../components/ui/primitives'
import { GapChart } from '../../../components/charts'

const GROUPS: Relationship[] = ['manager', 'peer', 'direct_report', 'stakeholder']

export function Feedback({ engagement }: { engagement: Engagement }) {
  const db = useDb()
  const viewer = useViewer()
  const report = reportFor(db, engagement.id)
  const ctx = { viewer, engagement, report }

  const rollup = competencyRollup(db, engagement.id)
  const hasData = rollup.some((r) => r.others !== null)
  const suppressed = suppressedGroups(db, engagement.id)

  const assessmentIds = db.assessments.filter((a) => a.engagementId === engagement.id).map((a) => a.id)
  const responses = db.responses.filter((r) => assessmentIds.includes(r.assessmentId) && r.relationship !== 'self')

  const clifton = db.clifton.find((c) => c.engagementId === engagement.id)
  const enneagram = db.enneagram.find((c) => c.engagementId === engagement.id)

  if (!hasData) {
    return <EmptyState title="No 360 results yet" body="Results appear here once at least one rater has submitted. Groups with fewer than two responses stay suppressed." />
  }

  const biggest = [...rollup].filter((r) => r.gap !== null).sort((a, b) => Math.abs(b.gap!) - Math.abs(a.gap!))[0]

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Self-perception against the organisation"
          subtitle="Each row is one competency. The distance between the two dots is the gap the coaching works on."
        />
        <CardBody>
          <GapChart
            rows={rollup.map((r) => ({ label: r.competency.name, a: r.self, b: r.others }))}
            aLabel="Self-rating"
            bLabel="Everyone else"
            note="Ratings are 1–5 against shared behavioural anchors. The right-hand number is the gap."
          />
          {biggest && (
            <p className="mt-4 rounded-lg border border-hairline bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">Largest gap: {biggest.competency.name}.</span>{' '}
              {biggest.gap! > 0
                ? `The organisation rates this ${biggest.gap!.toFixed(1)} higher than the client does — a strength they are not yet using deliberately.`
                : `The client rates this ${Math.abs(biggest.gap!).toFixed(1)} higher than the organisation does — the blind spot to work on first.`}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="By rater group"
          subtitle="Where the cost of a behaviour actually lands. The manager column is attributed by design; every other group needs at least two responses before it is shown."
        />
        <CardBody>
          <ScrollableTable hint="Scroll the table sideways to see every rater group.">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-hairline text-[11.5px] uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Competency</th>
                <th className="py-2 pr-3 text-right font-medium">Self</th>
                {GROUPS.map((g) => (
                  <th key={g} className="py-2 pr-3 text-right font-medium">{RELATIONSHIP_LABELS[g]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rollup.map((r) => (
                <tr key={r.competency.id} className="border-b border-hairline/60 last:border-0">
                  <td className="py-2 pr-3 text-ink">{r.competency.name}</td>
                  <td className="tabular py-2 pr-3 text-right text-ink-2">{r.self?.toFixed(1) ?? '—'}</td>
                  {GROUPS.map((g) => {
                    const v = r.byGroup[g]
                    const low = v !== undefined && v < 3
                    return (
                      <td key={g} className={`tabular py-2 pr-3 text-right ${low ? 'font-semibold text-[#a12d2d]' : 'text-ink'}`}>
                        {v !== undefined ? v.toFixed(1) : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollableTable>
          {suppressed.length > 0 && (
            <p className="mt-3 text-[12.5px] leading-snug text-muted">
              <span aria-hidden="true">🔒 </span>
              {suppressed.map((s) => RELATIONSHIP_LABELS[s]).join(' and ')} suppressed — fewer than two responses in the group.
            </p>
          )}
        </CardBody>
      </Card>

      {can('feedback360.verbatims', ctx) ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Keep doing" subtitle="Verbatim, unattributed." />
            <CardBody>
              <ul className="space-y-3">
                {responses.map((r) => (
                  <li key={`k-${r.id}`} className="border-l-2 border-hairline pl-3 text-[13px] leading-relaxed text-ink-2">
                    &ldquo;{r.keepDoing}&rdquo;
                    {viewer.role === 'coach' && (
                      <span className="mt-1 block text-[11.5px] text-muted">
                        {db.respondents.find((x) => x.id === r.respondentId)?.name} · {RELATIONSHIP_LABELS[r.relationship]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Do more of" subtitle="Verbatim, unattributed." />
            <CardBody>
              <ul className="space-y-3">
                {responses.map((r) => (
                  <li key={`d-${r.id}`} className="border-l-2 border-hairline pl-3 text-[13px] leading-relaxed text-ink-2">
                    &ldquo;{r.doMoreOf}&rdquo;
                    {viewer.role === 'coach' && (
                      <span className="mt-1 block text-[11.5px] text-muted">
                        {db.respondents.find((x) => x.id === r.respondentId)?.name} · {RELATIONSHIP_LABELS[r.relationship]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      ) : (
        <Restricted
          what="Written 360 comments"
          why="Verbatim comments stay between the coach and the client. What matters for reinforcement is carried into the report's 'do more of' section instead."
        />
      )}

      {clifton && can('clifton', ctx) && (
        <Card>
          <CardHeader title="CliftonStrengths — top 5" subtitle={`Recorded ${formatDate(clifton.recordedOn)}`} />
          <CardBody>
            <ol className="space-y-2.5">
              {clifton.themes.map((t) => (
                <li key={t.rank} className="flex items-center gap-3">
                  <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12.5px] font-semibold text-[#3730a3]">{t.rank}</span>
                  <span className="text-[14px] font-medium text-ink">{t.theme}</span>
                  <Badge>{t.domain}</Badge>
                </li>
              ))}
            </ol>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {DOMAIN_ORDER.filter((d) => clifton.themes.some((t) => t.domain === d)).map((d) => (
                <div key={d} className="rounded-lg border border-hairline bg-surface-2 px-3 py-2.5">
                  <p className="text-[12.5px] font-semibold text-ink">
                    {d} <span className="tabular font-normal text-muted">×{clifton.themes.filter((t) => t.domain === d).length}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{DOMAIN_BLURB[d]}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {enneagram && can('enneagram', ctx) && (
        <Card>
          <CardHeader
            title={`Enneagram — Type ${enneagram.type}, ${enneagram.typeName}`}
            subtitle={`Wing ${enneagram.wing} · recorded ${formatDate(enneagram.recordedOn)}`}
            action={<Badge tone="accent">Coach & client only</Badge>}
          />
          <CardBody className="space-y-3 text-[13px] leading-relaxed">
            {[
              ['Core motivation', enneagram.coreMotivation],
              ['Under stress', enneagram.underStress],
              ['In growth', enneagram.inGrowth],
              ['Leadership blind spot', enneagram.blindSpot],
            ].map(([label, body]) => (
              <div key={label}>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-0.5 text-ink-2">{body}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {enneagram && !can('enneagram', ctx) && (
        <Restricted
          what="The Enneagram narrative"
          why="Personality type is worked with in the coaching room, not shared upward. Its behavioural implications appear in the report's watch-outs, which you do see."
        />
      )}
    </div>
  )
}
