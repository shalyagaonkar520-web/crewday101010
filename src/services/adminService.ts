import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  Timestamp,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import { subDays, startOfToday, startOfWeek } from 'date-fns'
import { COLLECTIONS, db } from '@/firebase/config'
import { countEvents } from '@/services/eventService'
import { countRegistrations } from '@/services/registrationService'
import { countUsers, getPopularInterests } from '@/services/userService'
import { todayISO } from '@/utils/format'

/**
 * Dashboard metrics.
 *
 * Every headline number uses Firestore's `count()` aggregation, which is billed
 * at a fraction of a document read and never ships the documents themselves —
 * the admin dashboard must not download the database to add things up.
 */

export interface DashboardStats {
  /**
   * Metrics that could not be read, by label. A dashboard is a collection of
   * independent numbers, so one failing query (a missing composite index, a
   * transient network blip) must degrade that one tile rather than blank the
   * whole page.
   */
  degraded: string[]
  users: {
    total: number
    newToday: number
    newThisWeek: number
    active: number
    suspended: number
  }
  events: {
    total: number
    upcoming: number
    completed: number
    cancelled: number
    drafts: number
  }
  registrations: {
    total: number
    today: number
    thisWeek: number
    cancelled: number
  }
  attendance: {
    checkedIn: number
    attendanceRate: number
    noShowRate: number
  }
  revenue: {
    hasPaidEvents: boolean
    total: number
    byEvent: { title: string; amount: number }[]
  }
  popularInterests: { name: string; count: number }[]
}

function since(date: Date): Timestamp {
  return Timestamp.fromDate(date)
}

/**
 * Run one metric, and on failure fall back instead of rejecting.
 *
 * Firestore raises `failed-precondition` when a composite index is missing,
 * which is easy to hit as queries evolve. Isolating each metric means the
 * dashboard shows every number it *can* read and names the ones it could not.
 */
async function metric<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
  failures: string[],
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    failures.push(label)
    if (import.meta.env.DEV) console.warn(`[dashboard] "${label}" failed:`, error)
    return fallback
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = startOfToday()
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const isoToday = todayISO()
  const degraded: string[] = []

  const userConstraints: Record<string, QueryConstraint[]> = {
    total: [],
    newToday: [where('createdAt', '>=', since(today))],
    newThisWeek: [where('createdAt', '>=', since(weekStart))],
    active: [where('lastActiveAt', '>=', since(subDays(new Date(), 30)))],
    suspended: [where('status', '==', 'suspended')],
  }

  const [
    totalUsers,
    newToday,
    newThisWeek,
    activeUsers,
    suspendedUsers,
    totalEvents,
    upcomingEvents,
    completedEvents,
    cancelledEvents,
    draftEvents,
    totalRegistrations,
    todayRegistrations,
    weekRegistrations,
    cancelledRegistrations,
    checkedIn,
    popularInterests,
    revenue,
  ] = await Promise.all([
    metric('Total users', () => countUsers(userConstraints.total), 0, degraded),
    metric('New users today', () => countUsers(userConstraints.newToday), 0, degraded),
    metric('New users this week', () => countUsers(userConstraints.newThisWeek), 0, degraded),
    metric('Active users', () => countUsers(userConstraints.active), 0, degraded),
    metric('Suspended users', () => countUsers(userConstraints.suspended), 0, degraded),
    metric('Total events', () => countEvents(), 0, degraded),
    metric(
      'Upcoming events',
      () => countEvents([where('status', 'in', ['open', 'closed']), where('date', '>=', isoToday)]),
      0,
      degraded,
    ),
    metric('Completed events', () => countEvents([where('status', '==', 'completed')]), 0, degraded),
    metric('Cancelled events', () => countEvents([where('status', '==', 'cancelled')]), 0, degraded),
    metric('Draft events', () => countEvents([where('status', '==', 'draft')]), 0, degraded),
    metric('Total registrations', () => countRegistrations(), 0, degraded),
    metric(
      "Today's registrations",
      () => countRegistrations([where('registeredAt', '>=', since(today))]),
      0,
      degraded,
    ),
    metric(
      "This week's registrations",
      () => countRegistrations([where('registeredAt', '>=', since(weekStart))]),
      0,
      degraded,
    ),
    metric(
      'Cancelled registrations',
      () => countRegistrations([where('registrationStatus', '==', 'cancelled')]),
      0,
      degraded,
    ),
    metric(
      'Checked in',
      () => countRegistrations([where('attendanceStatus', '==', 'checked_in')]),
      0,
      degraded,
    ),
    metric('Popular interests', () => getPopularInterests(), [], degraded),
    metric(
      'Revenue',
      () => getRevenueSummary(),
      { hasPaidEvents: false, total: 0, byEvent: [] },
      degraded,
    ),
  ])

  const liveRegistrations = totalRegistrations - cancelledRegistrations
  const attendanceRate = liveRegistrations > 0 ? (checkedIn / liveRegistrations) * 100 : 0

  return {
    degraded,
    users: {
      total: totalUsers,
      newToday,
      newThisWeek,
      active: activeUsers,
      suspended: suspendedUsers,
    },
    events: {
      total: totalEvents,
      upcoming: upcomingEvents,
      completed: completedEvents,
      cancelled: cancelledEvents,
      drafts: draftEvents,
    },
    registrations: {
      total: totalRegistrations,
      today: todayRegistrations,
      thisWeek: weekRegistrations,
      cancelled: cancelledRegistrations,
    },
    attendance: {
      checkedIn,
      attendanceRate,
      noShowRate: liveRegistrations > 0 ? 100 - attendanceRate : 0,
    },
    revenue,
    popularInterests,
  }
}

/**
 * Revenue is only meaningful once paid events exist, so this reports
 * `hasPaidEvents: false` and the dashboard hides the whole section.
 */
export async function getRevenueSummary(): Promise<DashboardStats['revenue']> {
  const paidEvents = await getDocs(
    query(collection(db, COLLECTIONS.events), where('isFree', '==', false), fsLimit(50)),
  )
  if (paidEvents.empty) return { hasPaidEvents: false, total: 0, byEvent: [] }

  const byEvent: { title: string; amount: number }[] = []
  let total = 0

  for (const eventDoc of paidEvents.docs) {
    const paid = await getDocs(
      query(
        collection(db, COLLECTIONS.registrations),
        where('eventId', '==', eventDoc.id),
        where('paymentStatus', '==', 'paid'),
      ),
    )
    const amount = paid.docs.reduce((sum, entry) => sum + (entry.data().price ?? 0), 0)
    if (amount > 0) {
      total += amount
      byEvent.push({ title: eventDoc.data().title ?? 'Untitled event', amount })
    }
  }

  byEvent.sort((a, b) => b.amount - a.amount)
  return { hasPaidEvents: true, total, byEvent: byEvent.slice(0, 10) }
}

/* ----------------------------- Funnel metrics ----------------------------- */

export interface FunnelStats {
  signedUp: number
  profilesCompleted: number
  registeredForEvent: number
  attended: number
  repeatAttenders: number
}

/**
 * Acquisition -> activation -> engagement -> attendance -> retention.
 * Sampled over the most recent users so the query stays bounded.
 */
export async function getFunnelStats(sampleSize = 500): Promise<FunnelStats> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.users), orderBy('createdAt', 'desc'), fsLimit(sampleSize)),
  )

  let profilesCompleted = 0
  let registeredForEvent = 0
  let attended = 0
  let repeatAttenders = 0

  for (const entry of snapshot.docs) {
    const data = entry.data()
    if (data.onboardingCompleted) profilesCompleted += 1
    if ((data.eventsRegistered ?? 0) > 0) registeredForEvent += 1
    if ((data.eventsAttended ?? 0) > 0) attended += 1
    if ((data.eventsAttended ?? 0) > 1) repeatAttenders += 1
  }

  return {
    signedUp: snapshot.size,
    profilesCompleted,
    registeredForEvent,
    attended,
    repeatAttenders,
  }
}

/* -------------------------------- Reports -------------------------------- */

export interface AdminEventStats {
  registered: number
  confirmed: number
  pendingPayment: number
  cancelled: number
  checkedIn: number
  noShow: number
  participants: number
  audience: number
}

export function summariseRegistrations(
  registrations: {
    registrationStatus: string
    attendanceStatus: string
    participationType: string
  }[],
): AdminEventStats {
  const stats: AdminEventStats = {
    registered: 0,
    confirmed: 0,
    pendingPayment: 0,
    cancelled: 0,
    checkedIn: 0,
    noShow: 0,
    participants: 0,
    audience: 0,
  }

  for (const registration of registrations) {
    if (registration.registrationStatus === 'cancelled') {
      stats.cancelled += 1
      continue
    }
    stats.registered += 1
    if (registration.registrationStatus === 'confirmed') stats.confirmed += 1
    if (registration.registrationStatus === 'pending_payment') stats.pendingPayment += 1
    if (registration.attendanceStatus === 'checked_in') stats.checkedIn += 1
    else stats.noShow += 1
    if (registration.participationType === 'participant') stats.participants += 1
    else stats.audience += 1
  }

  return stats
}
