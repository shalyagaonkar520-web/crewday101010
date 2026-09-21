import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, COLLECTIONS, db, isFirebaseConfigured } from '@/firebase/config'
import { ensureUserProfile, subscribeToUserProfile } from '@/services/userService'
import { trackSync } from '@/services/analyticsService'
import type { UserProfile } from '@/types'

export interface AuthState {
  /** Firebase Auth user, or null when signed out. */
  user: User | null
  /** Firestore profile document, live. Null until it loads or if signed out. */
  profile: UserProfile | null
  /** True until the first auth state + profile resolution completes. */
  loading: boolean
  /** Profile could not be loaded (offline, rules, deleted doc). */
  error: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  isSuspended: boolean
  /** Anonymous session — browsing and booking allowed, no persistent identity. */
  isGuest: boolean
  needsOnboarding: boolean
  emailVerified: boolean
  refreshProfile: () => Promise<void>
}

/** How long to wait for the profile before rendering the app without it. */
const PROFILE_LOAD_TIMEOUT_MS = 8_000

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const profileUnsubscribe = useRef<(() => void) | null>(null)

  const refreshProfile = useCallback(async () => {
    const current = auth.currentUser
    if (!current) return
    await current.reload()
    setUser({ ...current, emailVerified: current.emailVerified } as User)
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      setError(
        import.meta.env.DEV
          ? 'Backend not configured — add your project keys to .env.local.'
          : 'CrewDay is still being set up on this deployment. Please try again shortly.',
      )
      return
    }

    trackSync('app_open')

    // The loading gate must never depend on a Firestore round-trip finishing.
    // On a spent free-plan quota the SDK retries RESOURCE_EXHAUSTED forever,
    // so neither the read nor the write inside `ensureUserProfile` ever
    // settles -- which pinned `loading` at true and left every route stuck on
    // <LoadingScreen /> for good. The profile listener releases the gate, and
    // a watchdog releases it anyway if Firestore never answers at all.
    let watchdog: ReturnType<typeof setTimeout> | undefined

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (nextUser) => {
        profileUnsubscribe.current?.()
        profileUnsubscribe.current = null
        clearTimeout(watchdog)
        setUser(nextUser)

        if (!nextUser) {
          setProfile(null)
          setError(null)
          setLoading(false)
          return
        }

        // Bounded window for the profile to arrive. If it does not, the app
        // still renders -- signed in, profile missing, error shown -- instead
        // of spinning indefinitely.
        watchdog = setTimeout(() => {
          setError('We could not load your profile. Check your connection and try again.')
          setLoading(false)
        }, PROFILE_LOAD_TIMEOUT_MS)

        // Listen first, then make sure the document exists. The listener
        // paints from the IndexedDB cache straight away on a repeat visit, and
        // for a brand-new account it fires with the locally pending write the
        // moment `ensureUserProfile` issues it -- so nobody waits on the server
        // acknowledging a write, which on a spent write quota never comes.
        profileUnsubscribe.current = subscribeToUserProfile(
          nextUser.uid,
          (nextProfile) => {
            setProfile(nextProfile)
            if (nextProfile) {
              clearTimeout(watchdog)
              setError(null)
              setLoading(false)
            }
          },
          () => {
            clearTimeout(watchdog)
            setError('We could not load your profile. Check your connection and try again.')
            setLoading(false)
          },
        )

        // Deliberately not awaited. `ensureUserProfile` both reads and writes,
        // and either half can hang forever on a spent quota; the listener above
        // is what releases the gate, so this only needs to report failure.
        void ensureUserProfile(nextUser).catch(() => {
          setError('We could not load your profile. Check your connection and try again.')
        })
      },
      () => {
        clearTimeout(watchdog)
        setError('Authentication is unavailable right now.')
        setLoading(false)
      },
    )

    return () => {
      clearTimeout(watchdog)
      unsubscribeAuth()
      profileUnsubscribe.current?.()
      profileUnsubscribe.current = null
    }
  }, [])

  // Light-touch "active user" signal for the admin dashboard, at most once a
  // day. `ensureUserProfile` already stamps it on every sign-in, so this only
  // matters for a tab left open across days.
  //
  // Two guards keep it from running away. A pending `serverTimestamp()` reads
  // back as `null` in the local snapshot, which used to look like "never
  // active" and fire another write on every snapshot — a loop that burned
  // through the daily write quota. So: never bump while the value is null,
  // and never bump more than once per user per session.
  const bumpedActiveFor = useRef<string | null>(null)
  useEffect(() => {
    if (!user || !profile) return
    if (bumpedActiveFor.current === user.uid) return
    const lastActive = profile.lastActiveAt?.toDate?.()
    if (!lastActive) return
    if (Date.now() - lastActive.getTime() < 86_400_000) return
    bumpedActiveFor.current = user.uid
    void updateDoc(doc(db, COLLECTIONS.users, user.uid), { lastActiveAt: serverTimestamp() }).catch(
      () => undefined,
    )
  }, [user, profile])

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      error,
      isAuthenticated: Boolean(user),
      isAdmin:
        (profile?.role === 'admin' || user?.email?.toLowerCase() === 'shalyagaonkar@gmail.com') &&
        profile?.status !== 'suspended',
      isSuspended: profile?.status === 'suspended',
      isGuest: Boolean(user?.isAnonymous),
      // Guests skip the interest questionnaire; it exists to personalise a
      // profile they have not committed to keeping.
      needsOnboarding: Boolean(user && profile && !profile.onboardingCompleted && !user.isAnonymous),
      emailVerified: Boolean(user?.emailVerified),
      refreshProfile,
    }),
    [user, profile, loading, error, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
