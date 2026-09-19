import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock, MapPin, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { EmptyState, InlineAlert, LoadingScreen } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { getEvent, registrationAvailability } from '@/services/eventService'
import {
  getUserRegistrationForEvent,
  registerForEvent,
  RegistrationError,
} from '@/services/registrationService'
import { createNotification } from '@/services/notificationService'
import { trackSync } from '@/services/analyticsService'
import { formatEventDate, formatPrice, formatTime } from '@/utils/format'
import { validateRegistrationFields } from '@/utils/validation'
import type { CrewEvent, ParticipationType } from '@/types'

export default function RegisterForEventPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { error: toastError } = useToast()

  const [event, setEvent] = useState<CrewEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [participationType, setParticipationType] = useState<ParticipationType>('participant')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!profile) return
    setName((current) => current || profile.name)
    setPhone((current) => current || profile.phone)
    setEmail((current) => current || profile.email)
    setParticipationType(profile.participationType)
  }, [profile])

  useEffect(() => {
    if (!eventId || !user) return
    let cancelled = false

    void (async () => {
      try {
        const [loaded, existing] = await Promise.all([
          getEvent(eventId),
          getUserRegistrationForEvent(eventId, user.uid),
        ])
        if (cancelled) return

        // Already holding a seat? Send them straight to the ticket.
        if (existing && existing.registrationStatus !== 'cancelled') {
          navigate(`/tickets/${existing.id}`, { replace: true })
          return
        }
        setEvent(loaded)
        if (loaded && !loaded.eventTypes.includes('both')) {
          setParticipationType(loaded.eventTypes[0] as ParticipationType)
        }
      } catch {
        if (!cancelled) toastError('We could not load this event.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [eventId, user, navigate, toastError])

  if (loading) return <LoadingScreen label="Getting things ready…" />
  if (!event) {
    return (
      <EmptyState
        emoji="🔍"
        title="Event not found"
        description="This event may have been removed."
      />
    )
  }

  const availability = registrationAvailability(event)
  const errors = touched ? validateRegistrationFields({ name, phone, email }) : {}
  const choosesRole = event.eventTypes.includes('both')

  const onSubmit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    if (!user) return
    setTouched(true)

    const validation = validateRegistrationFields({ name, phone, email })
    if (Object.keys(validation).length) {
      setFormError('Please fix the highlighted fields.')
      return
    }

    setFormError(null)
    setSubmitting(true)
    try {
      const result = await registerForEvent({
        eventId: event.id,
        userId: user.uid,
        name,
        email,
        phone,
        participationType,
      })

      trackSync('registration_completed', {
        eventId: event.id,
        price: event.price,
        role: participationType,
      })

      // In-app confirmation; a Cloud Function mirrors this to a push message.
      void createNotification({
        userId: user.uid,
        type: 'registration_confirmed',
        title:
          result.status === 'confirmed'
            ? `You're in: ${event.title}`
            : `Almost there: ${event.title}`,
        body:
          result.status === 'confirmed'
            ? `${formatEventDate(event.date)} at ${formatTime(event.startTime)} · ${event.venue}`
            : 'Complete payment to confirm your seat.',
        eventId: event.id,
      }).catch(() => undefined)

      navigate(`/registration/${result.registrationId}`, { replace: true })
    } catch (caught) {
      if (caught instanceof RegistrationError) setFormError(caught.message)
      else setFormError('Registration could not be completed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={`/events/${event.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft size={16} aria-hidden /> Back to event
      </Link>

      <h1 className="font-display text-3xl font-extrabold text-ink-900">Register</h1>
      <p className="mt-1 text-ink-500">One quick form and your ticket is ready.</p>

      <Card className="mt-5 p-4">
        <p className="font-display font-bold text-ink-900">{event.title}</p>
        <ul className="mt-2 space-y-1 text-sm text-ink-600">
          <li className="flex items-center gap-2">
            <CalendarDays size={15} className="text-ink-400" aria-hidden />
            {formatEventDate(event.date)}
          </li>
          <li className="flex items-center gap-2">
            <Clock size={15} className="text-ink-400" aria-hidden />
            {formatTime(event.startTime)}
          </li>
          <li className="flex items-center gap-2">
            <MapPin size={15} className="text-ink-400" aria-hidden />
            {event.venue}
          </li>
        </ul>
        <div className="mt-3 border-t border-ink-100 pt-3">
          <span className="font-display text-2xl font-extrabold text-ink-900">
            {formatPrice(event.price, event.currency)}
          </span>
        </div>
      </Card>

      {!availability.canRegister ? (
        <div className="mt-5">
          <InlineAlert tone="warning">{availability.reason}</InlineAlert>
        </div>
      ) : null}

      <form onSubmit={(formEvent) => void onSubmit(formEvent)} className="mt-6 space-y-4" noValidate>
        <Input
          label="Full name"
          required
          value={name}
          onChange={(changeEvent) => setName(changeEvent.target.value)}
          error={errors.name}
          autoComplete="name"
          placeholder="Anaya Sharma"
        />
        <Input
          label="Phone number"
          required
          value={phone}
          onChange={(changeEvent) => setPhone(changeEvent.target.value)}
          error={errors.phone}
          inputMode="tel"
          autoComplete="tel"
          placeholder="9876543210"
          hint="The organiser uses this only for this event."
        />
        <Input
          type="email"
          label="Email"
          required
          value={email}
          onChange={(changeEvent) => setEmail(changeEvent.target.value)}
          error={errors.email}
          autoComplete="email"
          hint="Pre-filled from your account."
        />

        {choosesRole ? (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink-800">
              How are you joining?
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: 'participant' as const, emoji: '🎤', title: 'Participant', body: 'I want to participate.' },
                  { value: 'audience' as const, emoji: '👀', title: 'Audience', body: 'I want to watch and enjoy.' },
                ]
              ).map((option) => {
                const active = participationType === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setParticipationType(option.value)}
                    aria-pressed={active}
                    className={clsx(
                      'rounded-2xl border-2 p-4 text-left transition',
                      active
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-ink-200 bg-white hover:border-brand-300',
                    )}
                  >
                    <span className="text-2xl" aria-hidden>
                      {option.emoji}
                    </span>
                    <p className="mt-1.5 font-bold text-ink-900">{option.title}</p>
                    <p className="text-sm text-ink-600">{option.body}</p>
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : (
          <InlineAlert tone="info">
            This event is for{' '}
            <strong>{event.eventTypes[0] === 'participant' ? 'participants' : 'audience'}</strong>{' '}
            only, so you will be registered in that role.
          </InlineAlert>
        )}

        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}

        {event.price > 0 ? (
          <InlineAlert tone="warning">
            This is a paid event ({formatPrice(event.price, event.currency)}). Your seat is held as{' '}
            <strong>payment pending</strong> until payment is completed — online payment is coming
            soon, and the organiser will contact you with the details.
          </InlineAlert>
        ) : null}

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={submitting}
          disabled={!availability.canRegister}
        >
          Confirm registration
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-500">
          <ShieldCheck size={14} aria-hidden />
          Your details are only shared with this event&apos;s organiser.
        </p>
      </form>
    </div>
  )
}
