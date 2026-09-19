import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarX2, CheckCircle2, ChevronRight, Clock3, Ticket } from 'lucide-react'
import { Badge, Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Tabs } from '@/components/ui/Tabs'
import { useAuth } from '@/hooks/useAuth'
import { useMyRegistrations } from '@/hooks/useMyRegistrations'
import { formatClockTime, formatEventDateShort, formatTime } from '@/utils/format'
import type { Registration } from '@/types'

type Tab = 'upcoming' | 'past' | 'attended' | 'cancelled'

function StatusBadge({ registration }: { registration: Registration }) {
  if (registration.registrationStatus === 'cancelled') return <Badge tone="danger">Cancelled</Badge>
  if (registration.attendanceStatus === 'checked_in')
    return (
      <Badge tone="success">
        <CheckCircle2 size={12} aria-hidden /> Attended
      </Badge>
    )
  if (registration.registrationStatus === 'pending_payment')
    return <Badge tone="warning">Payment pending</Badge>
  return <Badge tone="brand">Registered</Badge>
}

function RegistrationRow({ registration }: { registration: Registration }) {
  return (
    <Card as="li" className="overflow-hidden transition hover:border-brand-200 hover:shadow-lift">
      <Link to={`/tickets/${registration.id}`} className="flex items-center gap-4 p-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <span className="text-xs font-bold uppercase">
            {formatEventDateShort(registration.eventDate).split(' ')[2] ?? ''}
          </span>
          <span className="font-display text-lg leading-none font-extrabold">
            {registration.eventDate.slice(-2)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold text-ink-900">{registration.eventTitle}</p>
          <p className="truncate text-sm text-ink-500">
            {formatEventDateShort(registration.eventDate)} · {formatTime(registration.eventStartTime)}
          </p>
          <p className="truncate text-sm text-ink-500">{registration.eventVenue}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge registration={registration} />
            <span className="text-xs font-medium text-ink-400">
              {registration.participationType === 'participant' ? '🎤 Participant' : '👀 Audience'}
            </span>
            {registration.attendanceStatus === 'checked_in' ? (
              <span className="text-xs text-ink-400">
                at {formatClockTime(registration.checkInTime)}
              </span>
            ) : null}
          </div>
        </div>

        <ChevronRight size={18} className="shrink-0 text-ink-300" aria-hidden />
      </Link>
    </Card>
  )
}

const EMPTY_COPY: Record<Tab, { emoji: string; title: string; description: string }> = {
  upcoming: {
    emoji: '🎟️',
    title: 'No upcoming CrewDays',
    description: 'Once you register for an event, your ticket shows up here.',
  },
  past: {
    emoji: '🕰️',
    title: 'Nothing in the past yet',
    description: 'Events you attended or missed will be listed here.',
  },
  attended: {
    emoji: '✅',
    title: 'No check-ins yet',
    description: 'Show your QR code at the venue and this fills up.',
  },
  cancelled: {
    emoji: '🚫',
    title: 'Nothing cancelled',
    description: 'Cancelled registrations and events appear here.',
  },
}

export default function MyEventsPage() {
  const { user } = useAuth()
  const { upcoming, past, attended, cancelled, loading, error } = useMyRegistrations(user?.uid)
  const [tab, setTab] = useState<Tab>('upcoming')

  const lists: Record<Tab, Registration[]> = { upcoming, past, attended, cancelled }
  const current = lists[tab]

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">My Events</h1>
        <p className="mt-1 text-ink-500">Your tickets, check-ins and history.</p>
      </header>

      <div className="mb-5">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { value: 'past', label: 'Past', count: past.length },
            { value: 'attended', label: 'Attended', count: attended.length },
            { value: 'cancelled', label: 'Cancelled', count: cancelled.length },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={() => window.location.reload()} />
      ) : current.length ? (
        <ul className="space-y-3">
          {current.map((registration) => (
            <RegistrationRow key={registration.id} registration={registration} />
          ))}
        </ul>
      ) : (
        <EmptyState
          emoji={EMPTY_COPY[tab].emoji}
          title={EMPTY_COPY[tab].title}
          description={EMPTY_COPY[tab].description}
          action={
            tab === 'upcoming' ? (
              <LinkButton to="/explore" icon={<Ticket size={18} />}>
                Find a CrewDay
              </LinkButton>
            ) : undefined
          }
        />
      )}

      {tab === 'upcoming' && upcoming.length > 0 ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-400">
          <Clock3 size={15} aria-hidden />
          Tickets update live — your QR flips to “checked in” the moment you are scanned.
        </p>
      ) : null}

      {tab === 'cancelled' && cancelled.length > 0 ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-400">
          <CalendarX2 size={15} aria-hidden />
          Cancelled by you or by the organiser.
        </p>
      ) : null}
    </div>
  )
}
