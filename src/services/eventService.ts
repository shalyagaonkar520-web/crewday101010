import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { addDays, format, parseISO } from 'date-fns'
import { COLLECTIONS, db } from '@/firebase/config'
import type { CrewEvent, EventDraft, EventFilters, EventStatus } from '@/types'
import { DEFAULT_CURRENCY } from '@/utils/constants'
import { combineDateTime, todayISO } from '@/utils/format'
import { sanitiseText } from '@/utils/validation'

/* --------------------------------- Mapping -------------------------------- */

export function mapEvent(snapshot: DocumentSnapshot<DocumentData>): CrewEvent | null {
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return {
    id: snapshot.id,
    title: data.title ?? '',
    description: data.description ?? '',
    imageURL: data.imageURL ?? '',
    imagePath: data.imagePath ?? '',
    category: data.category ?? 'Other',
    date: data.date ?? '',
    startTime: data.startTime ?? '',
    endTime: data.endTime ?? '',
    startsAt: data.startsAt ?? null,
    weekday: typeof data.weekday === 'number' ? data.weekday : -1,
    isFree: Boolean(data.isFree),
    searchTokens: Array.isArray(data.searchTokens) ? data.searchTokens : [],
    venue: data.venue ?? '',
    address: data.address ?? '',
    city: data.city ?? '',
    area: data.area ?? '',
    mapsURL: data.mapsURL ?? '',
    capacity: data.capacity ?? 0,
    price: data.price ?? 0,
    currency: data.currency ?? DEFAULT_CURRENCY,
    eventTypes: Array.isArray(data.eventTypes) && data.eventTypes.length ? data.eventTypes : ['both'],
    status: (data.status as EventStatus) ?? 'draft',
    featured: Boolean(data.featured),
    waitlistEnabled: data.waitlistEnabled !== false,
    tags: Array.isArray(data.tags) ? data.tags : [],
    registeredCount: data.registeredCount ?? 0,
    participantCount: data.participantCount ?? 0,
    audienceCount: data.audienceCount ?? 0,
    checkedInCount: data.checkedInCount ?? 0,
    waitlistCount: data.waitlistCount ?? 0,
    cancelledReason: data.cancelledReason,
    createdBy: data.createdBy ?? '',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  }
}

function mapEvents(docs: QueryDocumentSnapshot<DocumentData>[]): CrewEvent[] {
  return docs.map((entry) => mapEvent(entry)).filter((entry): entry is CrewEvent => !!entry)
}

/* ------------------------------ Derived fields ---------------------------- */

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'a', 'an', 'of', 'at', 'in'])

/** Shortest and longest prefix stored per word. The query side uses both. */
export const MIN_SEARCH_PREFIX = 3
export const MAX_SEARCH_PREFIX = 12

/** Tokens let Firestore do real search via `array-contains` instead of a full scan. */
export function buildSearchTokens(draft: Pick<EventDraft, 'title' | 'venue' | 'category' | 'city' | 'area' | 'tags'>): string[] {
  const source = [draft.title, draft.venue, draft.category, draft.city, draft.area, ...(draft.tags ?? [])]
    .join(' ')
    .toLowerCase()
  const words = source.split(/[^a-z0-9]+/).filter((word) => word.length > 1 && !STOP_WORDS.has(word))

  const tokens = new Set<string>()
  for (const word of words) {
    tokens.add(word)
    // Prefixes make "gui" match "guitar" without a search service.
    //
    // The ceiling must match MAX_SEARCH_PREFIX on the query side. They were
    // previously out of step — prefixes stopped at 7 characters while the
    // query truncated the term to 8 — which silently made every word of eight
    // or more letters unsearchable ("badminton", "photography", "electronic").
    const limit = Math.min(word.length, MAX_SEARCH_PREFIX)
    for (let size = MIN_SEARCH_PREFIX; size <= limit; size += 1) tokens.add(word.slice(0, size))
  }
  return [...tokens].slice(0, 260)
}

function derivedFields(draft: EventDraft) {
  const startsAtDate = combineDateTime(draft.date, draft.startTime)
  const parsedDate = draft.date ? parseISO(draft.date) : null
  return {
    startsAt: startsAtDate ? Timestamp.fromDate(startsAtDate) : null,
    weekday: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getDay() : -1,
    isFree: draft.price <= 0,
    searchTokens: buildSearchTokens(draft),
  }
}

/** Normalise everything an admin typed before it reaches Firestore. */
function cleanDraft(draft: EventDraft) {
  return {
    title: sanitiseText(draft.title, 120),
    description: sanitiseText(draft.description, 5000),
    imageURL: draft.imageURL ?? '',
    imagePath: draft.imagePath ?? '',
    category: draft.category,
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime ?? '',
    venue: sanitiseText(draft.venue, 120),
    address: sanitiseText(draft.address, 300),
    city: sanitiseText(draft.city, 60),
    area: sanitiseText(draft.area, 60),
    mapsURL: draft.mapsURL ?? '',
    capacity: Math.max(1, Math.floor(draft.capacity)),
    price: Math.max(0, Math.round(draft.price)),
    currency: draft.currency || DEFAULT_CURRENCY,
    eventTypes: draft.eventTypes,
    status: draft.status,
    featured: draft.featured,
    waitlistEnabled: draft.waitlistEnabled,
    tags: (draft.tags ?? []).map((tag) => sanitiseText(tag, 30)).filter(Boolean).slice(0, 12),
  }
}

/* ---------------------------------- Writes -------------------------------- */

export async function createEvent(draft: EventDraft, adminUid: string): Promise<string> {
  const payload = {
    ...cleanDraft(draft),
    ...derivedFields(draft),
    registeredCount: 0,
    participantCount: 0,
    audienceCount: 0,
    checkedInCount: 0,
    waitlistCount: 0,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const created = await addDoc(collection(db, COLLECTIONS.events), payload)
  return created.id
}

export async function updateEvent(eventId: string, draft: EventDraft): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.events, eventId), {
    ...cleanDraft(draft),
    ...derivedFields(draft),
    updatedAt: serverTimestamp(),
  })
}

export async function setEventStatus(eventId: string, status: EventStatus): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.events, eventId), { status, updatedAt: serverTimestamp() })
}

export async function setEventFeatured(eventId: string, featured: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.events, eventId), { featured, updatedAt: serverTimestamp() })
}

export async function cancelEvent(eventId: string, reason: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.events, eventId), {
    status: 'cancelled',
    cancelledReason: sanitiseText(reason, 300),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.events, eventId))
}

/** Copy an event as a fresh draft — the fastest way to run a weekly series. */
export async function duplicateEvent(eventId: string, adminUid: string): Promise<string> {
  const source = await getEvent(eventId)
  if (!source) throw new Error('Event not found.')
  const draft: EventDraft = {
    ...source,
    title: `${source.title} (copy)`,
    date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    status: 'draft',
    featured: false,
  }
  return createEvent(draft, adminUid)
}

/* ---------------------------------- Reads --------------------------------- */

export async function getEvent(eventId: string): Promise<CrewEvent | null> {
  return mapEvent(await getDoc(doc(db, COLLECTIONS.events, eventId)))
}

export function subscribeToEvent(
  eventId: string,
  onChange: (event: CrewEvent | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, COLLECTIONS.events, eventId),
    (snapshot) => onChange(mapEvent(snapshot)),
    (error) => onError?.(error),
  )
}

/** Statuses a signed-out or ordinary user is allowed to discover. */
const PUBLIC_STATUSES: EventStatus[] = ['open', 'closed']

function dateWindow(filters: EventFilters): { from: string; to?: string } {
  const today = todayISO()
  switch (filters.dateFilter) {
    case 'today':
      return { from: today, to: today }
    case 'tomorrow': {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
      return { from: tomorrow, to: tomorrow }
    }
    case 'weekend': {
      // Next Saturday + Sunday, including today if today is already the weekend.
      const now = new Date()
      const day = now.getDay()
      const toSaturday = day === 0 ? 0 : 6 - day
      const saturday = addDays(now, toSaturday)
      const sunday = addDays(saturday, day === 0 ? 0 : 1)
      return {
        from: format(day === 0 ? now : saturday, 'yyyy-MM-dd'),
        to: format(sunday, 'yyyy-MM-dd'),
      }
    }
    case 'custom':
      return {
        from: filters.customDateFrom || today,
        to: filters.customDateTo || undefined,
      }
    case 'sunday':
    case 'any':
    default:
      return { from: today }
  }
}

export interface EventPage {
  events: CrewEvent[]
  cursor: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}

/**
 * Discovery query.
 *
 * Everything that Firestore can index is pushed to the server — status, date
 * window, weekday, category, city, free/paid and a search token. Only the
 * custom price range and the participant/audience match are finished on the
 * client, over a single page of results, never the whole collection.
 */
export async function listPublishedEvents(options: {
  filters: EventFilters
  pageSize: number
  cursor?: QueryDocumentSnapshot<DocumentData> | null
}): Promise<EventPage> {
  const { filters, pageSize, cursor } = options
  const window = dateWindow(filters)
  const constraints: QueryConstraint[] = [
    where('status', 'in', PUBLIC_STATUSES),
    where('date', '>=', window.from),
  ]

  if (window.to) constraints.push(where('date', '<=', window.to))
  if (filters.dateFilter === 'sunday') constraints.push(where('weekday', '==', 0))
  if (filters.category) constraints.push(where('category', '==', filters.category))
  if (filters.city) constraints.push(where('city', '==', filters.city))
  if (filters.priceFilter === 'free') constraints.push(where('isFree', '==', true))
  if (filters.priceFilter === 'paid') constraints.push(where('isFree', '==', false))

  const term = filters.search.trim().toLowerCase()
  if (term) {
    const token = term.split(/\s+/)[0].slice(0, MAX_SEARCH_PREFIX)
    // Below the minimum prefix there is no token to match, so the query stays
    // unfiltered and `matchesClientFilters` narrows the page instead.
    if (token.length >= MIN_SEARCH_PREFIX) {
      constraints.push(where('searchTokens', 'array-contains', token))
    }
  }

  constraints.push(orderBy('date', 'asc'), orderBy('startTime', 'asc'))
  if (cursor) {
    const { startAfter } = await import('firebase/firestore')
    constraints.push(startAfter(cursor))
  }
  constraints.push(fsLimit(pageSize + 1))

  const snapshot = await getDocs(query(collection(db, COLLECTIONS.events), ...constraints))
  const docs = snapshot.docs.slice(0, pageSize)
  const events = mapEvents(docs).filter((event) => matchesClientFilters(event, filters))

  return { events, cursor: docs.at(-1) ?? null, hasMore: snapshot.docs.length > pageSize }
}

/** The last mile of filtering that Firestore cannot express in one index. */
export function matchesClientFilters(event: CrewEvent, filters: EventFilters): boolean {
  if (filters.priceFilter === 'custom') {
    if (event.price < filters.priceMin || event.price > filters.priceMax) return false
  }
  if (filters.role !== 'any') {
    const accepts =
      event.eventTypes.includes('both') ||
      event.eventTypes.includes(filters.role) ||
      filters.role === 'both'
    if (!accepts) return false
  }
  if (filters.area) {
    if (event.area.toLowerCase() !== filters.area.toLowerCase()) return false
  }
  const term = filters.search.trim().toLowerCase()
  if (term && (term.includes(' ') || term.length < MIN_SEARCH_PREFIX)) {
    const haystack = `${event.title} ${event.venue} ${event.category} ${event.area}`.toLowerCase()
    if (!term.split(/\s+/).every((word) => haystack.includes(word))) return false
  }
  return true
}

export async function listFeaturedEvents(max = 6): Promise<CrewEvent[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.events),
      where('status', 'in', PUBLIC_STATUSES),
      where('featured', '==', true),
      where('date', '>=', todayISO()),
      orderBy('date', 'asc'),
      fsLimit(max),
    ),
  )
  return mapEvents(snapshot.docs)
}

/** Upcoming events matching a member's interests, for the personalised rail. */
export async function listEventsForInterests(interests: string[], max = 8): Promise<CrewEvent[]> {
  if (!interests.length) return []
  const tokens = interests.map((interest) => interest.toLowerCase().split(/\s+/)[0]).slice(0, 10)
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.events),
      // `array-contains-any` cannot be combined with `in`, so this rail sticks
      // to events that are actually open for registration.
      where('status', '==', 'open'),
      where('date', '>=', todayISO()),
      where('searchTokens', 'array-contains-any', tokens),
      orderBy('date', 'asc'),
      fsLimit(max),
    ),
  )
  return mapEvents(snapshot.docs)
}

/* ------------------------------- Admin reads ------------------------------ */

export async function listAdminEvents(options: {
  status?: EventStatus | 'all'
  pageSize: number
  cursor?: QueryDocumentSnapshot<DocumentData> | null
}): Promise<EventPage> {
  const { status = 'all', pageSize, cursor } = options
  const constraints: QueryConstraint[] = []
  if (status !== 'all') constraints.push(where('status', '==', status))
  constraints.push(orderBy('date', 'desc'))
  if (cursor) {
    const { startAfter } = await import('firebase/firestore')
    constraints.push(startAfter(cursor))
  }
  constraints.push(fsLimit(pageSize + 1))

  const snapshot = await getDocs(query(collection(db, COLLECTIONS.events), ...constraints))
  const docs = snapshot.docs.slice(0, pageSize)
  return { events: mapEvents(docs), cursor: docs.at(-1) ?? null, hasMore: snapshot.docs.length > pageSize }
}

/** Events an admin can currently run check-in for. */
export async function listCheckInEvents(max = 25): Promise<CrewEvent[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.events),
      where('status', 'in', ['open', 'closed', 'completed']),
      orderBy('date', 'desc'),
      fsLimit(max),
    ),
  )
  return mapEvents(snapshot.docs)
}

export async function countEvents(constraints: QueryConstraint[] = []): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, COLLECTIONS.events), ...constraints))
  return snapshot.data().count
}

/** Distinct cities across upcoming events, for the location filter. */
export async function listEventCities(max = 200): Promise<string[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.events),
      where('status', 'in', PUBLIC_STATUSES),
      where('date', '>=', todayISO()),
      orderBy('date', 'asc'),
      fsLimit(max),
    ),
  )
  const cities = new Set<string>()
  for (const entry of snapshot.docs) {
    const city = entry.data().city
    if (typeof city === 'string' && city) cities.add(city)
  }
  return [...cities].sort()
}

/* ------------------------------ Availability ------------------------------ */

export function seatsLeft(event: CrewEvent): number {
  return Math.max(0, event.capacity - event.registeredCount)
}

export function isSoldOut(event: CrewEvent): boolean {
  return seatsLeft(event) <= 0
}

export function isPastEvent(event: CrewEvent): boolean {
  return event.date < todayISO()
}

export interface Availability {
  canRegister: boolean
  reason?: string
}

/** Single place that decides whether the Register button does anything. */
export function registrationAvailability(event: CrewEvent): Availability {
  if (event.status === 'cancelled') return { canRegister: false, reason: 'This event has been cancelled.' }
  if (event.status === 'draft') return { canRegister: false, reason: 'This event is not published yet.' }
  if (event.status === 'completed') return { canRegister: false, reason: 'This event has already happened.' }
  if (event.status === 'closed') return { canRegister: false, reason: 'Registration is closed for this event.' }
  if (isPastEvent(event)) return { canRegister: false, reason: 'This event has already happened.' }
  if (isSoldOut(event)) return { canRegister: false, reason: 'This event is currently full.' }
  return { canRegister: true }
}
