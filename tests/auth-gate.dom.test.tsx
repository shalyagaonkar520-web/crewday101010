/**
 * The loading gate must release even when Firestore never answers.
 *
 * Every route guard shows <LoadingScreen /> while `loading` is true. The
 * regression this covers: `ensureUserProfile` (a getDoc + setDoc) can hang
 * forever on a spent write quota because the SDK retries RESOURCE_EXHAUSTED
 * indefinitely -- and the gate used to wait on it, so the whole app sat on the
 * spinner for good. Two guarantees are asserted here:
 *
 *  1. When the profile listener delivers a profile, the app renders straight
 *     away regardless of `ensureUserProfile` still being in flight.
 *  2. When the listener never delivers one either, the watchdog releases the
 *     gate after its timeout instead of spinning indefinitely.
 */

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_PRIVACY_PREFS, type UserProfile } from '@/types'

const signedInUser = {
  uid: 'user-1',
  email: 'member@example.com',
  displayName: 'Member',
  photoURL: '',
  phoneNumber: null,
  isAnonymous: false,
  emailVerified: true,
  providerData: [{ providerId: 'password' }],
  reload: async () => undefined,
}

const fullProfile: UserProfile = {
  uid: 'user-1',
  name: 'Member',
  email: 'member@example.com',
  phone: '',
  photoURL: '',
  city: 'Pune',
  area: '',
  interests: ['music'],
  participationType: 'participant',
  role: 'user',
  status: 'active',
  isGuest: false,
  onboardingCompleted: true,
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  privacyPrefs: DEFAULT_PRIVACY_PREFS,
  fcmTokens: [],
  eventsRegistered: 0,
  eventsAttended: 0,
  createdAt: null,
  updatedAt: null,
  lastActiveAt: null,
}

// What the profile listener hands back; each test sets it.
let profileFromListener: UserProfile | null = null

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

vi.mock('@/services/userService', async () => {
  const actual = await vi.importActual<typeof import('@/services/userService')>(
    '@/services/userService',
  )
  return {
    ...actual,
    subscribeToUserProfile: (
      _uid: string,
      onChange: (profile: UserProfile | null) => void,
    ) => {
      onChange(profileFromListener)
      return () => undefined
    },
    // The failure mode under test: a write the SDK retries forever.
    ensureUserProfile: () => new Promise<UserProfile>(() => undefined),
  }
})

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth')
  return {
    ...actual,
    getAuth: () => ({ currentUser: signedInUser }),
    onAuthStateChanged: (_auth: unknown, next: (user: typeof signedInUser) => void) => {
      next(signedInUser)
      return () => undefined
    },
  }
})

beforeAll(() => {
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

beforeEach(() => {
  // Real time keeps flowing so lazy route chunks still import; only the
  // watchdog timer is under our control.
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

async function renderAt(path: string) {
  window.history.pushState({}, '', path)
  const { default: App } = await import('@/App')
  return render(<App />)
}

describe('auth loading gate', () => {
  it('renders as soon as the profile listener delivers, even if the profile write never settles', async () => {
    profileFromListener = fullProfile
    await renderAt('/explore')
    // No timer advance: the listener alone must be enough to release the gate.
    expect(await screen.findByRole('heading', { name: /discover events/i })).toBeTruthy()
  })

  it('gives up waiting after the watchdog timeout when Firestore never answers', async () => {
    profileFromListener = null
    await renderAt('/explore')

    // Still gated: the profile has not arrived and the write is hanging.
    expect(screen.queryByRole('heading', { name: /discover events/i })).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(8_100)
    })

    // Rendered signed-in-without-a-profile rather than spinning forever.
    expect(await screen.findByRole('heading', { name: /discover events/i })).toBeTruthy()
  })
})
