import { matchPath, useLocation } from 'react-router-dom'
import { usePageMeta, type PageMeta } from '@/seo/usePageMeta'
import { GRIEVANCE_REPLY_BUSINESS_DAYS, LAUNCH_CITY, REFUND_CUTOFF_HOURS } from '@/utils/constants'

const CITY = LAUNCH_CITY
const suffix = `CrewDay ${CITY}`

interface RouteEntry {
  /** react-router pattern; a trailing /* matches everything below it. */
  pattern: string
  meta: Omit<PageMeta, 'path'>
}

const hidden = (title: string, description = 'Your CrewDay account. This page is private.'): Omit<PageMeta, 'path'> => ({
  title: `${title} · CrewDay`,
  description,
  noindex: true,
})

/**
 * Head copy for every route except /events/:eventId (EventDetail builds its
 * own from the event) and the not-found route. Public pages get real copy;
 * account, ticket and admin pages are marked noindex. Order matters: the first
 * match wins, so specific patterns come before their parents.
 */
export const ROUTE_META: RouteEntry[] = [
  {
    pattern: '/explore',
    meta: {
      title: `Explore events · ${suffix}`,
      description: `Browse small social events in ${CITY}: game nights, walks, café meet-ups and workshops from ₹49. Book a seat in minutes and meet new people.`,
    },
  },
  {
    pattern: '/about',
    meta: {
      title: `About us · ${suffix}`,
      description: `CrewDay helps people new to ${CITY} make friends offline through small, friendly events that cost ₹49–₹99. See who it is for and how it works.`,
    },
  },
  {
    pattern: '/plan',
    meta: {
      title: `Plan my CrewDay · ${suffix}`,
      description: `Answer a few quick questions and get small ${CITY} events matched to your mood, budget and free time. Events from ₹49.`,
    },
  },
  {
    pattern: '/terms',
    meta: {
      title: `Terms & Conditions · ${suffix}`,
      description: `The terms for using CrewDay: accounts, bookings, payments, organisers and conduct at events in ${CITY}.`,
    },
  },
  {
    pattern: '/privacy',
    meta: {
      title: `Privacy Policy · ${suffix}`,
      description:
        'What CrewDay collects, why, who can see it and how to delete your data. Covers the CrewDay website and the Android app.',
    },
  },
  {
    pattern: '/refund-policy',
    meta: {
      title: `Refund & Cancellation Policy · ${suffix}`,
      description: `Cancel at least ${REFUND_CUTOFF_HOURS} hours before an event for a full refund. Events cancelled by the organiser are refunded in full. How refunds are paid.`,
    },
  },
  {
    pattern: '/shipping-policy',
    meta: {
      title: `Delivery Policy · ${suffix}`,
      description:
        'Nothing is shipped. Your CrewDay ticket is delivered instantly in the app as a QR code once your registration is confirmed.',
    },
  },
  {
    pattern: '/contact',
    meta: {
      title: `Contact & Grievances · ${suffix}`,
      description: `Contact CrewDay for booking, payment or refund help, or raise a grievance. We reply within ${GRIEVANCE_REPLY_BUSINESS_DAYS} business days.`,
    },
  },
  {
    pattern: '/delete-account',
    meta: {
      title: `Delete your account · ${suffix}`,
      description:
        'How to delete your CrewDay account and what happens to your data. Works for the website and the Android app.',
    },
  },
  // Sign-in screens: useful to people, useless in search results.
  { pattern: '/login', meta: hidden('Log in', 'Log in to CrewDay.') },
  { pattern: '/signup', meta: hidden('Sign up', 'Create your CrewDay account.') },
  { pattern: '/forgot-password', meta: hidden('Reset password', 'Reset your CrewDay password.') },
  { pattern: '/admin/*', meta: hidden('Admin') },
  { pattern: '/admin', meta: hidden('Admin') },
  { pattern: '/home', meta: hidden('Home') },
  { pattern: '/profile', meta: hidden('Profile') },
  { pattern: '/settings/*', meta: hidden('Settings') },
  { pattern: '/settings', meta: hidden('Settings') },
  { pattern: '/tickets/*', meta: hidden('Your ticket') },
  { pattern: '/my-events', meta: hidden('My events') },
  { pattern: '/purchases', meta: hidden('Purchases') },
  { pattern: '/notifications', meta: hidden('Notifications') },
  { pattern: '/registration/*', meta: hidden('Registration') },
  { pattern: '/onboarding', meta: hidden('Welcome') },
  { pattern: '/suggest', meta: hidden('Suggest an event') },
  { pattern: '/events/:eventId/register', meta: hidden('Register') },
]

export function findRouteMeta(pathname: string): PageMeta | null {
  for (const entry of ROUTE_META) {
    if (matchPath({ path: entry.pattern, end: true }, pathname)) {
      return { ...entry.meta, path: pathname }
    }
  }
  return null
}

function ApplyMeta(meta: PageMeta) {
  usePageMeta(meta)
  return null
}

/** Mounted once inside the router: sets the head tags for the current route. */
export function RouteMeta() {
  const { pathname } = useLocation()
  const meta = findRouteMeta(pathname)
  return meta ? <ApplyMeta {...meta} /> : null
}
