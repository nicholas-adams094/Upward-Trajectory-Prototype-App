import { NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useDb } from '../../data/store'
import { ROLE_LABELS } from '../../lib/metrics'
import { visibleEngagements } from '../../lib/permissions'
import { Avatar } from '../ui/primitives'

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="7" fill="#4f46e5" />
        <path d="M6.5 17.5 L11 12 L14.5 15 L19.5 8.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="19.5" cy="8.5" r="2" fill="#fff" />
      </svg>
      <div className="leading-tight">
        <p className="text-[13.5px] font-semibold text-white">Upward Trajectory</p>
        <p className="text-[11px] text-white/55">Coaching portal</p>
      </div>
    </div>
  )
}

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-[13.5px] font-medium transition ${
          isActive ? 'bg-white/12 text-white' : 'text-white/65 hover:bg-white/8 hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const db = useDb()
  const navigate = useNavigate()
  if (!user) return null

  const mine = visibleEngagements(db, user)
  const own = mine[0]

  const mobileNav: { to: string; label: string; end?: boolean }[] = [
    ...(user.role === 'coach' ? [{ to: '/coach', label: 'Dashboard', end: true }, { to: '/coach/clients', label: 'Clients' }] : []),
    ...(user.role === 'client'
      ? [{ to: '/me', label: 'Dashboard', end: true }, ...(own ? [{ to: `/engagements/${own.id}`, label: 'My development' }] : [])]
      : []),
    ...(user.role === 'manager' ? [{ to: '/team', label: 'My team', end: true }] : []),
    ...(user.role === 'hr' ? [{ to: '/org', label: 'Organisation', end: true }, { to: '/org/people', label: 'People' }] : []),
    { to: '/settings', label: 'Settings' },
  ]

  return (
    <div className="flex min-h-full">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-brand md:flex">
        <Brand />
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {user.role === 'coach' && (
            <>
              <NavItem to="/coach" label="Practice dashboard" end />
              <NavItem to="/coach/clients" label="Clients" />
            </>
          )}
          {user.role === 'client' && (
            <>
              <NavItem to="/me" label="My dashboard" end />
              {own ? <NavItem to={`/engagements/${own.id}`} label="My development" /> : null}
            </>
          )}
          {user.role === 'manager' && <NavItem to="/team" label="My team" end />}
          {user.role === 'hr' && (
            <>
              <NavItem to="/org" label="Organisation" end />
              <NavItem to="/org/people" label="People" />
            </>
          )}
          <div className="!mt-4 border-t border-white/10 pt-3">
            <NavItem to="/settings" label="Settings" />
          </div>
        </nav>

        <div className="border-t border-white/10 px-2 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <Avatar name={user.name} accent={user.accent} size={30} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[12.5px] font-medium text-white">{user.name}</p>
              <p className="truncate text-[11px] text-white/55">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <button
            onClick={() => { signOut(); navigate('/login', { replace: true }) }}
            className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-[12.5px] text-white/60 hover:bg-white/8 hover:text-white"
          >
            Switch user
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-[13.5px] font-semibold text-ink">Upward Trajectory</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { signOut(); navigate('/login', { replace: true }) }}
                className="rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-accent"
              >
                Switch user
              </button>
            </div>
          </div>
          {/* Every sidebar destination stays reachable on a phone. */}
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {mobileNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
                    isActive ? 'border-accent bg-accent-soft text-[#3730a3]' : 'border-hairline text-ink-2'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  )
}
