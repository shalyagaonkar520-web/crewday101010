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

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (nextUser) => {
        profileUnsubscribe.current?.()
        profileUnsubscribe.current = null
        setUser(nextUser)

        if (!nextUser) {
          setProfile(null)
          setError(null)
          setLoading(false)
          return
        }

        try {
          // Guarantees a profile document exists before anything reads it —
          // covers Google sign-in, a first email sign-up and any account whose
          // document was removed underneath it.
          await ensureUserProfile(nextUser)
          setError(null)
        } catch {
          setError('We could not load your profile. Check your connection and try again.')
        }

        profileUnsubscribe.current = subscribeToUserProfile(
          nextUser.uid,
          (nextProfile) => {
            setProfile(nextProfile)
            setLoading(false)
          },
          () => {
            setError('We could not load your profile. Check your connection and try again.')
            setLoading(false)
          },
        )
      },
      () => {
        setError('Authentication is unavailable right now.')
        setLoading(false)
      },
    )

    return () => {
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
