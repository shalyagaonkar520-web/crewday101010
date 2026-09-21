/**
 * Google sign-in must take the right route for the platform.
 *
 * A WebView cannot open the OAuth popup the website relies on, so inside the
 * Android shell `signInWithGoogle` has to obtain a credential from the native
 * Google Sign-In sheet and hand it to `signInWithCredential`. On the web the
 * popup path stays exactly as it was. The same switch guards web push, which
 * the WebView can never deliver.
 *
 * The platform flag is mocked as a live getter rather than re-importing the
 * modules per test: `@/firebase/config` initialises Firestore on import, and a
 * second import in the same process throws "already been called with
 * different options".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isPushSupported, pushPermission } from '@/services/messagingService'
import { signInWithGoogle } from '@/services/authService'

const popup = vi.fn()
const withCredential = vi.fn()
const nativeGoogle = vi.fn()
const platformState = { native: false }

vi.mock('@/platform', () => ({
  get isNativeApp() {
    return platformState.native
  },
  get platform() {
    return platformState.native ? 'android' : 'web'
  },
}))

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth')
  return {
    ...actual,
    getAuth: () => ({ currentUser: null }),
    signInWithPopup: (...args: unknown[]) => popup(...args),
    signInWithCredential: (...args: unknown[]) => withCredential(...args),
  }
})

vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: {
    signInWithGoogle: (...args: unknown[]) => nativeGoogle(...args),
    signOut: vi.fn(async () => undefined),
  },
}))

vi.mock('@/services/userService', async () => {
  const actual = await vi.importActual<typeof import('@/services/userService')>(
    '@/services/userService',
  )
  return {
    ...actual,
    ensureUserProfile: vi.fn(async (user: { uid: string }) => ({
      uid: user.uid,
      role: 'user',
      status: 'active',
    })),
  }
})

const fakeUser = { uid: 'g-1', email: 'g@example.com', isAnonymous: false }

beforeEach(() => {
  platformState.native = false
  popup.mockReset().mockResolvedValue({ user: fakeUser })
  withCredential.mockReset().mockResolvedValue({ user: fakeUser })
  nativeGoogle.mockReset().mockResolvedValue({
    credential: { idToken: 'id-token', accessToken: 'access-token' },
  })
})

describe('Google sign-in by platform', () => {
  it('uses the Firebase popup on the web', async () => {
    await signInWithGoogle()

    expect(popup).toHaveBeenCalledTimes(1)
    expect(withCredential).not.toHaveBeenCalled()
    expect(nativeGoogle).not.toHaveBeenCalled()
  })

  it('uses the native Google sheet and signInWithCredential in the Android app', async () => {
    platformState.native = true

    await signInWithGoogle()

    expect(popup).not.toHaveBeenCalled()
    // The native layer only fetches the token; the JS SDK does the sign-in.
    expect(nativeGoogle).toHaveBeenCalledWith({ skipNativeAuth: true })
    expect(withCredential).toHaveBeenCalledTimes(1)
    const [, credential] = withCredential.mock.calls[0] as [unknown, { providerId: string }]
    expect(credential.providerId).toBe('google.com')
  })

  it('treats a dismissed native sheet as a cancelled sign-in, not a crash', async () => {
    platformState.native = true
    nativeGoogle.mockResolvedValue({ credential: null })

    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' })
    expect(withCredential).not.toHaveBeenCalled()
  })
})

describe('web push by platform', () => {
  it('is reported unsupported inside the native shell', () => {
    platformState.native = true
    expect(isPushSupported()).toBe(false)
    expect(pushPermission()).toBe('unsupported')
  })
})
