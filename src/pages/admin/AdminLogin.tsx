import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { Lock, Mail, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { InlineAlert, Spinner } from '@/components/ui/Feedback'
import { Logo } from '@/components/layout/Logo'
import { GoogleIcon } from '@/layouts/AuthLayout'
import { useAuth } from '@/hooks/useAuth'
import { logout, signInWithEmail, signInWithGoogle } from '@/services/authService'
import { authErrorMessage } from '@/utils/validation'
import type { UserProfile } from '@/types'

/**
 * Organiser sign-in.
 *
 * Email/password or Google — the owner's account is a Google account, so the
 * Google button is the one-tap path. Nothing is auto-submitted and no password
 * lives in this bundle: whoever signs in still has to hold an account whose
 * profile carries `role: admin`, which only the security rules can grant.
 */
export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isAdmin, loading, profile } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const denied = (location.state as { denied?: boolean } | null)?.denied

  useEffect(() => {
    if (!loading && isAuthenticated && isAdmin) navigate('/admin', { replace: true })
  }, [loading, isAuthenticated, isAdmin, navigate])

  const finish = async (signedIn: UserProfile) => {
    if (signedIn.role !== 'admin') {
      // Signed in fine, but this is not an organiser account.
      await logout()
      setError('This account does not have organiser access.')
      return
    }
    navigate('/admin', { replace: true })
  }

  const doLogin = async (loginEmail: string, loginPass: string) => {
    setError(null)
    setBusy('email')
    try {
      await finish(await signInWithEmail(loginEmail.trim(), loginPass))
    } catch (caught) {
      setError(caught instanceof FirebaseError ? authErrorMessage(caught.code) : 'Sign in failed.')
    } finally {
      setBusy(null)
    }
  }

  const onGoogle = async () => {
    setError(null)
    setBusy('google')
    try {
      await finish(await signInWithGoogle())
    } catch (caught) {
      setError(caught instanceof FirebaseError ? authErrorMessage(caught.code) : 'Sign in failed.')
    } finally {
      setBusy(null)
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await doLogin(email, password)
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950">
        <Spinner className="h-7 w-7 text-white" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink-950 px-4 py-10">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(50% 45% at 20% 20%, #7422e3 0%, transparent 60%), radial-gradient(45% 40% at 85% 80%, #fe4c10 0%, transparent 55%)',
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <Logo variant="light" className="justify-center" />
          <p className="mt-2 text-sm font-semibold tracking-[0.2em] text-ink-400 uppercase">
            Organiser access
          </p>
        </div>

        <Card className="p-6">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Admin Login</h1>
          <p className="mt-1 text-sm text-ink-500">
            Sign in with an authorised organiser account.
          </p>

          {denied ? (
            <div className="mt-4">
              <InlineAlert tone="warning">
                <span className="flex items-start gap-2">
                  <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden />
                  {profile
                    ? 'Your account is signed in but does not have organiser access.'
                    : 'You need to sign in to reach the admin panel.'}
                </span>
              </InlineAlert>
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            fullWidth
            size="lg"
            className="mt-5"
            icon={<GoogleIcon />}
            loading={busy === 'google'}
            disabled={busy !== null}
            onClick={() => void onGoogle()}
          >
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs font-semibold tracking-wide text-ink-400 uppercase">
            <span className="h-px flex-1 bg-ink-200" />
            or use email
            <span className="h-px flex-1 bg-ink-200" />
          </div>

          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
            <Input
              type="email"
              label="Email"
              required
              autoComplete="email"
              value={email}
              leading={<Mail size={18} />}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="organiser@crewday.app"
            />
            <Input
              type="password"
              label="Password"
              required
              autoComplete="current-password"
              value={password}
              leading={<Lock size={18} />}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={busy === 'email'}
              disabled={busy !== null}
            >
              Login
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-ink-500">
            Organiser access is granted by an existing admin. Security rules enforce it on the
            server — visiting this URL alone grants nothing.
          </p>
        </Card>

        <p className="mt-5 text-center text-sm text-ink-400">
          <Link to="/" className="font-semibold hover:text-white">
            Back to CrewDay
          </Link>
        </p>
      </div>
    </div>
  )
}
