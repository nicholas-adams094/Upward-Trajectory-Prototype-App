import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { initials } from '../../lib/metrics'

/* ------------------------------------------------------------------ shell */

export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return (
    <As className={`rounded-xl border border-hairline bg-surface ${className}`}>{children}</As>
  )
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-tight text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-[13px] leading-snug text-ink-2">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

/* ----------------------------------------------------------------- inputs */

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
  title?: string
}

export function Button({ children, onClick, variant = 'secondary', size = 'md', type = 'button', disabled, className = '', title }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-45'
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-[12.5px]' : 'px-3.5 py-2 text-[13.5px]'
  const variants = {
    primary: 'bg-accent text-white hover:bg-indigo-700',
    secondary: 'border border-hairline bg-surface text-ink hover:bg-plane',
    ghost: 'text-ink-2 hover:bg-plane hover:text-ink',
    danger: 'border border-hairline bg-surface text-[#b1302f] hover:bg-red-50',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${sizes} ${variants} ${className}`}>
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13.5px] text-ink placeholder:text-muted focus:border-accent focus:outline-none'

/* ------------------------------------------------------------------ atoms */

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'good' | 'warning' | 'serious' | 'critical' }) {
  const tones = {
    neutral: 'bg-plane text-ink-2 border-hairline',
    accent: 'bg-accent-soft text-[#3730a3] border-[#dcdcfb]',
    good: 'bg-[#eaf7ea] text-[#0a6b0a] border-[#c9e9c9]',
    warning: 'bg-[#fdf3dd] text-[#8a5b00] border-[#f4e0ac]',
    serious: 'bg-[#fdeee7] text-[#9c4a22] border-[#f6d5c5]',
    critical: 'bg-[#fbeaea] text-[#a12d2d] border-[#f2cccc]',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${tones}`}>
      {children}
    </span>
  )
}

/** Status always ships as icon + label, never colour alone. */
export function StatusPill({ status }: { status: 'not_started' | 'in_progress' | 'complete' | 'on_track' | 'at_risk' | 'achieved' | 'open' | 'done' | 'skipped' | 'draft' | 'published' | 'active' | 'paused' }) {
  const map = {
    not_started: { label: 'Not started', tone: 'neutral', icon: '○' },
    in_progress: { label: 'In progress', tone: 'warning', icon: '◑' },
    complete: { label: 'Complete', tone: 'good', icon: '✓' },
    on_track: { label: 'On track', tone: 'good', icon: '↗' },
    at_risk: { label: 'At risk', tone: 'critical', icon: '!' },
    achieved: { label: 'Achieved', tone: 'good', icon: '★' },
    open: { label: 'Open', tone: 'neutral', icon: '○' },
    done: { label: 'Done', tone: 'good', icon: '✓' },
    skipped: { label: 'Skipped', tone: 'neutral', icon: '–' },
    draft: { label: 'Draft', tone: 'warning', icon: '✎' },
    published: { label: 'Published', tone: 'good', icon: '✓' },
    active: { label: 'Active', tone: 'accent', icon: '●' },
    paused: { label: 'Paused', tone: 'neutral', icon: '‖' },
  } as const
  const cfg = map[status]
  return (
    <Badge tone={cfg.tone}>
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </Badge>
  )
}

export function Avatar({ name, accent, size = 32 }: { name: string; accent: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: accent, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}

export function Meter({ value, label, tone = 'accent' }: { value: number; label?: string; tone?: 'accent' | 'series' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div>
      {label ? (
        <div className="mb-1 flex items-baseline justify-between text-[12px]">
          <span className="text-ink-2">{label}</span>
          <span className="tabular font-semibold text-ink">{pct}%</span>
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#eeedea]" role="img" aria-label={`${label ?? 'Progress'}: ${pct}%`}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: tone === 'accent' ? 'var(--color-accent)' : 'var(--color-series-1)' }}
        />
      </div>
    </div>
  )
}

export function StatTile({ label, value, unit, foot, tone }: { label: string; value: string | number; unit?: string; foot?: ReactNode; tone?: 'good' | 'critical' | 'warning' }) {
  const color = tone === 'good' ? 'text-[#0a6b0a]' : tone === 'critical' ? 'text-[#a12d2d]' : tone === 'warning' ? 'text-[#8a5b00]' : 'text-ink'
  return (
    <div className="rounded-xl border border-hairline bg-surface px-4 py-3.5">
      <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-1.5 text-[28px] font-semibold leading-none tracking-tight ${color}`}>
        {value}
        {unit ? <span className="ml-0.5 text-[15px] font-medium text-ink-2">{unit}</span> : null}
      </p>
      {foot ? <p className="mt-1.5 text-[12px] leading-snug text-ink-2">{foot}</p> : null}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-surface-2 px-6 py-10 text-center">
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-2">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

/** Shown wherever the viewer's role is not permitted to see something. */
export function Restricted({ what, why }: { what: string; why: string }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-surface-2 px-5 py-6">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
        <span aria-hidden="true">🔒</span>
        {what} is not shared with your role
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{why}</p>
    </div>
  )
}

/** Wide tables scroll rather than squash; small screens get told so. */
export function ScrollableTable({ children, hint = 'Scroll the table sideways to see every column.' }: { children: ReactNode; hint?: string }) {
  return (
    <div>
      <div className="overflow-x-auto">{children}</div>
      <p className="mt-2 text-[11.5px] text-muted sm:hidden">{hint}</p>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string; count?: number }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-hairline" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] font-medium transition ${
            active === t.id ? 'border-accent text-ink' : 'border-transparent text-ink-2 hover:text-ink'
          }`}
        >
          {t.label}
          {t.count !== undefined ? <span className="ml-1.5 tabular text-[11.5px] text-muted">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement | null
    panel.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      // Keep Tab inside the dialog while it is open.
      if (e.key !== 'Tab' || !panel.current) return
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    // Stop the page behind the dialog scrolling with it.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      restoreTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={panel} tabIndex={-1} className="w-full max-w-2xl rounded-xl border border-hairline bg-surface shadow-xl outline-none">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-ink-2 hover:bg-plane" aria-label="Close">✕</button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  )
}
