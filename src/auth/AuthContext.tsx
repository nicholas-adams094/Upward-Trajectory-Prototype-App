import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { readSession, useDb, writeSession } from '../data/store'
import type { User } from '../types'

interface AuthValue {
  user: User | null
  signIn: (userId: string) => void
  signOut: () => void
  /**
   * True between a deliberate sign-out and the next sign-in. The route guard
   * remembers where an unauthenticated visitor was heading so a shared link
   * survives sign-in — but somebody who just signed out is not "heading" back
   * to the last person's screen.
   */
  signingOut: boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useDb()
  const [userId, setUserId] = useState<string | null>(() => readSession())
  const [signingOut, setSigningOut] = useState(false)

  const signIn = useCallback((id: string) => {
    writeSession(id)
    setSigningOut(false)
    setUserId(id)
  }, [])

  const signOut = useCallback(() => {
    writeSession(null)
    setSigningOut(true)
    setUserId(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ user: db.users.find((u) => u.id === userId) ?? null, signIn, signOut, signingOut }),
    [db.users, userId, signIn, signOut, signingOut],
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
