import { format, isValid, parseISO } from 'date-fns'
import type { PageMeta } from '@/seo/usePageMeta'
import { formatPrice, truncate } from '@/utils/format'
import { LAUNCH_CITY } from '@/utils/constants'
import type { CrewEvent } from '@/types'

const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 155

/** First sentence of a free-text description, flattened to one line. */
function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const end = flat.search(/[.!?](\s|$)/)
  return end === -1 ? flat : flat.slice(0, end + 1)
}

/**
 * "Event title · Sat 30 Nov · ₹99 · CrewDay", with the event title shortened so
 * the whole thing stays under Google's ~60 character display limit.
 */
export function buildEventMeta(event: CrewEvent): PageMeta {
  const date = parseISO(event.date)
  const when = isValid(date) ? format(date, 'EEE d MMM') : ''
  const price = event.isFree || event.price <= 0 ? 'Free' : formatPrice(event.price, event.currency)
  const tail = [when, price, 'CrewDay'].filter(Boolean).join(' · ')
  const title = `${truncate(event.title.trim(), Math.max(10, TITLE_LIMIT - tail.length - 3))} · ${tail}`

  const place = [event.venue, event.area]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
  const lead = firstSentence(event.description || '')
  const where = place ? ` ${place}.` : ''
  const fallback = `A small social event in ${event.city || LAUNCH_CITY}.`
  const description = truncate(`${lead}${where}`.trim() || fallback, DESCRIPTION_LIMIT - 1)

  return {
    title,
    description,
    path: `/events/${event.id}`,
    image: /^https?:\/\//.test(event.imageURL || '') ? event.imageURL : undefined,
    noindex: event.status === 'draft',
  }
}
