import { RATING_ANCHORS } from '../../lib/frameworks'
import type { Competency, Ratings } from '../../types'

/**
 * The single rating control used by the self-evaluation and the 360 form, so
 * every number in the system comes off the same behavioural anchors.
 */
export function RatingScale({
  competencies, value, onChange,
}: { competencies: Competency[]; value: Ratings; onChange: (next: Ratings) => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-hairline bg-surface-2 px-3.5 py-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">The scale</p>
        <ul className="mt-1.5 space-y-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <li key={n} className="text-[12.5px] leading-snug text-ink-2">
              <span className="tabular font-semibold text-ink">{n}</span> — {RATING_ANCHORS[n]}
            </li>
          ))}
        </ul>
      </div>

      {competencies.map((c) => (
        <fieldset key={c.id}>
          <legend className="text-[13.5px] font-medium text-ink">{c.name}</legend>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{c.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const selected = value[c.id] === n
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ ...value, [c.id]: n })}
                  className={`h-9 w-9 rounded-lg border text-[13.5px] font-semibold transition ${
                    selected
                      ? 'border-accent bg-accent text-white'
                      : 'border-hairline bg-surface text-ink-2 hover:border-accent/50 hover:text-ink'
                  }`}
                >
                  {n}
                </button>
              )
            })}
            <span className="ml-1 self-center text-[12px] text-muted">
              {value[c.id] ? RATING_ANCHORS[value[c.id]] : 'Not yet rated'}
            </span>
          </div>
        </fieldset>
      ))}
    </div>
  )
}
