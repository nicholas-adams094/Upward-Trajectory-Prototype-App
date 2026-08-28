import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export const SERIES = ['var(--color-series-1)', 'var(--color-series-2)', 'var(--color-series-3)'] as const

const GRID = 'var(--color-grid)'
const AXIS = 'var(--color-axis)'
const MUTED = 'var(--color-muted)'
const SURFACE = 'var(--color-surface)'

/* --------------------------------------------------------------- tooltip */

interface TipState {
  x: number
  y: number
  node: ReactNode
}

function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const show = (evt: { clientX: number; clientY: number }, node: ReactNode) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setTip({ x: evt.clientX - box.left, y: evt.clientY - box.top, node })
  }
  const hide = () => setTip(null)

  const layer = tip ? (
    <div
      className="pointer-events-none absolute z-20 max-w-[240px] rounded-lg border border-hairline bg-surface px-2.5 py-2 text-[12px] leading-snug text-ink shadow-lg"
      style={{ left: Math.max(4, Math.min(tip.x + 12, (ref.current?.clientWidth ?? 400) - 200)), top: Math.max(4, tip.y - 8) }}
    >
      {tip.node}
    </div>
  ) : null

  return { ref, show, hide, layer }
}

/* ---------------------------------------------------------- table toggle */

function ChartFrame({
  children, table, note,
}: { children: ReactNode; table: ReactNode; note?: string }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12px] leading-snug text-muted">{note}</p>
        <button
          onClick={() => setShowTable((s) => !s)}
          className="no-print shrink-0 rounded-md border border-hairline px-2 py-1 text-[11.5px] font-medium text-ink-2 hover:bg-plane"
        >
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {showTable ? <div className="overflow-x-auto">{table}</div> : children}
    </div>
  )
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full min-w-[420px] text-left text-[12.5px]">
      <thead>
        <tr className="border-b border-hairline text-[11.5px] uppercase tracking-wide text-muted">
          {head.map((h, i) => (
            <th key={h} className={`py-1.5 pr-3 font-medium ${i ? 'text-right' : ''}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-hairline/60 last:border-0">
            {r.map((c, j) => (
              <td key={j} className={`py-1.5 pr-3 ${j ? 'tabular text-right text-ink' : 'text-ink-2'}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ------------------------------------------------------------ gap chart */

export interface GapRow {
  label: string
  a: number | null
  b: number | null
  sub?: string
}

/**
 * Dumbbell. Two dots per row joined by a connector — the distance between them
 * is the point (self-perception vs how the organisation sees it).
 */
export function GapChart({
  rows, aLabel, bLabel, min = 1, max = 5, note,
}: { rows: GapRow[]; aLabel: string; bLabel: string; min?: number; max?: number; note?: string }) {
  const { ref, show, hide, layer } = useTooltip()
  const W = 760
  const LEFT = 210
  const RIGHT = 46
  const ROW = 34
  const TOP = 24
  const H = TOP + rows.length * ROW + 10
  const plotW = W - LEFT - RIGHT
  const x = (v: number) => LEFT + ((v - min) / (max - min)) * plotW
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  return (
    <ChartFrame
      note={note}
      table={
        <DataTable
          head={['', aLabel, bLabel, 'Gap']}
          rows={rows.map((r) => [
            r.label,
            r.a ?? '—',
            r.b ?? '—',
            r.a !== null && r.b !== null ? (r.b - r.a > 0 ? `+${(r.b - r.a).toFixed(1)}` : (r.b - r.a).toFixed(1)) : '—',
          ])}
        />
      }
    >
      <div className="relative" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${aLabel} compared with ${bLabel} across ${rows.length} competencies`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={TOP - 8} y2={H - 8} stroke={GRID} strokeWidth={1} />
              <text x={x(t)} y={TOP - 13} textAnchor="middle" fontSize={10.5} fill={MUTED}>{t}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = TOP + i * ROW + ROW / 2
            const hasBoth = r.a !== null && r.b !== null
            const coincident = hasBoth && Math.abs(r.b! - r.a!) < 0.06
            return (
              <g
                key={r.label}
                onMouseMove={(e) =>
                  show(e, (
                    <div>
                      <p className="font-semibold">{r.label}</p>
                      <p className="mt-1 text-ink-2">{aLabel}: <span className="tabular font-medium text-ink">{r.a ?? '—'}</span></p>
                      <p className="text-ink-2">{bLabel}: <span className="tabular font-medium text-ink">{r.b ?? '—'}</span></p>
                      {hasBoth ? <p className="mt-1 text-ink-2">Gap <span className="tabular font-medium text-ink">{(r.b! - r.a!) > 0 ? '+' : ''}{(r.b! - r.a!).toFixed(1)}</span></p> : null}
                    </div>
                  ))
                }
                onMouseLeave={hide}
              >
                <rect x={0} y={y - ROW / 2} width={W} height={ROW} fill="transparent" />
                <text x={LEFT - 14} y={y + 3.5} textAnchor="end" fontSize={12} fill="var(--color-ink)">{r.label}</text>
                {hasBoth ? <line x1={x(r.a!)} x2={x(r.b!)} y1={y} y2={y} stroke={AXIS} strokeWidth={2} strokeLinecap="round" /> : null}
                {r.a !== null ? <circle cx={x(r.a)} cy={y - (coincident ? 5 : 0)} r={6} fill={SERIES[0]} stroke={SURFACE} strokeWidth={2} /> : null}
                {r.b !== null ? <circle cx={x(r.b)} cy={y + (coincident ? 5 : 0)} r={6} fill={SERIES[1]} stroke={SURFACE} strokeWidth={2} /> : null}
                {hasBoth ? (
                  <text x={W - RIGHT + 10} y={y + 3.5} fontSize={11.5} fill={Math.abs(r.b! - r.a!) >= 1 ? 'var(--color-ink)' : MUTED} className="tabular">
                    {(r.b! - r.a!) > 0 ? '+' : ''}{(r.b! - r.a!).toFixed(1)}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
        {layer}
        <Legend items={[{ label: aLabel, color: SERIES[0] }, { label: bLabel, color: SERIES[1] }]} />
      </div>
    </ChartFrame>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: it.color }} aria-hidden="true" />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

/* ---------------------------------------------------------- trend chart */

export interface TrendSeries {
  id: string
  label: string
  points: { date: string; value: number }[]
  target?: number
}

/** Weekly check-in ratings over time, with the goal target as a reference line. */
export function TrendChart({ series, min = 1, max = 5, note }: { series: TrendSeries[]; min?: number; max?: number; note?: string }) {
  const { ref, show, hide, layer } = useTooltip()
  const W = 760
  const H = 240
  const LEFT = 34
  const RIGHT = 178
  const TOP = 14
  const BOTTOM = 28

  const dates = useMemo(
    () => [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort(),
    [series],
  )
  const x = (d: string) => LEFT + (dates.length <= 1 ? 0 : (dates.indexOf(d) / (dates.length - 1)) * (W - LEFT - RIGHT))
  const y = (v: number) => TOP + (1 - (v - min) / (max - min)) * (H - TOP - BOTTOM)
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const [hover, setHover] = useState<string | null>(null)

  // Nudge end labels apart so two close series never overprint each other.
  const labelYs = (() => {
    const raw = series.map((s, i) => {
      const last = s.points[s.points.length - 1]
      return { i, y: last ? y(last.value) : TOP }
    })
    const sorted = [...raw].sort((a, b) => a.y - b.y)
    const MIN = 15
    for (let k = 1; k < sorted.length; k++) {
      if (sorted[k].y - sorted[k - 1].y < MIN) sorted[k].y = sorted[k - 1].y + MIN
    }
    const out: number[] = []
    for (const r of sorted) out[r.i] = Math.min(H - BOTTOM - 4, r.y)
    return out
  })()

  if (!dates.length) return null

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const idx = Math.round(((px - LEFT) / (W - LEFT - RIGHT)) * (dates.length - 1))
    const d = dates[Math.max(0, Math.min(dates.length - 1, idx))]
    setHover(d)
    show(e, (
      <div>
        <p className="font-semibold">{new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</p>
        {series.map((s, i) => {
          const pt = s.points.find((p) => p.date === d)
          return (
            <p key={s.id} className="mt-0.5 flex items-center gap-1.5 text-ink-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
              {s.label}: <span className="tabular font-medium text-ink">{pt ? pt.value.toFixed(1) : '—'}</span>
            </p>
          )
        })}
      </div>
    ))
  }

  return (
    <ChartFrame
      note={note}
      table={
        <DataTable
          head={['Week of', ...series.map((s) => s.label)]}
          rows={dates.map((d) => [
            new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
            ...series.map((s) => s.points.find((p) => p.date === d)?.value.toFixed(1) ?? '—'),
          ])}
        />
      }
    >
      <div className="relative" ref={ref}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Progress over time for ${series.map((s) => s.label).join(', ')}`}
          onMouseMove={onMove}
          onMouseLeave={() => { setHover(null); hide() }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={W - RIGHT} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={LEFT - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill={MUTED}>{t}</text>
            </g>
          ))}

          {series.map((s, i) =>
            s.target !== undefined ? (
              <g key={`t-${s.id}`}>
                <line x1={LEFT} x2={W - RIGHT} y1={y(s.target)} y2={y(s.target)} stroke={SERIES[i % SERIES.length]} strokeWidth={1.5} strokeDasharray="5 5" opacity={0.5} />
              </g>
            ) : null,
          )}

          {hover ? <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={H - BOTTOM} stroke={AXIS} strokeWidth={1} /> : null}

          {series.map((s, i) => {
            const color = SERIES[i % SERIES.length]
            const d = s.points.map((p, j) => `${j ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
            const last = s.points[s.points.length - 1]
            const labelY = last ? labelYs[i] : 0
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {hover
                  ? (() => {
                      const pt = s.points.find((p) => p.date === hover)
                      return pt ? <circle cx={x(pt.date)} cy={y(pt.value)} r={4.5} fill={color} stroke={SURFACE} strokeWidth={2} /> : null
                    })()
                  : null}
                {last ? (
                  <>
                    <circle cx={x(last.date)} cy={y(last.value)} r={4.5} fill={color} stroke={SURFACE} strokeWidth={2} />
                    {Math.abs(labelY - y(last.value)) > 2 ? (
                      <path
                        d={`M${x(last.date) + 6},${y(last.value)} L${W - RIGHT + 4},${labelY}`}
                        stroke={color} strokeWidth={1} opacity={0.4} fill="none"
                      />
                    ) : null}
                    <text x={W - RIGHT + 10} y={labelY + 3.5} fontSize={11.5} fill="var(--color-ink)">
                      <tspan className="tabular" fontWeight={600}>{last.value.toFixed(1)}</tspan>
                      <tspan dx={5} fill="var(--color-ink-2)">{s.label.length > 24 ? `${s.label.slice(0, 23)}…` : s.label}</tspan>
                    </text>
                  </>
                ) : null}
              </g>
            )
          })}

          <line x1={LEFT} x2={W - RIGHT} y1={H - BOTTOM} y2={H - BOTTOM} stroke={AXIS} strokeWidth={1} />
          <text x={LEFT} y={H - 8} fontSize={10.5} fill={MUTED}>
            {new Date(`${dates[0]}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
          </text>
          <text x={W - RIGHT} y={H - 8} textAnchor="end" fontSize={10.5} fill={MUTED}>
            {new Date(`${dates[dates.length - 1]}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
          </text>
        </svg>
        {layer}
        {series.length > 1 ? <Legend items={series.map((s, i) => ({ label: s.label, color: SERIES[i % SERIES.length] }))} /> : null}
      </div>
    </ChartFrame>
  )
}

/* ------------------------------------------------------------- bar list */

export interface BarRow {
  label: string
  value: number
  sub?: string
}

/** Single-series horizontal bars. One hue, direct value labels, no legend. */
export function BarList({ rows, max, suffix = '', note }: { rows: BarRow[]; max?: number; suffix?: string; note?: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value))
  return (
    <ChartFrame
      note={note}
      table={<DataTable head={['', 'Value']} rows={rows.map((r) => [r.label, `${r.value}${suffix}`])} />}
    >
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="truncate text-ink">{r.label}{r.sub ? <span className="ml-1.5 text-muted">{r.sub}</span> : null}</span>
              <span className="tabular shrink-0 font-semibold text-ink">{r.value}{suffix}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#f0efec]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / top) * 100)}%`, background: SERIES[0] }} />
            </div>
          </li>
        ))}
      </ul>
    </ChartFrame>
  )
}

/* ---------------------------------------------------------- phase track */

const PHASE_STEPS = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281']

export function PhaseTrack({ phases, activeIndex }: { phases: { id: string; label: string; blurb: string }[]; activeIndex: number }) {
  return (
    <ol className="flex flex-wrap gap-2">
      {phases.map((p, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        return (
          <li key={p.id} className="min-w-[132px] flex-1">
            <div
              className="h-1.5 w-full rounded-full"
              style={{ background: i <= activeIndex ? PHASE_STEPS[i] : '#e6e5e0' }}
              aria-hidden="true"
            />
            <p className={`mt-2 text-[12.5px] font-semibold ${active ? 'text-ink' : done ? 'text-ink-2' : 'text-muted'}`}>
              {done ? <span aria-hidden="true">✓ </span> : null}
              {p.label}
              {active ? <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-[#3730a3]">now</span> : null}
            </p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{p.blurb}</p>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------ sparkline */

export function Sparkline({ values, width = 92, height = 26 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values, 1)
  const max = Math.max(...values, 5)
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const rising = values[values.length - 1] >= values[0]
  return (
    <svg width={width} height={height} className="shrink-0" role="img" aria-label={`Trend from ${values[0].toFixed(1)} to ${values[values.length - 1].toFixed(1)}`}>
      <path d={d} fill="none" stroke={rising ? SERIES[0] : 'var(--color-serious)'} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill={rising ? SERIES[0] : 'var(--color-serious)'} stroke={SURFACE} strokeWidth={1.5} />
    </svg>
  )
}
