import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useDb } from '../data/store'
import { ROLE_LABELS } from '../lib/metrics'
import { Avatar } from '../components/ui/primitives'
import type { Role } from '../types'

const ROLE_BLURB: Record<Role, string> = {
  coach: 'Runs the practice. Sees every engagement end to end, including private notes.',
  client: 'The person being coached. Owns their own data and their weekly commitments.',
  manager: 'The day-to-day manager. Reinforces the plan between coaching sessions.',
  hr: 'Talent / HR partner. Sees portfolio progress, not the contents of the coaching room.',
}

const ORDER: Role[] = ['coach', 'client', 'manager', 'hr']

export function Login() {
  const db = useDb()
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // A shared link to a specific screen should survive the sign-in it triggers.
  const redirect = (location.state as { from?: { pathname: string; search: string } } | null)?.from
  const from = redirect && redirect.pathname !== '/login' ? redirect : undefined

  const home: Record<Role, string> = { coach: '/coach', client: '/me', manager: '/team', hr: '/org' }

  const enter = (id: string, role: Role) => {
    signIn(id)
    navigate(from ? `${from.pathname}${from.search ?? ''}` : home[role], { replace: true })
  }

  return (
    <div className="min-h-full bg-brand">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 26 26" aria-hidden="true">
            <rect width="26" height="26" rx="7" fill="#4f46e5" />
            <path d="M6.5 17.5 L11 12 L14.5 15 L19.5 8.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="19.5" cy="8.5" r="2" fill="#fff" />
          </svg>
          <div>
            <p className="text-lg font-semibold text-white">Upward Trajectory</p>
            <p className="text-[13px] text-white/60">Coaching progress portal</p>
          </div>
        </div>

        <h1 className="mt-10 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-[34px]">
          One portal for the coach, the client, their manager and HR.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/70">
          360° feedback, self-evaluation, CliftonStrengths and the Enneagram come in at one end.
          A synthesis report, a coaching plan and the manager reinforcement that makes it stick come out
          of the other — with progress everyone can see, and confidentiality boundaries nobody has to
          negotiate by email.
        </p>

        <p className="mt-10 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Prototype — pick a person to sign in as
        </p>

        <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {ORDER.map((role) => {
            const users = db.users.filter((u) => u.role === role)
            return (
              <section key={role} className="rounded-xl border border-white/12 bg-white/5 p-4">
                <h2 className="text-[13.5px] font-semibold text-white">{ROLE_LABELS[role]}</h2>
                <p className="mt-1 text-[12.5px] leading-snug text-white/55">{ROLE_BLURB[role]}</p>
                <ul className="mt-3 space-y-1.5">
                  {users.map((u) => {
                    const org = db.orgs.find((o) => o.id === u.orgId)
                    return (
                      <li key={u.id}>
                        <button
                          onClick={() => enter(u.id, role)}
                          className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-white/25 hover:bg-white/10"
                        >
                          <Avatar name={u.name} accent={u.accent} size={32} />
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block truncate text-[13px] font-medium text-white">{u.name}</span>
                            <span className="block truncate text-[11.5px] text-white/55">{u.title} · {org?.name}</span>
                          </span>
                          <span className="shrink-0 text-white/40" aria-hidden="true">→</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>

        <p className="mt-8 max-w-2xl text-[12.5px] leading-relaxed text-white/45">
          Prototype. No real authentication — pick anyone to see the portal as they would.
          Seeded data lives in your browser and can be reset under Settings.
        </p>
      </div>
    </div>
  )
}
