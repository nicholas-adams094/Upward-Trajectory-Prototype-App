import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { readSession, useDb, writeSession } from '../data/store'
import type { User } from '../types'

interface AuthValue {
  user: User | null
  signIn: (userId: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useDb()
  const [userId, setUserId] = useState<string | null>(() => readSession())

  const signIn = useCallback((id: string) => {
    writeSession(id)
    setUserId(id)
  }, [])

  const signOut = useCallback(() => {
    writeSession(null)
    setUserId(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ user: db.users.find((u) => u.id === userId) ?? null, signIn, signOut }),
    [db.users, userId, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Convenience for pages that are only reachable behind the route guard. */
export function useViewer(): User {
  const { user } = useAuth()
  if (!user) throw new Error('No signed-in user')
  return user
}
