import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { Mail } from 'lucide-react'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { InlineAlert } from '@/components/ui/Feedback'
import { sendResetEmail } from '@/services/authService'
import { authErrorMessage, isEmail } from '@/utils/validation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await sendResetEmail(email)
      setSent(true)
    } catch (caught) {
      // Deliberately generic: never confirm whether an address is registered.
      if (caught instanceof FirebaseError && caught.code === 'auth/too-many-requests') {
        setError(authErrorMessage(caught.code))
      } else {
        setSent(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <InlineAlert tone="success">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your
            spam folder too.
          </InlineAlert>
          <Button variant="outline" fullWidth onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4" noValidate>
          <Input
            type="email"
            label="Email"
            required
            autoComplete="email"
            value={email}
            leading={<Mail size={18} />}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
          <Button type="submit" fullWidth size="lg" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
