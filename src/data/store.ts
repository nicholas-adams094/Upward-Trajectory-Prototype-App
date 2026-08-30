import { useSyncExternalStore } from 'react'
import type { Database } from '../types'
import { DEFAULT_SETTINGS, applyVisibility, normaliseVisibility } from '../lib/permissions'
import { seedDatabase } from './seed'

const KEY = 'upward-trajectory.db.v1'
const SESSION_KEY = 'upward-trajectory.session.v1'
const SEEDED_KEY = 'upward-trajectory.seeded.v1'

/**
 * Dates are generated relative to the day the demo is seeded, so a store kept
 * indefinitely would drift back into "everything overdue". Past this age we
 * re-seed rather than show a rotted demo to a returning visitor.
 */
const MAX_STORE_AGE_DAYS = 14

function storeIsStale(): boolean {
  try {
    const seededOn = localStorage.getItem(SEEDED_KEY)
    if (!seededOn) return true
    const age = (Date.now() - new Date(`${seededOn}T00:00:00`).getTime()) / 86_400_000
    return !Number.isFinite(age) || age > MAX_STORE_AGE_DAYS
  } catch {
    return true
  }
}

function stampSeeded() {
  try {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    localStorage.setItem(SEEDED_KEY, `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
  } catch {
    /* ignore */
  }
}

/** Every table the app reads. A stored copy missing one is from an older build. */
const TABLES: (keyof Database)[] = [
  'orgs', 'users', 'competencies', 'engagements', 'assessments', 'respondents', 'responses',
  'clifton', 'enneagram', 'reports', 'goals', 'actions', 'checkIns', 'sessions', 'activity',
  'waves', 'handovers',
]

function isUsable(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false
  const db = value as Record<string, unknown>
  return TABLES.every((t) => Array.isArray(db[t]))
    && !!db.settings && typeof db.settings === 'object'
    && (db.users as unknown[]).length > 0
}

/**
 * Settings are the one table a visitor edits deliberately, so a stored copy is
 * repaired rather than discarded: anything missing falls back to the default.
 */
function withSettings(db: Database): Database {
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings }
  db.settings.visibility = normaliseVisibility(db.settings.visibility)
  applyVisibility(db.settings.visibility)
  return db
}

function load(): Database {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw && !storeIsStale()) {
      const parsed: unknown = JSON.parse(raw)
      // A visitor who used an earlier build has a store from an older shape.
      // Re-seeding beats crashing on a missing table.
      if (isUsable(parsed)) return withSettings(parsed)
    }
  } catch {
    /* fall through to a fresh seed */
  }
  const fresh = withSettings(seedDatabase())
  persist(fresh)
  stampSeeded()
  return fresh
}

function persist(db: Database) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* demo data is disposable; a full quota just means no persistence */
  }
}

let db: Database = load()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDb(): Database {
  return db
}

/** Apply a mutation to a fresh copy of the database and notify subscribers. */
export function mutate(fn: (draft: Database) => void) {
  const next: Database = JSON.parse(JSON.stringify(db))
  fn(next)
  // The matrix drives every `can()` call, so it has to be live before render.
  next.settings.visibility = normaliseVisibility(next.settings.visibility)
  applyVisibility(next.settings.visibility)
  db = next
  persist(next)
  emit()
}

export function resetDemoData() {
  db = withSettings(seedDatabase())
  persist(db)
  stampSeeded()
  emit()
}

export function useDb(): Database {
  return useSyncExternalStore(subscribe, getDb, getDb)
}

/* --------------------------------------------------------------- session */

export function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function writeSession(userId: string | null) {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}
