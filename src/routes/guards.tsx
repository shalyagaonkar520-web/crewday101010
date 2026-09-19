import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingScreen } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'

/**
 * Route guards.
 *
 * These exist for *user experience* — sending people to the right screen. They
 * are not the security boundary: every privileged read and write is enforced
 * by Firestore Security Rules, so a hand-typed `/admin` URL gets an empty,
 * permission-denied screen even if a guard were bypassed.
 */

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children ?? <Outlet />}</>
}

/** Pushes a signed-in user through onboarding before the rest of the app. */
export function RequireOnboarding({ children }: { children?: ReactNode }) {
  const { loading, needsOnboarding } = useAuth()
  if (loading) return <LoadingScreen />
  if (needsOnboarding) return <Navigate to="/onboarding" replace />
  return <>{children ?? <Outlet />}</>
}

/**
 * Browsing events is open to everyone — the landing page sends signed-out
 * visitors straight to Explore, and the security rules already allow reading
 * published events. Signed-in members still have to finish onboarding first.
 */
export function AllowGuests({ children }: { children?: ReactNode }) {
  const { loading, isAuthenticated, needsOnboarding } = useAuth()
  if (loading) return <LoadingScreen />
  if (isAuthenticated && needsOnboarding) return <Navigate to="/onboarding" replace />
  return <>{children ?? <Outlet />}</>
}

export function RequireAdmin({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen label="Checking your access…" />
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  if (!isAdmin) return <Navigate to="/admin/login" replace state={{ denied: true }} />
  return <>{children ?? <Outlet />}</>
}

/** Keeps signed-in people away from the login/landing screens. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, needsOnboarding } = useAuth()
  if (loading) return <LoadingScreen />
  if (isAuthenticated) return <Navigate to={needsOnboarding ? '/onboarding' : '/home'} replace />
  return <>{children}</>
}
