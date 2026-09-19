import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import {
  CalendarPlus,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  QrCode,
  Star,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Field'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Tabs } from '@/components/ui/Tabs'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  cancelEvent,
  deleteEvent,
  duplicateEvent,
  listAdminEvents,
  setEventFeatured,
  setEventStatus,
} from '@/services/eventService'
import { deleteStoredFile } from '@/services/storageService'
import { notifyEventAudience } from '@/services/notificationService'
import { trackSync } from '@/services/analyticsService'
import { ADMIN_PAGE_SIZE, CATEGORY_EMOJI, EVENT_STATUS_LABEL } from '@/utils/constants'
import { formatEventDateShort, formatPrice, formatTime } from '@/utils/format'
import type { CrewEvent, EventStatus } from '@/types'

type StatusTab = 'all' | EventStatus

const STATUS_TONE: Record<EventStatus, 'brand' | 'neutral' | 'success' | 'warning' | 'danger'> = {
  draft: 'warning',
  open: 'success',
  closed: 'neutral',
  cancelled: 'danger',
  completed: 'brand',
}

function RowActions({
  event,
  onChanged,
  onCancel,
  onDelete,
}: {
  event: CrewEvent
  onChanged: () => void
  onCancel: (event: CrewEvent) => void
  onDelete: (event: CrewEvent) => void
}) {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await action()
      success(message)
      onChanged()
      setOpen(false)
    } catch {
      error('That action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label={`Actions for ${event.title}`}
      >
        <MoreHorizontal size={18} />
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={event.title} size="sm">
        <div className="grid gap-2">
          <LinkButton to={`/admin/events/${event.id}/edit`} variant="outline" fullWidth icon={<Pencil size={16} />}>
            Edit event
          </LinkButton>
          <LinkButton
            to={`/admin/events/${event.id}/attendees`}
            variant="outline"
            fullWidth
            icon={<Users size={16} />}
          >
            Registrations ({event.registeredCount})
          </LinkButton>
          <LinkButton
            to={`/admin/check-in?event=${event.id}`}
            variant="outline"
            fullWidth
            icon={<QrCode size={16} />}
          >
            Scan attendees
          </LinkButton>

          {event.status === 'draft' || event.status === 'closed' ? (
            <Button
              variant="outline"
              fullWidth
              loading={busy}
              icon={<Eye size={16} />}
              onClick={() =>
                void run(async () => {
                  await setEventStatus(event.id, 'open')
                  trackSync('event_published', { eventId: event.id })
                }, 'Event published. It is live in the app now.')
              }
            >
              Publish (open registration)
            </Button>
          ) : null}

          {event.status === 'open' ? (
            <Button
              variant="outline"
              fullWidth
              loading={busy}
              icon={<EyeOff size={16} />}
              onClick={() => void run(() => setEventStatus(event.id, 'closed'), 'Registration closed.')}
            >
              Close registration
            </Button>
          ) : null}

          {event.status !== 'draft' && event.status !== 'completed' ? (
            <Button
              variant="outline"
              fullWidth
              loading={busy}
              onClick={() => void run(() => setEventStatus(event.id, 'completed'), 'Marked as completed.')}
            >
              Mark as completed
            </Button>
          ) : null}

          <Button
            variant="outline"
            fullWidth
            loading={busy}
            icon={<Star size={16} />}
            onClick={() =>
              void run(
                () => setEventFeatured(event.id, !event.featured),
                event.featured ? 'Removed from featured.' : 'Added to featured.',
              )
            }
          >
            {event.featured ? 'Unfeature' : 'Feature on home'}
          </Button>

          <Button
            variant="outline"
            fullWidth
            loading={busy}
            icon={<Copy size={16} />}
            onClick={() =>
              void run(async () => {
                if (!user) throw new Error('Not signed in')
                await duplicateEvent(event.id, user.uid)
              }, 'Duplicated as a new draft, one week out.')
            }
          >
            Duplicate
          </Button>

          {event.status !== 'cancelled' ? (
            <Button
              variant="ghost"
              fullWidth
              className="text-sunset-700 hover:bg-sunset-50"
              icon={<XCircle size={16} />}
              onClick={() => {
                setOpen(false)
                onCancel(event)
              }}
            >
              Cancel event
            </Button>
          ) : null}

          <Button
            variant="ghost"
            fullWidth
            className="text-sunset-700 hover:bg-sunset-50"
            icon={<Trash2 size={16} />}
            onClick={() => {
              setOpen(false)
              onDelete(event)
            }}
          >
            Delete permanently
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default function AdminEventsPage() {
  const { success, error: toastError } = useToast()
  const [tab, setTab] = useState<StatusTab>('all')
  const [events, setEvents] = useState<CrewEvent[]>([])
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cancelTarget, setCancelTarget] = useState<CrewEvent | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelBusy, setCancelBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CrewEvent | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listAdminEvents({ status: tab, pageSize: ADMIN_PAGE_SIZE })
      .then((page) => {
        setEvents(page.events)
        setCursor(page.cursor)
        setHasMore(page.hasMore)
      })
      .catch(() => setError('We could not load events.'))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(load, [load])

  const loadMore = () => {
    if (!cursor) return
    setLoadingMore(true)
    listAdminEvents({ status: tab, pageSize: ADMIN_PAGE_SIZE, cursor })
      .then((page) => {
        setEvents((current) => [...current, ...page.events])
        setCursor(page.cursor)
        setHasMore(page.hasMore)
      })
      .catch(() => toastError('Could not load more events.'))
      .finally(() => setLoadingMore(false))
  }

  const confirmCancel = async () => {
    if (!cancelTarget) return
    setCancelBusy(true)
    try {
      await cancelEvent(cancelTarget.id, cancelReason)
      // Everyone holding a seat hears about it.
      const notified = await notifyEventAudience({
        eventId: cancelTarget.id,
        type: 'event_cancelled',
        title: `${cancelTarget.title} has been cancelled`,
        body: cancelReason
          ? `The organiser cancelled this event. Reason: ${cancelReason}`
          : 'The organiser has cancelled this event. Sorry about that!',
      })
      trackSync('event_cancelled', { eventId: cancelTarget.id })
      success(`Event cancelled. ${notified} attendee(s) notified.`)
      setCancelTarget(null)
      setCancelReason('')
      load()
    } catch {
      toastError('We could not cancel this event.')
    } finally {
      setCancelBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      await deleteEvent(deleteTarget.id)
      if (deleteTarget.imagePath) await deleteStoredFile(deleteTarget.imagePath)
      success('Event deleted.')
      setDeleteTarget(null)
      load()
    } catch {
      toastError('We could not delete this event.')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Events</h1>
          <p className="mt-1 text-ink-500">Create, publish and manage every CrewDay.</p>
        </div>
        <LinkButton to="/admin/events/new" icon={<CalendarPlus size={17} />}>
          Create event
        </LinkButton>
      </header>

      <div className="mb-5 max-w-2xl">
        <Tabs<StatusTab>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Live' },
            { value: 'draft', label: 'Drafts' },
            { value: 'closed', label: 'Closed' },
            { value: 'completed', label: 'Done' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : events.length ? (
        <>
          <ul className="space-y-3">
            {events.map((event) => (
              <Card as="li" key={event.id} className="p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl">
                    {CATEGORY_EMOJI[event.category] ?? '✨'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/events/${event.id}/attendees`}
                        className="font-display font-bold text-ink-900 hover:text-brand-700"
                      >
                        {event.title}
                      </Link>
                      <Badge tone={STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</Badge>
                      {event.featured ? <Badge tone="sunset">⭐ Featured</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-500">
                      {formatEventDateShort(event.date)} · {formatTime(event.startTime)} ·{' '}
                      {event.venue}
                      {event.city ? `, ${event.city}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="font-semibold text-ink-800">
                        {formatPrice(event.price, event.currency)}
                      </span>
                      <span className="text-ink-600">
                        {event.registeredCount}/{event.capacity} registered
                      </span>
                      <span className="text-ink-600">{event.checkedInCount} checked in</span>
                      {event.waitlistCount > 0 ? (
                        <span className="text-ink-600">{event.waitlistCount} waiting</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <LinkButton
                      to={`/admin/events/${event.id}/edit`}
                      size="sm"
                      variant="outline"
                      icon={<Pencil size={15} />}
                    >
                      Edit
                    </LinkButton>
                    <RowActions
                      event={event}
                      onChanged={load}
                      onCancel={setCancelTarget}
                      onDelete={setDeleteTarget}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </ul>

          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <Button variant="outline" loading={loadingMore} onClick={loadMore}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          emoji="📅"
          title="No events here yet"
          description="Create your first CrewDay and publish it to the app."
          action={<LinkButton to="/admin/events/new">Create event</LinkButton>}
        />
      )}

      {/* Cancel */}
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel this event?"
        description="Everyone registered is notified immediately and their tickets show as cancelled."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={cancelBusy}>
              Keep event
            </Button>
            <Button variant="danger" loading={cancelBusy} onClick={() => void confirmCancel()}>
              Cancel event
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (shown to attendees)"
          rows={3}
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder="Venue became unavailable."
        />
      </Modal>

      {/* Delete */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this event permanently?"
        description="Registrations are kept for the record, but the event disappears from the app. Cancelling is usually the better option."
        confirmLabel="Delete event"
        loading={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
