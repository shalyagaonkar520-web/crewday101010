import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { listPublishedEvents } from '@/services/eventService'
import type { CrewEvent, EventFilters } from '@/types'
import { PAGE_SIZE } from '@/utils/constants'

export interface UseEventsResult {
  events: CrewEvent[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  reload: () => void
}

/**
 * Paginated event discovery.
 *
 * Filters are serialised into the effect key so a changed filter always starts
 * a fresh page 1, and a `requestId` guard drops results from a superseded
 * query — otherwise a slow first request can overwrite a newer one.
 */
export function useEvents(filters: EventFilters, pageSize = PAGE_SIZE): UseEventsResult {
  const [events, setEvents] = useState<CrewEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const cursor = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const requestId = useRef(0)
  const filterKey = JSON.stringify(filters)

  useEffect(() => {
    const id = ++requestId.current
    cursor.current = null
    setLoading(true)
    setError(null)

    listPublishedEvents({ filters, pageSize })
      .then((page) => {
        if (id !== requestId.current) return
        setEvents(page.events)
        cursor.current = page.cursor
        setHasMore(page.hasMore)
      })
      .catch(() => {
        if (id !== requestId.current) return
        setError('We could not load events right now. Please try again.')
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false)
      })
    // `filters` is compared by value through `filterKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, pageSize, reloadToken])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || !cursor.current) return
    const id = requestId.current
    setLoadingMore(true)

    listPublishedEvents({ filters, pageSize, cursor: cursor.current })
      .then((page) => {
        if (id !== requestId.current) return
        setEvents((current) => [...current, ...page.events])
        cursor.current = page.cursor
        setHasMore(page.hasMore)
      })
      .catch(() => {
        if (id === requestId.current) setError('We could not load more events.')
      })
      .finally(() => {
        if (id === requestId.current) setLoadingMore(false)
      })
  }, [filters, hasMore, loadingMore, pageSize])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { events, loading, loadingMore, error, hasMore, loadMore, reload }
}
