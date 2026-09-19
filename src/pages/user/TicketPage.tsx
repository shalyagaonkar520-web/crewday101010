import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { ArrowLeft, ExternalLink, Star, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { Button, LinkButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, InlineAlert, LoadingScreen } from '@/components/ui/Feedback'
import { Textarea } from '@/components/ui/Field'
import { QRTicket } from '@/components/qr/QRTicket'
import { COLLECTIONS, db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { cancelRegistration, mapRegistration } from '@/services/registrationService'
import { getEvent } from '@/services/eventService'
import { getMyEventFeedback, submitEventFeedback } from '@/services/feedbackService'
import { trackSync } from '@/services/analyticsService'
import { todayISO } from '@/utils/format'
import type { CrewEvent, Registration } from '@/types'

function FeedbackCard({ registration }: { registration: Registration }) {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    void getMyEventFeedback(registration.eventId, user.uid)
      .then((existing) => {
        if (existing) {
          setRating(existing.rating)
          setComment(existing.comment)
          setSubmitted(true)
        }
      })
      .catch(() => undefined)
  }, [registration.eventId, user])

  const send = async () => {
    if (!user || rating < 1) return
    setBusy(true)
    try {
      await submitEventFeedback({
        eventId: registration.eventId,
        userId: user.uid,
        rating,
        comment,
      })
      trackSync('feedback_submitted', { eventId: registration.eventId, rating })
      setSubmitted(true)
      success('Thanks! That helps us plan better CrewDays.')
    } catch {
      error('We could not save your feedback. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-6 p-5">
      <h2 className="font-display text-lg font-bold text-ink-900">How was your CrewDay?</h2>
      <p className="mt-1 text-sm text-ink-500">
        {submitted ? 'Thanks for rating this event.' : 'Your feedback shapes the next one.'}
      </p>

      <div className="mt-4 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} star${value > 1 ? 's' : ''}`}
            onClick={() => setRating(value)}
            className="rounded-full p-1 transition hover:scale-110"
          >
            <Star
              size={28}
              className={clsx(
                value <= rating ? 'fill-sunset-400 text-sunset-400' : 'text-ink-300',
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>

      {!submitted ? (
        <div className="mt-4 space-y-3">
          <Textarea
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What worked? What would you change?"
            aria-label="Feedback comment"
          />
          <Button loading={busy} disabled={rating < 1} onClick={() => void send()}>
            Send feedback
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

export default function TicketPage() {
  const { registrationId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { success, error: toastError } = useToast()

  const [registration, setRegistration] = useState<Registration | null>(null)
  const [event, setEvent] = useState<CrewEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Live so an organiser scan flips this screen to CHECKED IN instantly.
  useEffect(() => {
    if (!registrationId) return
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.registrations, registrationId),
      (snapshot) => {
        setRegistration(snapshot.exists() ? mapRegistration(snapshot) : null)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsubscribe
  }, [registrationId])

  useEffect(() => {
    if (!registration) return
    trackSync('ticket_viewed', { eventId: registration.eventId })
    void getEvent(registration.eventId).then(setEvent).catch(() => undefined)
  }, [registration])

  if (loading) return <LoadingScreen label="Loading your ticket…" />

  if (!registration || (user && registration.userId !== user.uid)) {
    return (
      <EmptyState
        emoji="🎫"
        title="Ticket not found"
        description="This ticket does not exist, or it belongs to another account."
        action={<LinkButton to="/my-events">Back to My Events</LinkButton>}
      />
    )
  }

  const isUpcoming = registration.eventDate >= todayISO()
  const isPast = !isUpcoming
  const canCancel =
    isUpcoming &&
    registration.registrationStatus !== 'cancelled' &&
    registration.attendanceStatus !== 'checked_in'

  const onCancel = async () => {
    setCancelling(true)
    try {
      await cancelRegistration(registration.id, 'Cancelled by attendee')
      trackSync('registration_cancelled', { eventId: registration.eventId })
      success('Your registration has been cancelled.')
      setConfirmOpen(false)
      navigate('/my-events')
    } catch (caught) {
      toastError(caught instanceof Error ? caught.message : 'We could not cancel this registration.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Link
        to="/my-events"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft size={16} aria-hidden /> My Events
      </Link>

      <h1 className="mb-4 font-display text-2xl font-extrabold text-ink-900">Your CrewDay Ticket</h1>

      {event?.status === 'cancelled' ? (
        <div className="mb-4">
          <InlineAlert tone="danger">
            The organiser cancelled this event.
            {event.cancelledReason ? ` Reason: ${event.cancelledReason}` : ''}
          </InlineAlert>
        </div>
      ) : null}

      <QRTicket registration={registration} />

      <div className="mt-6 space-y-3">
        <LinkButton to={`/events/${registration.eventId}`} variant="outline" fullWidth icon={<ExternalLink size={17} />}>
          View event details
        </LinkButton>

        {canCancel ? (
          <Button
            variant="ghost"
            fullWidth
            className="text-sunset-700 hover:bg-sunset-50"
            icon={<XCircle size={17} />}
            onClick={() => setConfirmOpen(true)}
          >
            Cancel my registration
          </Button>
        ) : null}
      </div>

      {isPast && registration.attendanceStatus === 'checked_in' ? (
        <FeedbackCard registration={registration} />
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Cancel this registration?"
        description="Your seat goes back to the pool and your QR code stops working. You can register again later if seats are still available."
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep my seat"
        loading={cancelling}
        onConfirm={() => void onCancel()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
