import { format, isValid, parse, parseISO } from 'date-fns'
import { plainText, priceLabel, truncateText, type EventMetaInput } from './eventMeta'

/**
 * Structured data and readable text for an event page. Pure functions over
 * plain values, shared by the server renderer (api/page.ts) and the tests.
 * Nothing here invents data: a field that Firestore does not have is left out.
 */

export const SITE_URL = 'https://crewday.nirmaansolutions.in'
export const DEFAULT_SHARE_IMAGE = `${SITE_URL}/og/crewday-share.png`
const IST = '+05:30'

export interface EventSeoInput extends EventMetaInput {
  startTime?: string
  endTime?: string
  address?: string
  mapsURL?: string
  capacity?: number
  registeredCount?: number
  /** ISO timestamps, already converted from Firestore. */
  createdAt?: string | null
  updatedAt?: string | null
}

export function eventUrl(id: string): string {
  return `${SITE_URL}/events/${id}`
}

const validTime = (time: string | undefined): time is string => Boolean(time && /^\d{1,2}:\d{2}$/.test(time))

/** ISO 8601 in India time, e.g. 2026-11-30T18:00:00+05:30. */
export function isoInIndia(date: string, time: string | undefined): string {
  const hhmm = validTime(time) ? time.padStart(5, '0') : '00:00'
  return `${date}T${hhmm}:00${IST}`
}

/** "Monday 30 November 2026, 6:00–8:00 PM", or just the date when no time is set. */
export function whenText(event: Pick<EventSeoInput, 'date' | 'startTime' | 'endTime'>): string {
  const day = parseISO(event.date)
  if (!isValid(day)) return event.date
  const clock = (value: string) => format(parse(value, 'HH:mm', new Date()), 'h:mm a')
  const dateText = format(day, 'EEEE d MMMM yyyy')
  if (!validTime(event.startTime)) return dateText
  const start = clock(event.startTime)
  if (!validTime(event.endTime)) return `${dateText}, ${start}`
  const end = clock(event.endTime)
  // "6:00–8:00 PM" when both share the same am/pm, otherwise spell both out.
  const sameHalf = start.slice(-2) === end.slice(-2)
  return `${dateText}, ${sameHalf ? `${start.slice(0, -3)}–${end}` : `${start} – ${end}`}`
}

/** Only Bengaluru is operated today, and its state is a fact, not a guess. */
function regionFor(city: string | undefined): string | undefined {
  return city && /^(bengaluru|bangalore)$/i.test(city.trim()) ? 'Karnataka' : undefined
}

export function buildEventJsonLd(event: EventSeoInput): Record<string, unknown> {
  const url = eventUrl(event.id)
  const region = regionFor(event.city)
  const soldOut =
    typeof event.capacity === 'number' &&
    event.capacity > 0 &&
    typeof event.registeredCount === 'number' &&
    event.registeredCount >= event.capacity

  const address: Record<string, unknown> = { '@type': 'PostalAddress' }
  if (event.address) address.streetAddress = event.address
  if (event.city) address.addressLocality = event.city
  if (region) address.addressRegion = region
  address.addressCountry = 'IN'

  const location: Record<string, unknown> = { '@type': 'Place', address }
  if (event.venue) location.name = event.venue
  if (event.mapsURL && /^https?:\/\//.test(event.mapsURL)) location.hasMap = event.mapsURL

  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    price: event.isFree || !event.price || event.price <= 0 ? 0 : event.price,
    priceCurrency: event.currency || 'INR',
    availability: `https://schema.org/${soldOut ? 'SoldOut' : 'InStock'}`,
    url,
  }
  if (event.createdAt) offer.validFrom = event.createdAt

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: truncateText(plainText(event.description) || `${event.title} on CrewDay.`, 499),
    image: [/^https?:\/\//.test(event.imageURL || '') ? event.imageURL : DEFAULT_SHARE_IMAGE],
    startDate: isoInIndia(event.date, event.startTime),
    eventStatus: `https://schema.org/${event.status === 'cancelled' ? 'EventCancelled' : 'EventScheduled'}`,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location,
    offers: offer,
    organizer: { '@type': 'Organization', name: 'CrewDay', url: SITE_URL },
    url,
  }
  if (validTime(event.endTime)) ld.endDate = isoInIndia(event.date, event.endTime)
  return ld
}

export function buildBreadcrumbJsonLd(event: Pick<EventSeoInput, 'id' | 'title'>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Explore', item: `${SITE_URL}/explore` },
      { '@type': 'ListItem', position: 3, name: event.title, item: eventUrl(event.id) },
    ],
  }
}

export { priceLabel }
