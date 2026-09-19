import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Download, QrCode, Search, Undo2, UserPlus } from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/Button'
import { Badge, Card, StatTile } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { getEvent } from '@/services/eventService'
import {
  getAllEventRegistrations,
  listWaitlist,
  manualCheckIn,
  promoteFromWaitlist,
  undoCheckIn,
} from '@/services/registrationService'
import { summariseRegistrations } from '@/services/adminService'
import { createNotification } from '@/services/notificationService'
import { downloadCsv, toCsv } from '@/utils/csv'
import { formatClockTime, formatDateTime, formatEventDateShort, formatPercent } from '@/utils/format'
import type { CrewEvent, Registration, WaitlistEntry } from '@/types'

function AttendanceBadge({ registration }: { registration: Registration }) {
  if (registration.registrationStatus === 'cancelled') return <Badge tone="danger">Cancelled</Badge>
  if (registration.registrationStatus === 'pending_payment')
    return <Badge tone="warning">Payment pending</Badge>
  if (registration.attendanceStatus === 'checked_in') return <Badge tone="success">Checked in</Badge>
  return <Badge tone="neutral">Not checked in</Badge>
}

export default function EventAttendeesPage() {
  const { eventId = '' } = useParams()
  const { user } = useAuth()
  const { success, error: toastError } = useToast()

  const [event, setEvent] = useState<CrewEvent | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [undoTarget, setUndoTarget] = useState<Registration | null>(null)
  const [promoting, setPromoting] = useState(false)

  const load = useCallback(() => {
    if (!eventId) return
    setLoading(true)
    setError(null)
    Promise.all([getEvent(eventId), getAllEventRegistrations(eventId), listWaitlist(eventId)])
      .then(([loadedEvent, loadedRegistrations, loadedWaitlist]) => {
        setEvent(loadedEvent)
        setRegistrations(loadedRegistrations)
        setWaitlist(loadedWaitlist)
      })
      .catch(() => setError('We could not load registrations for this event.'))
      .finally(() => setLoading(false))
  }, [eventId])

  useEffect(load, [load])

  const stats = useMemo(() => summariseRegistrations(registrations), [registrations])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return registrations
    return registrations.filter((registration) =>
      [registration.name, registration.email, registration.phone, registration.registrationCode]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [registrations, search])

  const onManualCheckIn = async (registration: Registration) => {
    if (!user) return
    setBusyId(registration.id)
    try {
      const outcome = await manualCheckIn(registration.id, user.uid)
      if (outcome.result === 'valid') success(`${registration.name} checked in.`)
      else if (outcome.result === 'already_checked_in') toastError('Already checked in.')
      else toastError(outcome.message)
      load()
    } catch {
      toastError('Check-in failed.')
    } finally {
      setBusyId(null)
    }
  }

  const onUndo = async () => {
    if (!undoTarget) return
    setBusyId(undoTarget.id)
    try {
      await undoCheckIn(undoTarget.id)
      success('Check-in undone.')
      setUndoTarget(null)
      load()
    } catch {
      toastError('Could not undo that check-in.')
    } finally {
      setBusyId(null)
    }
  }

  const onPromote = async () => {
    setPromoting(true)
    try {
      const promoted = await promoteFromWaitlist(eventId)
      if (!promoted) {
        toastError('Nobody is waiting for this event.')
        return
      }
      await createNotification({
        userId: promoted.userId,
        type: 'waitlist_promoted',
        title: `A seat opened up: ${event?.title ?? 'your event'}`,
        body: 'You are off the waitlist and registered. Your ticket is ready in My Events.',
        eventId,
      }).catch(() => undefined)
      success(`${promoted.name} moved off the waitlist.`)
      load()
    } catch (caught) {
      toastError(caught instanceof Error ? caught.message : 'Could not promote from the waitlist.')
    } finally {
      setPromoting(false)
    }
  }

  const exportCsv = () => {
    const rows = registrations.map((registration) => ({
      registrationCode: registration.registrationCode,
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
      participationType: registration.participationType,
      registrationStatus: registration.registrationStatus,
      paymentStatus: registration.paymentStatus,
      price: registration.price,
      attendanceStatus: registration.attendanceStatus,
      registeredAt: formatDateTime(registration.registeredAt),
      checkInTime: formatDateTime(registration.checkInTime),
    }))

    downloadCsv(
      `crewday-${event?.title?.replace(/\W+/g, '-').toLowerCase() ?? 'event'}-attendees.csv`,
      toCsv(rows, [
        { key: 'registrationCode', label: 'Registration ID' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'participationType', label: 'Type' },
        { key: 'registrationStatus', label: 'Status' },
        { key: 'paymentStatus', label: 'Payment' },
        { key: 'price', label: 'Price' },
        { key: 'attendanceStatus', label: 'Attendance' },
        { key: 'registeredAt', label: 'Registered at' },
        { key: 'checkInTime', label: 'Checked in at' },
      ]),
    )
    success('Attendee list exported.')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    )
  }

  if (error) return <ErrorState description={error} onRetry={load} />

  return (
    <div>
      <Link
        to="/admin/events"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft size={16} aria-hidden /> All events
      </Link>

      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">
            {event?.title ?? 'Event'}
          </h1>
          <p className="mt-1 text-ink-500">
            {event ? `${formatEventDateShort(event.date)} · ${event.venue}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton to={`/admin/check-in?event=${eventId}`} icon={<QrCode size={17} />}>
            Scan tickets
          </LinkButton>
          <Button variant="outline" icon={<Download size={17} />} onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-bold tracking-wide text-ink-400 uppercase">
          Registration statistics
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Registered" value={stats.registered} />
          <StatTile label="Checked in" value={stats.checkedIn} tone="success" />
          <StatTile label="No-show" value={stats.noShow} tone="warning" />
          <StatTile label="Participants" value={stats.participants} tone="brand" />
          <StatTile label="Audience" value={stats.audience} tone="neutral" />
          <StatTile
            label="Attendance"
            value={formatPercent(stats.registered ? (stats.checkedIn / stats.registered) * 100 : 0)}
            tone="success"
          />
        </div>
        {stats.cancelled > 0 || stats.pendingPayment > 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            {stats.cancelled} cancelled · {stats.pendingPayment} awaiting payment
          </p>
        ) : null}
      </section>

      {waitlist.length > 0 ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="font-semibold text-amber-900">
              {waitlist.length} {waitlist.length === 1 ? 'person is' : 'people are'} on the waitlist
            </p>
            <p className="text-sm text-amber-800">
              Next up: {waitlist[0].name}. Promote them when a seat frees up.
            </p>
          </div>
          <Button
            size="sm"
            loading={promoting}
            icon={<UserPlus size={16} />}
            onClick={() => void onPromote()}
          >
            Promote next
          </Button>
        </Card>
      ) : null}

      <div className="mb-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, email, phone or registration ID"
          aria-label="Search attendees"
          leading={<Search size={18} />}
        />
      </div>

      {filtered.length ? (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-xs font-bold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Attendee</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Registration</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Checked in</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((registration) => (
                  <tr key={registration.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-semibold text-ink-900">{registration.name}</td>
                    <td className="px-4 py-3 text-ink-600">
                      <div>{registration.email}</div>
                      <div className="text-ink-500">{registration.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-ink-800">
                        {registration.registrationCode}
                      </div>
                      <div className="text-xs text-ink-500">
                        {formatDateTime(registration.registeredAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-ink-700">
                      {registration.participationType}
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceBadge registration={registration} />
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {registration.attendanceStatus === 'checked_in'
                        ? formatClockTime(registration.checkInTime)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {registration.registrationStatus === 'confirmed' &&
                      registration.attendanceStatus !== 'checked_in' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busyId === registration.id}
                          icon={<CheckCircle2 size={15} />}
                          onClick={() => void onManualCheckIn(registration)}
                        >
                          Check in
                        </Button>
                      ) : registration.attendanceStatus === 'checked_in' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Undo2 size={15} />}
                          onClick={() => setUndoTarget(registration)}
                        >
                          Undo
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {filtered.map((registration) => (
              <Card as="li" key={registration.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{registration.name}</p>
                    <p className="truncate text-sm text-ink-600">{registration.email}</p>
                    <p className="text-sm text-ink-500">{registration.phone}</p>
                    <p className="mt-1 font-mono text-xs text-ink-700">
                      {registration.registrationCode}
                    </p>
                  </div>
                  <AttendanceBadge registration={registration} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
                  <span className="text-sm text-ink-500 capitalize">
                    {registration.participationType}
                    {registration.attendanceStatus === 'checked_in'
                      ? ` · ${formatClockTime(registration.checkInTime)}`
                      : ''}
                  </span>
                  {registration.registrationStatus === 'confirmed' &&
                  registration.attendanceStatus !== 'checked_in' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyId === registration.id}
                      onClick={() => void onManualCheckIn(registration)}
                    >
                      Check in
                    </Button>
                  ) : registration.attendanceStatus === 'checked_in' ? (
                    <Button size="sm" variant="ghost" onClick={() => setUndoTarget(registration)}>
                      Undo
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          emoji="🙋"
          title={search ? 'No attendees match that search' : 'No registrations yet'}
          description={
            search
              ? 'Try a different name, email or registration ID.'
              : 'Once people register, they show up here with their check-in status.'
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(undoTarget)}
        title="Undo this check-in?"
        description={`${undoTarget?.name ?? 'This attendee'} will be marked as not checked in, and their QR code becomes scannable again.`}
        confirmLabel="Undo check-in"
        loading={busyId === undoTarget?.id}
        onConfirm={() => void onUndo()}
        onCancel={() => setUndoTarget(null)}
      />
    </div>
  )
}
