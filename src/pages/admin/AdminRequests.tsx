import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock, Mail, Phone, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  approveEventRequest,
  listEventRequests,
  rejectEventRequest,
} from '@/services/eventRequestService'
import { CATEGORY_EMOJI } from '@/utils/constants'
import { formatDateTime, formatEventDateShort, formatPrice, formatTime } from '@/utils/format'
import type { EventRequest, EventRequestStatus } from '@/types'

type Tab = EventRequestStatus | 'all'

const STATUS_TONE: Record<EventRequestStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
}

export default function AdminRequestsPage() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()

  const [tab, setTab] = useState<Tab>('pending')
  const [requests, setRequests] = useState<EventRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reviewing, setReviewing] = useState<{ request: EventRequest; action: 'approve' | 'reject' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listEventRequests(tab)
      .then(setRequests)
      .catch(() => setError('We could not load event requests.'))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(load, [load])

  const submitReview = async () => {
    if (!reviewing || !user) return
    if (reviewing.action === 'reject' && !note.trim()) {
      toastError('Give the member a reason — it lands in their notifications.')
      return
    }

    setBusy(true)
    try {
      if (reviewing.action === 'approve') {
        await approveEventRequest(reviewing.request, user.uid, note)
        success('Approved. The event was created as a draft — add an image and publish it.')
      } else {
        await rejectEventRequest(reviewing.request, user.uid, note)
        success('Request declined and the member notified.')
      }
      setReviewing(null)
      setNote('')
      load()
    } catch {
      toastError('That action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Event requests</h1>
        <p className="mt-1 text-ink-500">
          Ideas members have sent in. Approving one creates a draft event you can finish and publish.
        </p>
      </header>

      <div className="mb-5 max-w-lg">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Declined' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : requests.length ? (
        <ul className="space-y-3">
          {requests.map((request) => (
            <Card as="li" key={request.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-ink-900">
                      {CATEGORY_EMOJI[request.category] ?? '✨'} {request.title}
                    </h2>
                    <Badge tone={STATUS_TONE[request.status]}>{request.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">
                    {formatEventDateShort(request.date)} · {formatTime(request.startTime)} ·{' '}
                    {request.venue}
                    {request.area ? `, ${request.area}` : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-700">
                  {formatPrice(request.price, request.currency)}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-700">
                {request.description}
              </p>

              <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-100 pt-3 text-sm text-ink-600">
                <div className="flex items-center gap-1.5">
                  <Users size={14} className="text-ink-400" aria-hidden />
                  {request.capacity} people · {request.eventTypes[0]}
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail size={14} className="text-ink-400" aria-hidden />
                  {request.requesterName} ({request.requesterEmail})
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={14} className="text-ink-400" aria-hidden />
                  {request.requesterPhone || '—'}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-ink-400" aria-hidden />
                  {formatDateTime(request.createdAt)}
                </div>
              </dl>

              {request.reviewNote ? (
                <p className="mt-3 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-sm text-ink-700">
                  <span className="font-semibold">Your note: </span>
                  {request.reviewNote}
                </p>
              ) : null}

              {request.status === 'pending' ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    icon={<Check size={15} />}
                    onClick={() => {
                      setNote('')
                      setReviewing({ request, action: 'approve' })
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<X size={15} />}
                    onClick={() => {
                      setNote('')
                      setReviewing({ request, action: 'reject' })
                    }}
                  >
                    Decline
                  </Button>
                </div>
              ) : request.createdEventId ? (
                <Link
                  to={`/admin/events/${request.createdEventId}/edit`}
                  className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline"
                >
                  Open the created event →
                </Link>
              ) : null}
            </Card>
          ))}
        </ul>
      ) : (
        <EmptyState
          emoji="💡"
          title={tab === 'pending' ? 'No requests waiting' : 'Nothing here'}
          description="When a member taps + in the app and sends an idea, it lands here."
        />
      )}

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title={reviewing?.action === 'approve' ? 'Approve this request?' : 'Decline this request?'}
        description={
          reviewing?.action === 'approve'
            ? 'This creates a draft event copied from the request. Nothing goes live until you publish it.'
            : 'The member gets your note in their notifications.'
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={reviewing?.action === 'approve' ? 'primary' : 'danger'}
              loading={busy}
              onClick={() => void submitReview()}
            >
              {reviewing?.action === 'approve' ? 'Approve' : 'Decline'}
            </Button>
          </>
        }
      >
        <Textarea
          label={reviewing?.action === 'approve' ? 'Message (optional)' : 'Reason'}
          required={reviewing?.action === 'reject'}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            reviewing?.action === 'approve'
              ? 'Great idea — we will confirm the venue and publish this week.'
              : 'We already have something similar that weekend.'
          }
        />
      </Modal>
    </div>
  )
}
