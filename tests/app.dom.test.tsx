/**
 * Render smoke tests.
 *
 * These mount the real application — providers, router, lazy route chunks and
 * all — in jsdom. They catch the class of failure a typecheck cannot: a bad
 * provider order, a missing context, a broken lazy import, a crash on first
 * paint. Firestore is stubbed so nothing touches the network.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// Event discovery is stubbed: these tests are about rendering, not querying.
vi.mock('@/services/eventService', async () => {
  const actual = await vi.importActual<typeof import('@/services/eventService')>(
    '@/services/eventService',
  )
  return {
    ...actual,
    listPublishedEvents: vi.fn(async () => ({ events: [], cursor: null, hasMore: false })),
    listFeaturedEvents: vi.fn(async () => []),
    listEventsForInterests: vi.fn(async () => []),
    listEventCities: vi.fn(async () => []),
  }
})

// Auth never resolves to a signed-in user here, so the listener is a no-op.
vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth')
  return {
    ...actual,
    getAuth: () => ({ currentUser: null }),
    onAuthStateChanged: (_auth: unknown, next: (user: null) => void) => {
      next(null)
      return () => undefined
    },
  }
})

beforeAll(() => {
  // jsdom implements neither, and the app touches both on mount.
  window.scrollTo = vi.fn()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }),
  })
})

afterEach(() => {
  // Vitest globals are off, so Testing Library's auto-cleanup does not run and
  // renders would otherwise pile up in the same document.
  cleanup()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

async function renderAt(path: string) {
  window.history.pushState({}, '', path)
  const { default: App } = await import('@/App')
  return render(<App />)
}

describe('app shell', () => {
  it('sends a signed-out visitor straight to sign in', async () => {
    await renderAt('/')
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy()
  })

  it('keeps the long-form marketing page at /about', async () => {
    await renderAt('/about')
    expect(await screen.findByRole('heading', { name: /find your crew/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /explore events/i })).toBeTruthy()
  })

  it('renders the sign-in screen with both auth options', async () => {
    await renderAt('/login')
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy()
    expect(screen.getByLabelText(/email/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeTruthy()
  })

  it('renders the sign-up screen', async () => {
    await renderAt('/signup')
    expect(await screen.findByRole('heading', { name: /join crewday/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /create account/i })).toBeTruthy()
  })

  it('lets a signed-out visitor browse events', async () => {
    await renderAt('/explore')
    expect(await screen.findByRole('heading', { name: /discover events/i })).toBeTruthy()
    // Empty state rather than a crash or an endless spinner.
    await waitFor(() =>
      expect(screen.getByText(/nothing matches those filters/i)).toBeTruthy(),
    )
  })

  it('sends a signed-out visitor from a member route to sign in', async () => {
    await renderAt('/my-events')
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeTruthy()
  })

  it('sends a signed-out visitor from /admin to the organiser login', async () => {
    await renderAt('/admin')
    expect(await screen.findByRole('heading', { name: /admin login/i })).toBeTruthy()
    // No admin surface leaks before authorisation.
    expect(screen.queryByRole('heading', { name: /dashboard/i })).toBeNull()
    expect(screen.queryByText(/create event/i)).toBeNull()
  })

  it('renders the organiser login directly', async () => {
    await renderAt('/admin/login')
    expect(await screen.findByRole('heading', { name: /admin login/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^login$/i })).toBeTruthy()
  })

  it('renders the legal pages', async () => {
    await renderAt('/privacy')
    expect(await screen.findByRole('heading', { name: /privacy policy/i })).toBeTruthy()
  })

  it('renders a 404 for an unknown route', async () => {
    await renderAt('/this-route-does-not-exist')
    expect(await screen.findByText('404')).toBeTruthy()
  })
})
