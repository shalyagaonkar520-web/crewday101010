import { addDays, format, isValid, parse, parseISO } from 'date-fns'
import type { FireDate } from '@/types'

/** `YYYY-MM-DD` for today in the browser's local timezone. */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isoDaysFromNow(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
}

/** Combine an ISO date and `HH:mm` into a real Date. Invalid input -> null. */
export function combineDateTime(date: string, time: string): Date | null {
  if (!date) return null
  const parsed = parse(`${date} ${time || '00:00'}`, 'yyyy-MM-dd HH:mm', new Date())
  return isValid(parsed) ? parsed : null
}

/** "Sunday, 20 September" */
export function formatEventDate(date: string): string {
  if (!date) return ''
  const parsed = parseISO(date)
  if (!isValid(parsed)) return date
  return format(parsed, 'EEEE, d MMMM')
}

/** "Sun, 20 Sep 2026" */
export function formatEventDateShort(date: string): string {
  if (!date) return ''
  const parsed = parseISO(date)
  if (!isValid(parsed)) return date
  return format(parsed, 'EEE, d MMM yyyy')
}

/** `17:00` -> `5:00 PM` */
export function formatTime(time: string): string {
  if (!time) return ''
  const parsed = parse(time, 'HH:mm', new Date())
  if (!isValid(parsed)) return time
  return format(parsed, 'h:mm a')
}

export function formatTimeRange(start: string, end: string): string {
  if (!start) return ''
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start)
}

/** Firestore timestamp -> Date, tolerating the in-flight `null`. */
export function toDate(value: FireDate | undefined): Date | null {
  if (!value) return null
  try {
    return value.toDate()
  } catch {
    return null
  }
}

export function formatDateTime(value: FireDate | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'd MMM yyyy, h:mm a') : '—'
}

export function formatClockTime(value: FireDate | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'h:mm a') : '—'
}

/** ₹0 renders as FREE everywhere in the product. */
export function formatPrice(price: number, currency = 'INR'): string {
  if (!price || price <= 0) return 'FREE'
  const symbol = currency === 'INR' ? '₹' : `${currency} `
  return `${symbol}${price.toLocaleString('en-IN')}`
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('en-IN') : '0'
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value)}%`
}

/** "in 3 days" / "tomorrow" / "today" for upcoming events. */
export function relativeDayLabel(date: string): string {
  if (!date) return ''
  if (date === todayISO()) return 'Today'
  if (date === isoDaysFromNow(1)) return 'Tomorrow'
  const parsed = parseISO(date)
  if (!isValid(parsed)) return ''
  const days = Math.round((parsed.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days < 0) return 'Past'
  if (days <= 7) return format(parsed, 'EEEE')
  return format(parsed, 'd MMM')
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '🙂'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Truncate for cards without cutting mid-word where avoidable. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const clipped = text.slice(0, max)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}
