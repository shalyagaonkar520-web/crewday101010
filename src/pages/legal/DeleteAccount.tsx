import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, ShieldCheck, Trash2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { SUPPORT_EMAIL } from '@/utils/constants'

/**
 * Public "delete your account" page.
 *
 * Google Play requires a web page, reachable without installing the app, that
 * explains how to delete an account and what happens to the data. It doubles
 * as the shortcut for people who are signed in on the website: one tap takes
 * them straight to the confirmation in Settings.
 */
export default function DeleteAccountPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isGuest } = useAuth()

  const startDeletion = () => {
    if (isAuthenticated && !isGuest) {
      navigate('/settings#delete')
      return
    }
    navigate('/login', { state: { from: '/settings#delete' } })
  }

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my CrewDay account')}&body=${encodeURIComponent(
    'Please delete my CrewDay account and personal data.\n\nEmail used to sign in: \n\n(We will confirm from that address before deleting.)',
  )}`

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="border-b border-ink-100 bg-white pt-safe">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft size={16} aria-hidden /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Delete your CrewDay account</h1>
        <p className="mt-2 text-ink-600">
          You can permanently delete your account and personal data at any time. It takes under a
          minute and does not require contacting anyone.
        </p>

        <Card className="mt-8 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">From the app or the website</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ink-700">
            <li>Sign in to CrewDay.</li>
            <li>
              Open <strong>Profile → Settings</strong>.
            </li>
            <li>
              Under <strong>Danger zone</strong>, tap <strong>Delete account</strong>.
            </li>
            <li>
              Type <strong>DELETE</strong> to confirm (email accounts also enter their password;
              Google accounts re-confirm with Google).
            </li>
          </ol>
          <div className="mt-5">
            <Button icon={<Trash2 size={17} />} variant="danger" onClick={startDeletion}>
              {isAuthenticated && !isGuest ? 'Delete my account' : 'Sign in to delete my account'}
            </Button>
          </div>
        </Card>

        <Card className="mt-4 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Without signing in</h2>
          <p className="mt-2 text-ink-700">
            Lost access to your sign-in? Email us from the address on your account and we will
            delete it within 7 days after confirming it is you.
          </p>
          <a
            href={mailto}
            className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-600"
          >
            <Mail size={16} aria-hidden /> {SUPPORT_EMAIL}
          </a>
        </Card>

        <section className="mt-8 space-y-4 text-ink-700 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:mt-2 [&_ul]:space-y-1.5">
          <h2>What is deleted</h2>
          <ul>
            <li>Your sign-in (email/password or Google link) — you cannot sign back in.</li>
            <li>Your profile: name, email, phone number, photo, city, area and interests.</li>
            <li>Your notification settings and device tokens.</li>
            <li>
              Your name, email and phone number on every event registration and waitlist entry
              you ever made.
            </li>
            <li>Your upcoming registrations are cancelled and the seats released.</li>
          </ul>

          <h2>What is kept</h2>
          <ul>
            <li>
              An anonymous attendance record (event, ticket number, whether it was checked in) so
              organisers keep accurate headcounts. It contains no personal information.
            </li>
            <li>
              Payment records required by law and by our payment processor (Razorpay) are retained
              for the statutory period, referenced only by order and payment ids.
            </li>
          </ul>

          <p className="flex items-start gap-2 rounded-2xl bg-sky-50 p-4 text-sm text-sky-800">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
            Deletion is immediate and cannot be undone. If you only want a break, log out instead —
            your tickets will be waiting when you return.
          </p>

          <p className="text-sm text-ink-500">
            See our <Link to="/privacy" className="font-semibold text-brand-600 hover:underline">Privacy Policy</Link>{' '}
            for the full picture of what we collect and why.
          </p>
        </section>
      </main>
    </div>
  )
}
