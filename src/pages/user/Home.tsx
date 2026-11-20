import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarCheck, CalendarDays, Compass, Heart, Sparkles, Ticket, UserCheck } from 'lucide-react'
import { EventImage, ResponsiveEventCard } from '@/components/events/EventCard'
import { LinkButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ClayCardTitle, ClayStat } from '@/components/ui/Clay'
import { EmptyState, ErrorState, EventCardSkeleton } from '@/components/ui/Feedback'
import { LocationBanner } from '@/components/layout/LocationBanner'
import { useAuth } from '@/hooks/useAuth'
import { useEvents } from '@/hooks/useEvents'
import { useMyRegistrations } from '@/hooks/useMyRegistrations'
import { EMPTY_FILTERS } from '@/types'
import { formatEventDateShort, formatNumber, formatTime } from '@/utils/format'

/**
 * Member dashboard, in the same clay layout as the admin dashboard:
 * welcome banner, four pastel stats, tickets + next-up row, the events grid,
 * and a banner at the foot.
 */
export default function HomePage() {
  const { profile, user } = useAuth()
  const { upcoming, past, attended } = useMyRegistrations(user?.uid)

  const filters = useMemo(() => EMPTY_FILTERS, [])
  const { events, loading, loadingMore, error, hasMore, loadMore, reload } = useEvents(filters, 12)

  useEffect(() => {
    document.title = 'CrewDay — What are you doing this Sunday?'
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const greetingEmoji = hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙'
  const firstName = profile?.name?.trim().split(/\s+/)[0] || 'there'
  const nextTicket = upcoming[0]
  const featured = events[0]
  const interestCount = profile?.interests.length ?? 0

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <header className="relative overflow-hidden rounded-[2rem] bg-[#d5b8e2] px-5 py-5 shadow-soft ring-1 ring-white/70 sm:px-7">
        <div className="flex items-center gap-5">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold text-ink-900">
              {greeting}, {firstName}! {greetingEmoji}
            </h1>
            <p className="mt-1 text-sm text-ink-600">
              {profile?.participationType === 'audience'
                ? 'Here is what you can go and enjoy this week.'
                : 'Here is where you can jump in this week.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton to="/explore" size="sm" icon={<Compass size={16} />}>
                Explore Events
              </LinkButton>
              <LinkButton
                to="/plan"
                size="sm"
                variant="ghost"
                className="bg-white text-brand-600 shadow-soft hover:bg-white"
                icon={<Sparkles size={16} />}
              >
                Plan my day
              </LinkButton>
            </div>
          </div>
          <img
            src="/brand/ref/plant-dash.png"
            alt=""
            className="-my-3 hidden h-32 w-auto shrink-0 md:block"
            onError={(event) => {
              event.currentTarget.hidden = true
            }}
          />
        </div>
      </header>

      <LocationBanner />

      {/* Four pastel stat cards */}
      <div className="stat-pastel grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ClayStat
          icon={<Ticket size={19} />}
          iconClass="bg-brand-400"
          label="Events Joined"
          value={formatNumber(upcoming.length + past.length)}
          note="all time"
        />
        <ClayStat
          icon={<CalendarCheck size={19} />}
          iconClass="bg-sky-400"
          label="Upcoming"
          value={formatNumber(upcoming.length)}
          note={nextTicket ? `next: ${formatEventDateShort(nextTicket.eventDate)}` : 'nothing booked yet'}
        />
        <ClayStat
          icon={<UserCheck size={19} />}
          iconClass="bg-[#f5b23d]"
          label="Attended"
          value={formatNumber(attended.length)}
          note="checked in at the door"
        />
        <ClayStat
          icon={<Heart size={19} />}
          iconClass="bg-grape-400"
          label="Interests"
          value={formatNumber(interestCount)}
          note="on your profile"
        />
      </div>

      {/* Tickets + next up */}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card className="rounded-3xl p-5">
          <ClayCardTitle title="My Tickets" to="/my-events" />
          {upcoming.length ? (
            <ul className="divide-y divide-ink-100">
              {upcoming.slice(0, 3).map((registration) => (
                <li key={registration.id}>
                  <Link to={`/tickets/${registration.id}`} className="group flex items-center gap-3 py-2.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-100 to-sky-100 text-brand-500 shadow-soft">
                      <Ticket size={20} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink-900">
                        {registration.eventTitle}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {formatEventDateShort(registration.eventDate)} · {formatTime(registration.eventStartTime)}
                      </span>
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-500 shadow-soft transition group-hover:bg-brand-500 group-hover:text-white">
                      <ArrowUpRight size={16} aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-200 p-6 text-center">
              <p className="text-sm text-ink-500">No tickets yet. Your weekend is wide open.</p>
              <Link to="/explore" className="mt-2 inline-block text-sm font-bold text-brand-600 hover:underline">
                Find a CrewDay
              </Link>
            </div>
          )}
        </Card>

        <Card className="rounded-3xl p-5">
          <ClayCardTitle title="Don’t Miss" to="/explore" />
          {featured ? (
            <Link
              to={`/events/${featured.id}`}
              className="group relative block h-44 overflow-hidden rounded-2xl shadow-soft"
            >
              <EventImage event={featured} eager className="transition duration-500 group-hover:scale-105" />
              <span
                className="absolute inset-0 bg-linear-to-t from-[#2d2a4a]/85 via-transparent to-transparent"
                aria-hidden
              />
              <span className="absolute right-3 bottom-3 left-4 flex items-end justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg font-extrabold text-white">
                    {featured.title}
                  </span>
                  <span className="block text-xs font-semibold text-white/85">
                    {formatNumber(featured.registeredCount)} going · {formatEventDateShort(featured.date)}
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-500 shadow-soft">
                  <ArrowUpRight size={17} aria-hidden />
                </span>
              </span>
            </Link>
          ) : (
            <p className="text-sm text-ink-500">{loading ? 'Loading…' : 'Nothing scheduled yet.'}</p>
          )}
        </Card>
      </div>

      {/* Upcoming events */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-ink-900">
            <CalendarDays size={18} className="text-brand-500" aria-hidden /> Upcoming Events
          </h2>
          <Link
            to="/explore"
            className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ink-600 shadow-soft hover:text-brand-600"
          >
            See All
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 4 }, (_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : events.length ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {events.map((event, index) => (
                <ResponsiveEventCard key={event.id} event={event} eager={index < 4} />
              ))}
            </div>
            {hasMore ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-600 shadow-soft transition hover:shadow-lift disabled:opacity-60"
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
      </section>

      {/* Bottom banner */}
      <div className="flex flex-wrap items-center gap-4 rounded-[2rem] bg-linear-to-r from-[#c292da] to-brand-500 px-6 py-3 shadow-lift">
        <img
          src="/brand/ref/star.png"
          alt=""
          className="h-16 w-auto shrink-0"
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-extrabold text-white">Step away from work</p>
          <p className="text-sm text-white/85">Meet like-minded people. Do what you love.</p>
        </div>
        <Link
          to="/explore"
          className="rounded-full bg-white/25 px-5 py-2 text-sm font-bold text-white ring-1 ring-white/50 transition hover:bg-white/35"
        >
          Explore Now
        </Link>
      </div>
    </div>
  )
}
