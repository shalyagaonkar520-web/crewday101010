import { useEffect, useMemo, useState } from 'react'
import { subscribeToUserRegistrations } from '@/services/registrationService'
import type { Registration } from '@/types'
import { todayISO } from '@/utils/format'

export interface GroupedRegistrations {
  upcoming: Registration[]
  past: Registration[]
  attended: Registration[]
  cancelled: Registration[]
}

export interface UseMyRegistrationsResult extends GroupedRegistrations {
  all: Registration[]
  loading: boolean
  error: string | null
}

/**
 * Live "My Events" data.
 *
 * A real-time listener means a ticket flips to CHECKED IN on the attendee's own
 * phone the moment the organiser scans it.
 */
export function useMyRegistrations(uid: string | undefined): UseMyRegistrationsResult {
  const [all, setAll] = useState<Registration[]>([])
  const [loading, setLoading] = useState(Boolean(uid))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) {
      setAll([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToUserRegistrations(
      uid,
      (registrations) => {
        setAll(registrations)
        setError(null)
        setLoading(false)
      },
      () => {
        setError('We could not load your tickets. Please try again.')
        setLoading(false)
      },
    )
    return unsubscribe
  }, [uid])

  const grouped = useMemo<GroupedRegistrations>(() => {
    const today = todayISO()
    const upcoming: Registration[] = []
    const past: Registration[] = []
    const attended: Registration[] = []
    const cancelled: Registration[] = []

    for (const registration of all) {
      if (registration.registrationStatus === 'cancelled') {
        cancelled.push(registration)
        continue
      }
      if (registration.attendanceStatus === 'checked_in') attended.push(registration)
      if (registration.eventDate >= today) upcoming.push(registration)
      else past.push(registration)
    }

    upcoming.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    return { upcoming, past, attended, cancelled }
  }, [all])

  return { all, loading, error, ...grouped }
}
