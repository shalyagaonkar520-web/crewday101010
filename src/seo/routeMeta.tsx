import { matchPath, useLocation } from 'react-router-dom'
import { usePageMeta, type PageMeta } from '@/seo/usePageMeta'
import { PUBLIC_PAGES } from '@/seo/publicPages'

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
  // Public pages: copy lives in publicPages.ts so the server renders the same text.
  ...PUBLIC_PAGES.map((page) => ({
    pattern: page.path,
    meta: { title: page.title, description: page.description },
  })),
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
