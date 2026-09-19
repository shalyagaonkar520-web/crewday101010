import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import {
  Bell,
  ChevronRight,
  FileText,
  LifeBuoy,
  LogOut,
  Lock,
  ShieldCheck,
  Trash2,
  UserPen,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea, Toggle } from '@/components/ui/Field'
import { InlineAlert } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { changePassword, deleteAccount, logout, usesPasswordProvider } from '@/services/authService'
import { updateUserProfile } from '@/services/userService'
import { submitProblemReport } from '@/services/feedbackService'
import { disablePush, enablePush, isPushSupported } from '@/services/messagingService'
import { authErrorMessage, isStrongEnoughPassword } from '@/utils/validation'

function SettingsRow({
  to,
  icon,
  title,
  description,
  onClick,
  danger,
}: {
  to?: string
  icon: React.ReactNode
  title: string
  description?: string
  onClick?: () => void
  danger?: boolean
}) {
  const content = (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <span
        className={
          danger
            ? 'flex h-9 w-9 items-center justify-center rounded-xl bg-sunset-50 text-sunset-600'
            : 'flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-600'
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={
            danger ? 'block font-semibold text-sunset-700' : 'block font-semibold text-ink-900'
          }
        >
          {title}
        </span>
        {description ? <span className="block text-sm text-ink-500">{description}</span> : null}
      </span>
      <ChevronRight size={17} className="shrink-0 text-ink-300" aria-hidden />
    </div>
  )

  if (to) {
    return (
      <li className="border-b border-ink-100 last:border-0">
        <Link to={to} className="block transition hover:bg-ink-50">
          {content}
        </Link>
      </li>
    )
  }

  return (
    <li className="border-b border-ink-100 last:border-0">
      <button type="button" onClick={onClick} className="block w-full text-left transition hover:bg-ink-50">
        {content}
      </button>
    </li>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { success, error: toastError } = useToast()

  const [pushBusy, setPushBusy] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (!profile || !user) return null

  const prefs = profile.notificationPrefs
  const privacy = profile.privacyPrefs

  const savePref = async (patch: Partial<typeof prefs>) => {
    try {
      await updateUserProfile(user.uid, { notificationPrefs: { ...prefs, ...patch } })
    } catch {
      toastError('We could not save that preference.')
    }
  }

  const savePrivacy = async (patch: Partial<typeof privacy>) => {
    try {
      await updateUserProfile(user.uid, { privacyPrefs: { ...privacy, ...patch } })
    } catch {
      toastError('We could not save that preference.')
    }
  }

  const togglePush = async (next: boolean) => {
    setPushBusy(true)
    try {
      if (next) {
        const token = await enablePush(user.uid)
        if (token) success('Push notifications are on.')
        else toastError('Push could not be enabled. Check your browser notification permission.')
      } else {
        await disablePush(user.uid)
        success('Push notifications are off.')
      }
    } catch {
      toastError('We could not update push notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold text-ink-900">Settings</h1>
      <p className="mt-1 text-ink-500">Manage your account, notifications and privacy.</p>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Account</h2>
        <Card className="overflow-hidden">
          <ul>
            <SettingsRow
              to="/settings/profile"
              icon={<UserPen size={17} />}
              title="Edit profile"
              description="Name, photo, city, interests and how you join"
            />
            {usesPasswordProvider(user) ? (
              <SettingsRow
                icon={<Lock size={17} />}
                title="Change password"
                onClick={() => setPasswordOpen(true)}
              />
            ) : null}
          </ul>
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Notifications</h2>
        <div className="space-y-2">
          <Toggle
            label="Push notifications"
            description={
              isPushSupported()
                ? 'Reminders and updates on this device'
                : 'Not supported in this browser'
            }
            checked={prefs.push}
            disabled={pushBusy || !isPushSupported()}
            onChange={(next) => void togglePush(next)}
          />
          <Toggle
            label="New events"
            description="When a CrewDay opens in your city"
            checked={prefs.newEvents}
            onChange={(next) => void savePref({ newEvents: next })}
          />
          <Toggle
            label="Event reminders"
            description="24 hours and 2 hours before an event"
            checked={prefs.reminders}
            onChange={(next) => void savePref({ reminders: next })}
          />
          <Toggle
            label="Registration updates"
            description="Confirmations, changes and cancellations"
            checked={prefs.registrationUpdates}
            onChange={(next) => void savePref({ registrationUpdates: next })}
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Privacy</h2>
        <div className="space-y-2">
          <Toggle
            label="Show me in the crew"
            description="Let other attendees see your name and photo on events you join"
            checked={privacy.showProfileInCrew}
            onChange={(next) => void savePrivacy({ showProfileInCrew: next })}
          />
          <Toggle
            label="Show my interests"
            description="Display your interests on your public profile"
            checked={privacy.showInterests}
            onChange={(next) => void savePrivacy({ showInterests: next })}
          />
        </div>
        <p className="mt-2 px-1 text-xs text-ink-500">
          Your email and phone number are never shown publicly. Organisers only see them for events
          you register for.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Support</h2>
        <Card className="overflow-hidden">
          <ul>
            <SettingsRow
              icon={<LifeBuoy size={17} />}
              title="Report a problem"
              description="Tell us what went wrong"
              onClick={() => setReportOpen(true)}
            />
            <SettingsRow to="/terms" icon={<FileText size={17} />} title="Terms & Conditions" />
            <SettingsRow to="/privacy" icon={<ShieldCheck size={17} />} title="Privacy Policy" />
            <SettingsRow to="/notifications" icon={<Bell size={17} />} title="Notification inbox" />
          </ul>
        </Card>
      </section>

      <section className="mt-6 mb-4">
        <h2 className="mb-2 text-xs font-bold tracking-wide text-ink-400 uppercase">Danger zone</h2>
        <Card className="overflow-hidden">
          <ul>
            <SettingsRow
              icon={<LogOut size={17} />}
              title="Log out"
              onClick={() => void logout()}
            />
            <SettingsRow
              icon={<Trash2 size={17} />}
              title="Delete account"
              description="Permanently remove your CrewDay account and personal data"
              danger
              onClick={() => setDeleteOpen(true)}
            />
          </ul>
        </Card>
      </section>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <ReportProblemModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        userId={user.uid}
        email={profile.email}
      />
      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        needsPassword={usesPasswordProvider(user)}
        onDeleted={() => navigate('/', { replace: true })}
      />
    </div>
  )
}

/* ------------------------------ Sub dialogs ------------------------------- */

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { success } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isStrongEnoughPassword(next)) {
      setError('New password needs at least 8 characters, with letters and numbers.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await changePassword(current, next)
      success('Password updated.')
      setCurrent('')
      setNext('')
      onClose()
    } catch (caught) {
      setError(caught instanceof FirebaseError ? authErrorMessage(caught.code) : 'Could not change password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change password" size="sm">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Input
          type="password"
          label="Current password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          required
        />
        <Input
          type="password"
          label="New password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          required
        />
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        <Button type="submit" fullWidth loading={busy}>
          Update password
        </Button>
      </form>
    </Modal>
  )
}

function ReportProblemModal({
  open,
  onClose,
  userId,
  email,
}: {
  open: boolean
  onClose: () => void
  userId: string
  email: string
}) {
  const { success, error: toastError } = useToast()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim()) return
    setBusy(true)
    try {
      await submitProblemReport({ userId, email, subject, message })
      success('Thanks — we have your report.')
      setSubject('')
      setMessage('')
      onClose()
    } catch {
      toastError('We could not send your report. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report a problem"
      description="Tell us what happened and we will look into it."
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <Input
          label="Subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Ticket QR not loading"
        />
        <Textarea
          label="What happened?"
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Describe the problem in as much detail as you can."
        />
        <Button type="submit" fullWidth loading={busy} disabled={!message.trim()}>
          Send report
        </Button>
      </form>
    </Modal>
  )
}

function DeleteAccountModal({
  open,
  onClose,
  needsPassword,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  needsPassword: boolean
  onDeleted: () => void
}) {
  const { success } = useToast()
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const result = await deleteAccount(needsPassword ? password : undefined)
      success(
        result.cancelledRegistrations
          ? `Account deleted. ${result.cancelledRegistrations} upcoming registration(s) were released.`
          : 'Your account has been deleted.',
      )
      onDeleted()
    } catch (caught) {
      setError(
        caught instanceof FirebaseError
          ? authErrorMessage(caught.code)
          : caught instanceof Error
            ? caught.message
            : 'We could not delete your account.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Delete your account"
      description="This cannot be undone."
      size="sm"
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <InlineAlert tone="danger">
          We will cancel your upcoming registrations, remove your personal details from CrewDay and
          delete your sign-in. Past attendance is kept only as an anonymous count for organisers.
        </InlineAlert>

        {needsPassword ? (
          <Input
            type="password"
            label="Confirm your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        ) : (
          <p className="text-sm text-ink-600">
            You will be asked to sign in with Google again to confirm.
          </p>
        )}

        <Input
          label="Type DELETE to confirm"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="DELETE"
          required
        />

        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        <Button type="submit" variant="danger" fullWidth loading={busy}>
          Permanently delete my account
        </Button>
      </form>
    </Modal>
  )
}
