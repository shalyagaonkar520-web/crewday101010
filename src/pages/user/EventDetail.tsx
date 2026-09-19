import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  Share2,
  Ticket,
  Users,
} from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, InlineAlert, LoadingScreen } from '@/components/ui/Feedback'
import { EventImage, EventKindPill } from '@/components/events/EventCard'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  registrationAvailability,
  seatsLeft,
  subscribeToEvent,
} from '@/services/eventService'
import {
  getUserRegistrationForEvent,
  getWaitlistEntry,
  joinWaitlist,
  leaveWaitlist,
} from '@/services/registrationService'
import { trackSync } from '@/services/analyticsService'
import { AUDIENCE_TYPE_LABEL, CATEGORY_EMOJI } from '@/utils/constants'
import { formatEventDate, formatPrice, formatTimeRange } from '@/utils/format'
import type { CrewEvent, Registration, WaitlistEntry } from '@/types'

export default function EventDetailPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const { user, profile, isAuthenticated } = useAuth()
  const { success, error: toastError, info } = useToast()

  const [event, setEvent] = useState<CrewEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [waitlist, setWaitlist] = useState<WaitlistEntry | null>(null)
  const [waitlistBusy, setWaitlistBusy] = useState(false)

  useEffect(() => {
    if (!eventId) return
    setLoading(true)
    const unsubscribe = subscribeToEvent(
      eventId,
      (next) => {
        setEvent(next)
        setLoadError(null)
        setLoading(false)
      },
      () => {
        setLoadError('We could not load this event.')
        setLoading(false)
      },
    )
    return unsubscribe
  }, [eventId])

  useEffect(() => {
    if (!user || !eventId) {
      setRegistration(null)
      setWaitlist(null)
      return
    }
    void getUserRegistrationForEvent(eventId, user.uid).then(setRegistration).catch(() => undefined)
    void getWaitlistEntry(eventId, user.uid).then(setWaitlist).catch(() => undefined)
  }, [user, eventId])

  useEffect(() => {
    if (event) trackSync('event_viewed', { eventId: event.id, category: event.category })
  }, [event])

  if (loading) return <LoadingScreen label="Loading event…" />
  if (loadError) return <ErrorState description={loadError} onRetry={() => window.location.reload()} />
  if (!event) {
    return (
      <EmptyState
        emoji="🔍"
        title="Event not found"
        description="This event may have been removed by the organiser."
        action={<LinkButton to="/explore">Explore events</LinkButton>}
      />
    )
  }

  const availability = registrationAvailability(event)
  const left = seatsLeft(event)
  const hasLiveRegistration =
    registration !== null && registration.registrationStatus !== 'cancelled'

  const onRegister = () => {
    if (!isAuthenticated) {
      info('Sign in to register for this CrewDay.')
      navigate('/login', { state: { from: `/events/${event.id}/register` } })
      return
    }
    if (profile?.status === 'suspended') {
      toastError('Your account is suspended, so you cannot register right now.')
      return
    }
    trackSync('registration_started', { eventId: event.id })
    navigate(`/events/${event.id}/register`)
  }

  const onShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: event.title, url })
      else {
        await navigator.clipboard.writeText(url)
        success('Link copied. Go rally your crew.')
      }
    } catch {
      // Cancelled share sheet — nothing to report.
    }
  }

  const onWaitlist = async () => {
    if (!user || !profile) {
      navigate('/login', { state: { from: `/events/${event.id}` } })
      return
    }
    setWaitlistBusy(true)
    try {
      if (waitlist?.status === 'waiting') {
        await leaveWaitlist(event.id, user.uid)
        setWaitlist(null)
        info('You have left the waitlist.')
      } else {
        await joinWaitlist({
          eventId: event.id,
          userId: user.uid,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          participationType: profile.participationType,
        })
        setWaitlist(await getWaitlistEntry(event.id, user.uid))
        trackSync('waitlist_joined', { eventId: event.id })
        success('You are on the waitlist. We will tell you if a seat opens.')
      }
    } catch (caught) {
      toastError(caught instanceof Error ? caught.message : 'Could not update the waitlist.')
    } finally {
      setWaitlistBusy(false)
    }
  }

  return (
    <article className="pb-24 lg:pb-0">
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div>
          <div className="relative -mx-4 aspect-4/3 overflow-hidden bg-ink-100 sm:mx-0 sm:aspect-16/9 sm:rounded-card sm:shadow-soft">
            <EventImage event={event} eager />
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
              <Link
                to="/explore"
                aria-label="Back to events"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink-800 shadow-soft backdrop-blur transition active:scale-95"
              >
                <ArrowLeft size={19} aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => void onShare()}
                aria-label="Share this event"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink-800 shadow-soft backdrop-blur transition active:scale-95"
              >
                <Share2 size={17} aria-hidden />
              </button>
            </div>
            <div className="absolute bottom-4 left-4">
              <EventKindPill event={event} />
            </div>
            {event.featured ? (
              <span className="absolute right-4 bottom-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-brand-600 shadow-soft backdrop-blur">
                ⭐ Featured
              </span>
            ) : null}
          </div>

          <h1 className="mt-5 font-display text-2xl leading-tight font-bold text-ink-900 sm:text-3xl">
            {event.title}
          </h1>

          <ul className="mt-3 space-y-2 text-[0.95rem] text-ink-600">
            <li className="flex items-center gap-2.5">
              <MapPin size={17} className="shrink-0 text-brand-400" aria-hidden />
              {event.venue}
              {event.city ? `, ${event.city}` : ''}
            </li>
            <li className="flex items-center gap-2.5">
              <CalendarDays size={17} className="shrink-0 text-sky-400" aria-hidden />
              {formatEventDate(event.date)} · {formatTimeRange(event.startTime, event.endTime)}
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-600">
              {CATEGORY_EMOJI[event.category] ?? '✨'} {event.category}
            </span>
            <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-600">
              {AUDIENCE_TYPE_LABEL[event.eventTypes[0] ?? 'both']}
            </span>
            {event.isFree ? (
              <span className="rounded-full bg-mint-100 px-3 py-1.5 text-xs font-semibold text-mint-600">
                Free entry
              </span>
            ) : null}
            {event.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-grape-50 px-3 py-1.5 text-xs font-semibold text-grape-600"
              >
                {tag}
              </span>
            ))}
          </div>

          {event.status === 'cancelled' || event.status === 'closed' ? (
            <div className="mt-3">
              <Badge tone={event.status === 'cancelled' ? 'danger' : 'neutral'}>
                {event.status === 'cancelled' ? 'Cancelled' : 'Registration closed'}
              </Badge>
            </div>
          ) : null}

          {event.status === 'cancelled' ? (
            <div className="mt-5">
              <InlineAlert tone="danger">
                This event has been cancelled by the organiser.
                {event.cancelledReason ? ` Reason: ${event.cancelledReason}` : ''}
              </InlineAlert>
            </div>
          ) : null}

          <section className="mt-6">
            <h2 className="font-display text-lg font-bold text-ink-900">About this CrewDay</h2>
            <p className="mt-2 leading-relaxed whitespace-pre-wrap text-ink-700">
              {event.description}
            </p>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-ink-900">Where</h2>
            <Card className="mt-3 p-4">
              <p className="font-semibold text-ink-900">{event.venue}</p>
              <p className="mt-0.5 text-sm text-ink-600">{event.address}</p>
              <p className="mt-0.5 text-sm text-ink-500">
                {[event.area, event.city].filter(Boolean).join(', ')}
              </p>
              {event.mapsURL ? (
                <a
                  href={event.mapsURL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                >
                  Open in Maps <ExternalLink size={14} aria-hidden />
                </a>
              ) : null}
            </Card>
          </section>
        </div>

        {/* Booking panel */}
        <aside className="lg:sticky lg:top-24">
          <Card className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-3xl font-extrabold text-ink-900">
                {formatPrice(event.price, event.currency)}
              </span>
              <span className="text-sm font-semibold text-ink-500">
                {event.registeredCount} / {event.capacity} seats
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-linear-to-r from-brand-500 to-sunset-500"
                style={{
                  width: `${Math.min(100, Math.round((event.registeredCount / Math.max(1, event.capacity)) * 100))}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-sm text-ink-500">
              {left > 0 ? `${left} seat${left === 1 ? '' : 's'} left` : 'No seats left'}
            </p>

            <ul className="mt-5 space-y-3 border-t border-ink-100 pt-5">
              {[
                {
                  icon: <Users size={17} aria-hidden />,
                  tile: 'bg-brand-50 text-brand-500',
                  label: 'Organised by',
                  value: 'CrewDay Team',
                },
                {
                  icon: <Ticket size={17} aria-hidden />,
                  tile: 'bg-sky-50 text-sky-500',
                  label: 'Participation type',
                  value: event.eventTypes.includes('both')
                    ? `Participant or audience · ${formatPrice(event.price, event.currency)}`
                    : `${AUDIENCE_TYPE_LABEL[event.eventTypes[0]]} · ${formatPrice(event.price, event.currency)}`,
                },
                {
                  icon: <Clock size={17} aria-hidden />,
                  tile: 'bg-grape-50 text-grape-500',
                  label: 'Capacity',
                  value: `${event.registeredCount} / ${event.capacity}`,
                },
              ].map((row) => (
                <li key={row.label} className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${row.tile}`}
                  >
                    {row.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-ink-400">{row.label}</span>
                    <span className="block truncate text-sm font-semibold text-ink-800">
                      {row.value}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-3">
              {hasLiveRegistration ? (
                <>
                  <InlineAlert tone="success">
                    You are registered. Your ticket is ready.
                  </InlineAlert>
                  <LinkButton
                    to={`/tickets/${registration.id}`}
                    fullWidth
                    size="lg"
                    icon={<Ticket size={18} />}
                  >
                    View your ticket
                  </LinkButton>
                </>
              ) : availability.canRegister ? (
                <Button fullWidth size="lg" onClick={onRegister}>
                  Register Now
                </Button>
              ) : (
                <>
                  <InlineAlert tone={event.status === 'cancelled' ? 'danger' : 'warning'}>
                    {availability.reason}
                  </InlineAlert>
                  {left <= 0 &&
                  event.waitlistEnabled &&
                  event.status === 'open' &&
                  !hasLiveRegistration ? (
                    <Button
                      fullWidth
                      size="lg"
                      variant={waitlist?.status === 'waiting' ? 'outline' : 'primary'}
                      loading={waitlistBusy}
                      onClick={() => void onWaitlist()}
                    >
                      {waitlist?.status === 'waiting'
                        ? `On the waitlist (#${waitlist.position}) — leave`
                        : 'Join waitlist'}
                    </Button>
                  ) : null}
                </>
              )}

              <Button variant="ghost" fullWidth icon={<Share2 size={17} />} onClick={() => void onShare()}>
                Share this event
              </Button>
            </div>

            {!event.isFree ? (
              <p className="mt-4 text-center text-xs text-ink-500">
                Paid events are confirmed once payment is completed.
              </p>
            ) : null}
          </Card>
        </aside>
      </div>

      {/* Mobile sticky action bar */}
      {!hasLiveRegistration && availability.canRegister ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/95 px-4 pt-3 backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.75rem)' }}
        >
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="flex-1">
              <p className="font-display text-lg font-bold text-ink-900">
                {formatPrice(event.price, event.currency)}
              </p>
              <p className="text-xs text-ink-500">{left} seats left</p>
            </div>
            <Button size="lg" className="flex-1" onClick={onRegister}>
              Register Now
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
