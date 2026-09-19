import { Link } from 'react-router-dom'
import { CalendarDays, MapPin, Users } from 'lucide-react'
import clsx from 'clsx'
import type { CrewEvent } from '@/types'
import { isSoldOut, seatsLeft } from '@/services/eventService'
import { CATEGORY_EMOJI } from '@/utils/constants'
import { formatEventDateShort, formatPrice, formatTime, truncate } from '@/utils/format'

/**
 * Each category gets its own pastel wash.
 *
 * With photography removed this panel *is* the card's visual, so a single
 * gradient everywhere would make a feed of events look like one repeated tile.
 */
const CATEGORY_TINT: Record<string, string> = {
  Singing: 'from-sky-200 via-sky-100 to-brand-100',
  Dance: 'from-grape-200 via-grape-100 to-brand-100',
  DJ: 'from-brand-200 via-grape-200 to-sky-200',
  Party: 'from-brand-200 via-brand-100 to-sunset-100',
  Gaming: 'from-mint-100 via-sky-100 to-grape-100',
  Music: 'from-brand-200 via-brand-100 to-sky-100',
  Sports: 'from-sky-200 via-mint-100 to-sky-100',
  Fitness: 'from-mint-100 via-mint-100 to-sky-100',
  Photography: 'from-grape-100 via-sky-100 to-brand-100',
  Art: 'from-sunset-100 via-brand-100 to-grape-100',
  Travel: 'from-sky-200 via-grape-100 to-brand-100',
  Food: 'from-sunset-100 via-sunset-50 to-brand-100',
  Festival: 'from-brand-200 via-sunset-100 to-grape-200',
  Technology: 'from-sky-200 via-sky-100 to-grape-100',
  Books: 'from-grape-100 via-brand-50 to-sky-100',
  Other: 'from-brand-100 via-grape-100 to-sky-100',
}

export function EventImage({
  event,
  className,
  eager,
}: {
  event: Pick<CrewEvent, 'imageURL' | 'title' | 'category'>
  className?: string
  eager?: boolean
}) {
  if (event.imageURL) {
    return (
      <img
        src={event.imageURL}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={clsx('h-full w-full object-cover', className)}
      />
    )
  }
  return (
    <div
      className={clsx(
        'relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br',
        CATEGORY_TINT[event.category] ?? CATEGORY_TINT.Other,
        className,
      )}
      aria-hidden
    >
      {/* Soft bloom so the panel has depth rather than reading as a flat block. */}
      <span className="absolute -top-8 -left-6 h-28 w-28 rounded-full bg-white/35 blur-2xl" />
      <span className="absolute -right-8 -bottom-10 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
      <span className="relative text-5xl drop-shadow-sm sm:text-6xl">
        {CATEGORY_EMOJI[event.category] ?? '✨'}
      </span>
    </div>
  )
}

/** The pink pill that sits over the photo, naming the kind of event. */
const KIND_BY_CATEGORY: Record<string, string> = {
  Singing: 'Open Mic',
  Dance: 'Dance Night',
  DJ: 'DJ Night',
  Party: 'Party',
  Festival: 'Festival',
  Gaming: 'Game Night',
  Music: 'Live Music',
  Technology: 'Workshop',
  Fitness: 'Workshop',
}

export function EventKindPill({ event }: { event: Pick<CrewEvent, 'category' | 'date'> }) {
  const weekday = event.date ? formatEventDateShort(event.date).split(',')[0] : ''
  const kind =
    KIND_BY_CATEGORY[event.category] ?? (weekday === 'Sun' ? 'Sunday Meetup' : 'Meetup')

  return (
    <span className="rounded-full bg-brand-500 px-3 py-1 text-[0.7rem] font-semibold text-white shadow-soft">
      {kind}
    </span>
  )
}

/** Price as a pill: free events get pink, paid get the blue accent. */
export function PricePill({ event, className }: { event: CrewEvent; className?: string }) {
  return (
    <span
      className={clsx(
        'rounded-full px-3.5 py-1.5 text-sm font-bold whitespace-nowrap',
        event.isFree ? 'bg-brand-500 text-white shadow-pink' : 'bg-sky-100 text-sky-700',
        className,
      )}
    >
      {event.isFree ? 'Join Free' : formatPrice(event.price, event.currency)}
    </span>
  )
}

function MetaRow({ event }: { event: CrewEvent }) {
  return (
    <ul className="mt-2 space-y-1.5 text-[0.82rem] text-ink-500">
      <li className="flex items-center gap-1.5">
        <MapPin size={14} className="shrink-0 text-brand-400" aria-hidden />
        <span className="truncate">
          {event.area || event.venue}
          {event.city ? `, ${event.city}` : ''}
        </span>
      </li>
      <li className="flex items-center gap-1.5">
        <CalendarDays size={14} className="shrink-0 text-sky-400" aria-hidden />
        <span>
          {formatEventDateShort(event.date)} · {formatTime(event.startTime)}
        </span>
      </li>
      <li className="flex items-center gap-1.5">
        <Users size={14} className="shrink-0 text-grape-400" aria-hidden />
        <span>
          {event.registeredCount} going
          {isSoldOut(event) ? ' · full' : seatsLeft(event) <= 5 ? ` · ${seatsLeft(event)} left` : ''}
        </span>
      </li>
    </ul>
  )
}

/**
 * The full-width card used on Home: photo on top, details below, with the
 * price or join action sitting on the baseline so a column of these scans
 * cleanly down the right edge.
 */
export function EventCard({ event, eager }: { event: CrewEvent; eager?: boolean }) {
  return (
    <article className="h-full">
      <Link
        to={`/events/${event.id}`}
        className="flex h-full flex-col overflow-hidden rounded-card bg-white shadow-soft ring-1 ring-ink-100/70 transition-shadow duration-200 hover:shadow-lift"
      >
        <div className="relative aspect-16/9 overflow-hidden bg-ink-100">
          <EventImage event={event} eager={eager} />
          <div className="absolute top-3 left-3">
            <EventKindPill event={event} />
          </div>
          {event.featured ? (
            <span className="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[0.7rem] font-bold text-brand-600 shadow-soft backdrop-blur">
              ⭐ Featured
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 items-end justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base leading-snug font-bold text-ink-900">
              {truncate(event.title, 46)}
            </h3>
            <MetaRow event={event} />
          </div>
          <PricePill event={event} className="mb-0.5 shrink-0" />
        </div>
      </Link>
    </article>
  )
}

/**
 * Compact list row for Explore — a square thumbnail beside the details, so
 * many more events fit on one phone screen.
 */
export function EventRow({ event }: { event: CrewEvent }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="relative flex gap-3.5 rounded-3xl bg-white p-3 pb-11 shadow-soft ring-1 ring-ink-100/70 transition-shadow duration-200 hover:shadow-lift sm:pb-3"
    >
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-ink-100">
        <EventImage event={event} />
      </div>

      <div className="min-w-0 flex-1 sm:pr-24">
        <EventKindPill event={event} />
        <h3 className="mt-1.5 font-display text-[0.95rem] leading-snug font-bold text-ink-900">
          {truncate(event.title, 40)}
        </h3>
        <MetaRow event={event} />
      </div>

      {/* Anchored rather than a third column: at 360px a three-column row
          crushed the details into two words per line. */}
      <PricePill event={event} className="absolute right-3 bottom-3" />
    </Link>
  )
}
