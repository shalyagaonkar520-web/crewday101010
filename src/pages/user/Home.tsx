import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Ticket } from 'lucide-react'
import { EventCard } from '@/components/events/EventCard'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, EventCardSkeleton } from '@/components/ui/Feedback'
import { LocationBanner } from '@/components/layout/LocationBanner'
import { useAuth } from '@/hooks/useAuth'
import { useEvents } from '@/hooks/useEvents'
import { useMyRegistrations } from '@/hooks/useMyRegistrations'
import { EMPTY_FILTERS } from '@/types'
import { formatEventDateShort, formatTime } from '@/utils/format'

function NextTicketCard() {
  const { user } = useAuth()
  const { upcoming } = useMyRegistrations(user?.uid)
  const next = upcoming[0]
  if (!next) return null

  return (
    <Link
      to={`/tickets/${next.id}`}
      className="mb-6 flex items-center gap-4 rounded-card bg-linear-to-r from-brand-500 to-sky-500 p-4 shadow-pink transition active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur">
        <Ticket size={22} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] font-bold tracking-wider text-white/80 uppercase">
          Your next CrewDay
        </p>
        <p className="truncate font-display font-bold text-white">{next.eventTitle}</p>
        <p className="truncate text-sm text-white/80">
          {formatEventDateShort(next.eventDate)} · {formatTime(next.eventStartTime)}
        </p>
      </div>
      <ArrowRight size={20} className="shrink-0 text-white/90" aria-hidden />
    </Link>
  )
}

export default function HomePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const filters = useMemo(() => EMPTY_FILTERS, [])
  const { events, loading, loadingMore, error, hasMore, loadMore, reload } = useEvents(filters, 12)

  useEffect(() => {
    document.title = 'CrewDay — What are you doing this Sunday?'
  }, [])

  return (
    <div>
      <LocationBanner className="mb-5" />

      <section className="mb-5">
        <h1 className="font-display text-[1.65rem] leading-tight font-bold text-ink-900">
          Hey {profile?.name?.trim().split(/\s+/)[0] || 'there'} 👋
        </h1>
        <p className="mt-1 text-ink-500">
          {profile?.participationType === 'audience'
            ? 'Here is what you can go and enjoy this week.'
            : 'Here is where you can jump in this week.'}
        </p>
      </section>

      <NextTicketCard />

      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-lg font-bold text-ink-900">Upcoming Events</h2>
        <Link
          to="/explore"
          className="flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-600"
        >
          See All <ArrowRight size={14} />
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }, (_, index) => (
            <EventCardSkeleton key={index} />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : events.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, index) => (
              <EventCard key={event.id} event={event} eager={index < 2} />
            ))}
          </div>
          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-600 shadow-soft ring-1 ring-ink-100 transition hover:shadow-lift disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load more events'}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          emoji="🎈"
          title="No events yet."
          description="New CrewDays get added all the time. Check back soon."
          action={<LinkButton to="/explore">Explore all events</LinkButton>}
        />
      )}

      <button
        type="button"
        onClick={() => navigate('/explore')}
        className="mt-8 w-full rounded-card bg-linear-to-r from-grape-100 via-brand-50 to-sky-100 p-5 text-left shadow-soft transition active:scale-[0.99]"
      >
        <p className="font-display text-lg font-bold text-ink-900">Step away from work.</p>
        <p className="mt-0.5 text-sm text-ink-600">
          Meet like-minded people · Do what you love
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-600">
          Discover events <ArrowRight size={15} />
        </span>
      </button>
    </div>
  )
}
