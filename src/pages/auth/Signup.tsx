import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { Eye, EyeOff, Mail, User } from 'lucide-react'
import { AuthLayout, GoogleIcon } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { InlineAlert } from '@/components/ui/Feedback'
import { signInWithGoogle, signUpWithEmail } from '@/services/authService'
import { authErrorMessage, isEmail, passwordHint } from '@/utils/validation'
import { isFirebaseConfigured } from '@/firebase/config'

export default function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const passwordProblem = touched ? passwordHint(password) : undefined
  const emailProblem = touched && email && !isEmail(email) ? 'Enter a valid email address.' : undefined

  const handleError = (caught: unknown) => {
    if (caught instanceof FirebaseError) setError(authErrorMessage(caught.code))
    else if (caught instanceof Error) setError(caught.message)
    else setError('Something went wrong. Please try again.')
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    setError(null)
    if (!name.trim() || !isEmail(email) || passwordHint(password)) return

    setBusy('email')
    try {
      await signUpWithEmail(name, email, password)
      navigate('/onboarding', { replace: true })
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
      navigate('/onboarding', { replace: true })
    } catch (caught) {
      handleError(caught)
    } finally {
      setBusy(null)
    }
  }

  return (
    <AuthLayout
      title="Join CrewDay"
      subtitle="Two minutes to set up. Then find your people."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
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
        or sign up with email
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
        <Input
          label="Your name"
          required
          autoComplete="name"
          value={name}
          leading={<User size={18} />}
          onChange={(event) => setName(event.target.value)}
          error={touched && !name.trim() ? 'Tell us your name.' : undefined}
          placeholder="Anaya Sharma"
        />
        <Input
          type="email"
          label="Email"
          required
          autoComplete="email"
          value={email}
          leading={<Mail size={18} />}
          onChange={(event) => setEmail(event.target.value)}
          error={emailProblem}
          placeholder="you@example.com"
        />
        <Input
          type={showPassword ? 'text' : 'password'}
          label="Password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordProblem}
          hint="At least 8 characters, with letters and numbers."
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

        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={busy === 'email'}
          disabled={!isFirebaseConfigured || busy !== null}
        >
          Create account
        </Button>

        <p className="text-center text-xs leading-relaxed text-ink-500">
          By joining you agree to our{' '}
          <Link to="/terms" className="font-semibold text-brand-600 hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="font-semibold text-brand-600 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthLayout>
  )
}
