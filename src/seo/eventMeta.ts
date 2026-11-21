import { format, isValid, parseISO } from 'date-fns'

/**
 * Head copy for an event page.
 *
 * Self-contained on purpose (relative imports only, no `@/` alias, no browser
 * APIs): the same code builds the tags in the browser (usePageMeta) and on the
 * server (api/page.ts), so a crawler and a person see identical titles.
 */

const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 155
const DEFAULT_CITY = 'Bengaluru'

/** The fields of an event that decide how its page looks in search and in link previews. */
export interface EventMetaInput {
  id: string
  title: string
  description?: string
  imageURL?: string
  date: string
  venue?: string
  area?: string
  city?: string
  price: number
  currency?: string
  isFree?: boolean
  status: string
}

export interface EventMeta {
  title: string
  description: string
  path: string
  image?: string
  noindex: boolean
}

/** Cut at a word boundary and add one ellipsis; the result is at most max + 1 characters. */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  const clipped = text.slice(0, max)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}

/** Flatten whitespace so a multi-line description reads as one line. */
export function plainText(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

/** First sentence of a free-text description. */
export function firstSentence(text: string | undefined): string {
  const flat = plainText(text)
  const end = flat.search(/[.!?](\s|$)/)
  return end === -1 ? flat : flat.slice(0, end + 1)
}

export function priceLabel(event: Pick<EventMetaInput, 'price' | 'currency' | 'isFree'>): string {
  if (event.isFree || !event.price || event.price <= 0) return 'Free'
  const symbol = !event.currency || event.currency === 'INR' ? '₹' : `${event.currency} `
  return `${symbol}${event.price.toLocaleString('en-IN')}`
}

/**
 * "Event title · Mon 30 Nov · ₹99 · CrewDay", with the event title shortened so
 * the whole thing stays under Google's ~60 character display limit.
 */
export function buildEventMeta(event: EventMetaInput): EventMeta {
  const date = parseISO(event.date)
  const when = isValid(date) ? format(date, 'EEE d MMM') : ''
  const tail = [when, priceLabel(event), 'CrewDay'].filter(Boolean).join(' · ')
  const title = `${truncateText(event.title.trim(), Math.max(10, TITLE_LIMIT - tail.length - 3))} · ${tail}`

  const place = [event.venue, event.area]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
  const lead = firstSentence(event.description)
  const where = place ? ` ${place}.` : ''
  const fallback = `A small social event in ${event.city || DEFAULT_CITY}.`
  // truncateText appends one "…", so ask for one character fewer.
  const description = truncateText(`${lead}${where}`.trim() || fallback, DESCRIPTION_LIMIT - 1)

  return {
    title,
    description,
    path: `/events/${event.id}`,
    image: /^https?:\/\//.test(event.imageURL || '') ? event.imageURL : undefined,
    noindex: event.status === 'draft',
  }
}
