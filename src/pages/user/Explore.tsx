import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LinkButton } from '@/components/ui/Button'
import { MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { EventRow, EventTile } from '@/components/events/EventCard'
import { EventFilterBar } from '@/components/events/EventFilterBar'
import { LocationBanner } from '@/components/layout/LocationBanner'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { useEvents } from '@/hooks/useEvents'
import { useDebounce } from '@/hooks/useDebounce'
import { listEventCities } from '@/services/eventService'
import { trackSync } from '@/services/analyticsService'
import { EMPTY_FILTERS, type DateFilter, type EventFilters } from '@/types'

/** Filters live in the URL so a filtered view can be shared or bookmarked. */
function filtersFromParams(params: URLSearchParams): EventFilters {
  return {
    ...EMPTY_FILTERS,
    search: params.get('q') ?? '',
    dateFilter: (params.get('when') as DateFilter) || 'any',
    customDateFrom: params.get('from') ?? '',
    customDateTo: params.get('to') ?? '',
    category: params.get('category') ?? '',
    priceFilter: (params.get('price') as EventFilters['priceFilter']) || 'any',
    priceMin: Number(params.get('min') ?? 0) || 0,
    priceMax: Number(params.get('max') ?? EMPTY_FILTERS.priceMax) || EMPTY_FILTERS.priceMax,
    role: (params.get('role') as EventFilters['role']) || 'any',
    city: params.get('city') ?? '',
    area: params.get('area') ?? '',
  }
}

function paramsFromFilters(filters: EventFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.set('q', filters.search)
  if (filters.dateFilter !== 'any') params.set('when', filters.dateFilter)
  if (filters.customDateFrom) params.set('from', filters.customDateFrom)
  if (filters.customDateTo) params.set('to', filters.customDateTo)
  if (filters.category) params.set('category', filters.category)
  if (filters.priceFilter !== 'any') params.set('price', filters.priceFilter)
  if (filters.priceFilter === 'custom') {
    params.set('min', String(filters.priceMin))
    params.set('max', String(filters.priceMax))
  }
  if (filters.role !== 'any') params.set('role', filters.role)
  if (filters.city) params.set('city', filters.city)
  if (filters.area) params.set('area', filters.area)
  return params
}

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [cities, setCities] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams])
  const [searchDraft, setSearchDraft] = useState(filters.search)
  const debouncedFilters = useDebounce(filters, 250)
  const { events, loading, loadingMore, error, hasMore, loadMore, reload } = useEvents(
    debouncedFilters,
    16,
  )

  useEffect(() => setSearchDraft(filters.search), [filters.search])

  // The city list is only needed inside the filter sheet, so it is fetched the
  // first time that opens instead of on every visit to this screen.
  useEffect(() => {
    if (!filtersOpen || cities.length) return
    listEventCities()
      .then(setCities)
      .catch(() => undefined)
  }, [filtersOpen, cities.length])

  useEffect(() => {
    if (debouncedFilters.search) trackSync('event_search', { term: debouncedFilters.search })
  }, [debouncedFilters.search])

  const update = (next: EventFilters) => setSearchParams(paramsFromFilters(next), { replace: true })

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink-900">Discover Events</h1>
        <LinkButton to="/plan" size="sm" variant="outline" className="shrink-0 whitespace-nowrap">
          <span className="sm:hidden">✨ Plan my day</span>
          <span className="hidden sm:inline">✨ Plan my CrewDay</span>
        </LinkButton>
      </div>

      <div className="mt-4 flex gap-2">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            update({ ...filters, search: searchDraft })
          }}
        >
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search events..."
            aria-label="Search events"
            className="h-12 w-full rounded-full bg-surface pr-10 pl-11 text-[0.95rem] shadow-soft ring-1 ring-ink-100 outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-brand-300"
          />
          {searchDraft ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchDraft('')
                update({ ...filters, search: '' })
              }}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-ink-400 hover:bg-ink-100"
            >
              <X size={16} />
            </button>
          ) : null}
        </form>

        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold text-ink-700 shadow-soft ring-1 ring-ink-100 transition hover:text-brand-600"
        >
          {filters.city ? (
            <>
              <MapPin size={16} className="text-brand-400" aria-hidden />
              <span className="max-w-20 truncate">{filters.city}</span>
            </>
          ) : (
            <>
              <SlidersHorizontal size={16} aria-hidden />
              <span>Nearby</span>
            </>
          )}
        </button>
      </div>

      <LocationBanner className="mt-5 mb-5" />

      {/* Event cards are h3s; this keeps the outline h1 > h2 > h3 for crawlers and screen readers. */}
      <h2 className="sr-only">Upcoming events</h2>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-52 w-full rounded-2xl sm:h-30 sm:rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : events.length ? (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-1">
            {events.map((event, index) => (
              <li key={event.id}>
                <div className="h-full sm:hidden">
                  <EventTile event={event} eager={index < 6} />
                </div>
                <div className="hidden sm:block">
                  <EventRow event={event} />
                </div>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full bg-surface px-6 py-3 text-sm font-semibold text-brand-600 shadow-soft ring-1 ring-ink-100 disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load more events'}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          emoji="🔍"
          title="Nothing matches those filters."
          description="Try a different date, category or price range."
        />
      )}

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter events"
        description="Narrow things down to what you actually want to do."
      >
        <EventFilterBar
          filters={filters}
          cities={cities}
          onChange={(next) => {
            update(next)
            setFiltersOpen(false)
          }}
          embedded
        />
      </Modal>
    </div>
  )
}
