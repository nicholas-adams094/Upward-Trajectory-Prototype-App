import { useSyncExternalStore } from 'react'
import type { Database } from '../types'
import { seedDatabase } from './seed'

const KEY = 'upward-trajectory.db.v1'
const SESSION_KEY = 'upward-trajectory.session.v1'

function load(): Database {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Database
  } catch {
    /* fall through to a fresh seed */
  }
  const fresh = seedDatabase()
  persist(fresh)
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
  db = next
  persist(next)
  emit()
}

export function resetDemoData() {
  db = seedDatabase()
  persist(db)
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
