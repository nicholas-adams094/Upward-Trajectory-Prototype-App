import { useState } from 'react'
import { useViewer } from '../../../auth/AuthContext'
import { useDb } from '../../../data/store'
import { openFeedbackWave } from '../../../data/actions'
import { can, reportFor } from '../../../lib/permissions'
import { competencyRollup, formatDate, suppressedGroups, waveMovement, waveRounds } from '../../../lib/metrics'
import { DOMAIN_BLURB, DOMAIN_ORDER } from '../../../lib/frameworks'
import { RELATIONSHIP_LABELS } from '../../../types'
import type { Engagement, Relationship } from '../../../types'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Restricted, ScrollableTable, Tabs } from '../../../components/ui/primitives'
import { BarList, GapChart } from '../../../components/charts'

const GROUPS: Relationship[] = ['manager', 'peer', 'direct_report', 'stakeholder']

export function Feedback({ engagement }: { engagement: Engagement }) {
  const db = useDb()
  const viewer = useViewer()
  const report = reportFor(db, engagement.id)
  const ctx = { viewer, engagement, report }

  const isCoach = viewer.role === 'coach'
  // The coach is entitled to the attributed responses themselves, so a floor
  // built to protect raters from everyone else must not hide data from them.
  const floor = isCoach ? 1 : db.settings.minGroup
  const rounds = waveRounds(db, engagement.id)
  const [round, setRound] = useState<number | undefined>(undefined)
  const activeRound = round ?? rounds[0]
  const baselineRound = rounds.length ? rounds[rounds.length - 1] : 1

  const assessmentIds = db.assessments
    .filter((a) => a.engagementId === engagement.id && (a.kind !== 'feedback360' || a.round === activeRound))
    .map((a) => a.id)
  const opts = { minGroup: floor, round: activeRound }
  const rollup = competencyRollup(db, engagement.id, opts)
  const suppressed = suppressedGroups(db, engagement.id, opts)
  const anyResponses = db.responses.some((r) => assessmentIds.includes(r.assessmentId) && r.relationship !== 'self')
  const hasData = rollup.some((r) => r.others !== null || Object.keys(r.byGroup).length > 0)

  const movement = rounds.length > 1 && activeRound !== baselineRound
    ? waveMovement(db, engagement.id, baselineRound, activeRound, { minGroup: floor }).filter((m) => m.delta !== null)
    : []

  const waveSwitcher = rounds.length > 1 ? (
    <div className="mb-5">
      <Tabs
        tabs={rounds.slice().reverse().map((r) => ({
          id: String(r),
          label: db.waves.find((w) => w.round === r)?.label ?? `Wave ${r}`,
        }))}
        active={String(activeRound)}
        onChange={(id) => setRound(Number(id))}
      />
    </div>
  ) : null

  const openWave = db.assessments.find(
    (a) => a.engagementId === engagement.id && a.kind === 'feedback360' && a.status !== 'complete' && a.round > 1,
  )
  const reopen = !isCoach || openWave ? undefined : (
    <Button size="sm" onClick={() => openFeedbackWave(engagement.id, viewer)}>Open a re-measure</Button>
  )
  const openWaveNotice = openWave ? (
    <div className="rounded-xl border border-hairline bg-accent-soft/50 px-4 py-3 text-[13px] text-ink">
      <span className="font-semibold">Re-measure open</span>
      <span className="ml-1.5 text-ink-2">
        {db.respondents.filter((r) => r.assessmentId === openWave.id && r.status === 'submitted').length} of{' '}
        {db.respondents.filter((r) => r.assessmentId === openWave.id).length} raters in · due {formatDate(openWave.dueOn)}
      </span>
    </div>
  ) : null

  // Comments from a suppressed group are as identifying as the scores were —
  // more so, because they carry content. Withhold them on the same rule.
  const responses = db.responses.filter(
    (r) => assessmentIds.includes(r.assessmentId) && r.relationship !== 'self' && !suppressed.includes(r.relationship),
  )
  // Rendering both lists in one order pairs each person's two answers.
  const rotate = <T,>(xs: T[], by: number) => xs.map((_, i) => xs[(i + by) % xs.length])
  const keepDoing = rotate(responses, 1)
  const doMoreOf = rotate(responses, Math.max(1, Math.floor(responses.length / 2)))

  const clifton = db.clifton.find((c) => c.engagementId === engagement.id)
  const enneagram = db.enneagram.find((c) => c.engagementId === engagement.id)

  if (!hasData) {
    return (
      <>
        {waveSwitcher}
        {openWaveNotice}
        {anyResponses ? (
          <EmptyState
            title="Not enough responses to show results yet"
            body={`No rater group has reached ${floor} responses.`}
          />
        ) : (
          <EmptyState title="No 360 results yet" body="Results appear here once raters start submitting." />
        )}
      </>
    )
  }

  const biggest = [...rollup].filter((r) => r.gap !== null).sort((a, b) => Math.abs(b.gap!) - Math.abs(a.gap!))[0]

  return (
    <div className="space-y-5">
      {waveSwitcher}
      {openWaveNotice}

      {movement.length > 0 && (
        <Card>
          <CardHeader
            title="Movement since the baseline"
            subtitle={`Rated by the same room, ${db.waves.find((w) => w.round === baselineRound)?.label ?? 'wave 1'} to ${db.waves.find((w) => w.round === activeRound)?.label ?? `wave ${activeRound}`}`}
            action={reopen}
          />
          <CardBody>
            <BarList
              rows={movement.map((m) => ({
                label: m.competency.name,
                value: m.delta!,
                sub: `${m.from!.toFixed(1)} → ${m.to!.toFixed(1)}`,
              }))}
              max={Math.max(1, ...movement.map((m) => Math.abs(m.delta!)))}
              suffix=""
            />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Self-perception against the organisation"
          action={movement.length === 0 ? reopen : undefined}
        />
        <CardBody>
          <GapChart
            rows={rollup.map((r) => ({ label: r.competency.name, a: r.self, b: r.others }))}
            aLabel="Self-rating"
            bLabel="Everyone else"
            note="1–5 · right-hand number is the gap"
          />
          {biggest && (
            <p className="mt-4 rounded-lg border border-hairline bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
              <span className="font-semibold text-ink">Largest gap: {biggest.competency.name}</span>
              <span className="ml-1.5 tabular">
                {biggest.gap! > 0 ? 'rated higher by others' : 'rated higher by self'} by {Math.abs(biggest.gap!).toFixed(1)}
              </span>
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="By rater group"
          subtitle={`Groups need ${floor} response${floor === 1 ? '' : 's'} to be shown; the manager rating is attributed by design.`}
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
                    // A group nobody was asked to rate reads differently from one
                    // whose scores are being withheld; "—" for both hid that.
                    const held = v === undefined && suppressed.includes(g)
                    return (
                      <td key={g} className={`tabular py-2 pr-3 text-right ${low ? 'font-semibold text-[#a12d2d]' : 'text-ink'}`}>
                        {v !== undefined
                          ? v.toFixed(1)
                          : held
                            ? <span className="text-muted" title="Suppressed — too few responses">🔒</span>
                            : <span className="text-muted" title="Nobody in this group was asked">—</span>}
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
              {suppressed.map((s) => RELATIONSHIP_LABELS[s]).join(', ')} suppressed — fewer than {floor} responses.
            </p>
          )}
        </CardBody>
      </Card>

      {can('feedback360.verbatims', ctx) ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Keep doing" subtitle={isCoach ? undefined : 'Unattributed'} />
            <CardBody>
              <ul className="space-y-3">
                {keepDoing.map((r) => (
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
            <CardHeader title="Do more of" subtitle={isCoach ? undefined : 'Unattributed'} />
            <CardBody>
              <ul className="space-y-3">
                {doMoreOf.map((r) => (
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
          why="Written comments stay between the coach and the client. The report carries what matters for reinforcement."
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
          why="Personality type is not shared upward. Its behavioural implications appear in the report's watch-outs."
        />
      )}
    </div>
  )
}
