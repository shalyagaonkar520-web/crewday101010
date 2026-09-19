import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { Eye, EyeOff, Mail, UserRound } from 'lucide-react'
import { AuthLayout, GoogleIcon } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { InlineAlert } from '@/components/ui/Feedback'
import { signInAsGuest, signInWithEmail, signInWithGoogle } from '@/services/authService'
import { authErrorMessage } from '@/utils/validation'
import { isFirebaseConfigured, missingFirebaseConfig } from '@/firebase/config'

interface LocationState {
  from?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as LocationState | null)?.from ?? '/home'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState<'email' | 'google' | 'guest' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleError = (caught: unknown) => {
    if (caught instanceof FirebaseError) setError(authErrorMessage(caught.code))
    else if (caught instanceof Error) setError(caught.message)
    else setError('Something went wrong. Please try again.')
  }

  const onEmailSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy('email')
    try {
      await signInWithEmail(email, password)
      navigate(redirectTo, { replace: true })
    } catch (caught) {
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  const onGoogle = async () => {
    setError(null)
    setBusy('google')
    try {
      await signInWithGoogle()
      navigate(redirectTo, { replace: true })
    } catch (caught) {
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  const onGuest = async () => {
    setError(null)
    setBusy('guest')
    try {
      await signInAsGuest()
      navigate('/home', { replace: true })
    } catch (caught) {
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  return (
    <AuthLayout
      title="Welcome back 👋"
      subtitle="Sign in to see what your weekend looks like."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
            Create your CrewDay account
          </Link>
        </>
      }
    >
      {!isFirebaseConfigured ? (
        <div className="mb-5">
          <InlineAlert tone="warning">
            CrewDay is still being set up on this deployment — sign in is unavailable right now.
            Please try again shortly.
            {import.meta.env.DEV ? (
              // Developer detail stays out of production: members should never
              // see a backend vendor named on the sign-in screen.
              <span className="mt-2 block font-mono text-xs opacity-80">
                dev: missing {missingFirebaseConfig.join(', ')} in .env.local
              </span>
            ) : null}
          </InlineAlert>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        fullWidth
        size="lg"
        icon={<GoogleIcon />}
        loading={busy === 'google'}
        disabled={!isFirebaseConfigured || busy !== null}
        onClick={() => void onGoogle()}
      >
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold tracking-wide text-ink-400 uppercase">
        <span className="h-px flex-1 bg-ink-200" />
        or continue with email
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <form onSubmit={(event) => void onEmailSubmit(event)} className="space-y-4" noValidate>
        <Input
          type="email"
          label="Email"
          autoComplete="email"
          required
          value={email}
          leading={<Mail size={18} />}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
        <Input
          type={showPassword ? 'text' : 'password'}
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          trailing={
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((shown) => !shown)}
              className="rounded-full p-1 hover:bg-ink-100"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          }
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={busy === 'email'}
          disabled={!isFirebaseConfigured || busy !== null}
        >
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold tracking-wide text-ink-400 uppercase">
        <span className="h-px flex-1 bg-ink-200" />
        or
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <Button
        type="button"
        variant="ghost"
        fullWidth
        size="lg"
        icon={<UserRound size={18} />}
        loading={busy === 'guest'}
        disabled={!isFirebaseConfigured || busy !== null}
        onClick={() => void onGuest()}
      >
        Continue as guest
      </Button>
      <p className="mt-2 text-center text-xs text-ink-500">
        Browse and book without an account. Tickets stay on this device until you save one.
      </p>
    </AuthLayout>
  )
}
