import type { ReactNode } from 'react'
import { EmptyState, ErrorState, EventCardSkeleton } from '@/components/ui/Feedback'
import { EventCard } from '@/components/events/EventCard'
import type { CrewEvent } from '@/types'

export function EventGrid({
  events,
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onRetry,
  emptyTitle = 'No events near you yet.',
  emptyDescription = 'New CrewDays get added all the time. Check back soon or widen your filters.',
  emptyAction,
}: {
  events: CrewEvent[]
  loading: boolean
  loadingMore?: boolean
  error?: string | null
  hasMore?: boolean
  onLoadMore?: () => void
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState description={error} onRetry={onRetry} />
  }

  if (!events.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event, index) => (
          <EventCard key={event.id} event={event} eager={index < 3} />
        ))}
      </div>

      {hasMore && onLoadMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-600 shadow-soft ring-1 ring-ink-100 transition hover:shadow-lift disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more events'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
