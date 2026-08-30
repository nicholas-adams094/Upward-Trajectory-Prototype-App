import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AppShell } from './components/layout/AppShell'
import { Login } from './pages/Login'
import { Settings } from './pages/Settings'
import { ClientDashboard } from './pages/ClientDashboard'
import { CoachDashboard } from './pages/CoachDashboard'
import { CoachClients } from './pages/CoachClients'
import { ManagerDashboard } from './pages/ManagerDashboard'
import { HrDashboard } from './pages/HrDashboard'
import { HrPeople } from './pages/HrPeople'
import { EngagementDetail } from './pages/engagement/EngagementDetail'
import type { Role } from './types'

const HOME: Record<Role, string> = { coach: '/coach', client: '/me', manager: '/team', hr: '/org' }

function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, signingOut } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={signingOut ? undefined : { from: location }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />
  return <AppShell>{children}</AppShell>
}

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? HOME[user.role] : '/login'} replace />
}

function Routing() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/coach" element={<Protected roles={['coach']}><CoachDashboard /></Protected>} />
      <Route path="/coach/clients" element={<Protected roles={['coach']}><CoachClients /></Protected>} />
      <Route path="/me" element={<Protected roles={['client']}><ClientDashboard /></Protected>} />
      <Route path="/team" element={<Protected roles={['manager']}><ManagerDashboard /></Protected>} />
      <Route path="/org" element={<Protected roles={['hr']}><HrDashboard /></Protected>} />
      <Route path="/org/people" element={<Protected roles={['hr']}><HrPeople /></Protected>} />
      <Route path="/engagements/:id" element={<Protected><EngagementDetail /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="/access" element={<Navigate to="/settings" replace />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routing />
    </AuthProvider>
  )
}
