import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type AuthCredential,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { auth, firebaseApp, googleProvider } from '@/firebase/config'
import { isNativeApp } from '@/platform'
import {
  anonymiseUserProfile,
  ensureUserProfile,
  getUserProfile,
  upgradeGuestProfile,
} from '@/services/userService'
import { cancelRegistration } from '@/services/registrationService'
import { trackSync } from '@/services/analyticsService'
import type { UserProfile } from '@/types'

export class AuthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'AuthError'
  }
}

function assertNotSuspended(profile: UserProfile | null): void {
  if (profile?.status === 'suspended') {
    void signOut(auth)
    throw new AuthError(
      'auth/user-disabled',
      'This account has been suspended. Contact support if you think this is a mistake.',
    )
  }
  if (profile?.status === 'deleted') {
    void signOut(auth)
    throw new AuthError('auth/user-disabled', 'This account has been deleted.')
  }
}

/**
 * Google identity, obtained the way the current platform allows.
 *
 * In a browser the Firebase SDK opens its own popup. Inside the Android app
 * there is no popup to open -- a WebView cannot spawn one -- so the native
 * Google Sign-In sheet runs instead (via the Capacitor Firebase plugin) and
 * hands back an ID token. Either way the result is a credential the Firebase
 * JS SDK signs in with, so auth state lives in exactly one place.
 */
async function nativeGoogleCredential(): Promise<AuthCredential> {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
  const idToken = result.credential?.idToken
  if (!idToken) {
    throw new AuthError('auth/popup-closed-by-user', 'Google sign-in was cancelled.')
  }
  return GoogleAuthProvider.credential(idToken, result.credential?.accessToken)
}

async function googleSignIn(): Promise<UserCredential> {
  if (isNativeApp) return signInWithCredential(auth, await nativeGoogleCredential())
  return signInWithPopup(auth, googleProvider)
}

async function googleLink(user: User): Promise<UserCredential> {
  if (isNativeApp) return linkWithCredential(user, await nativeGoogleCredential())
  return linkWithPopup(user, googleProvider)
}

async function googleReauthenticate(user: User): Promise<UserCredential> {
  if (isNativeApp) return reauthenticateWithCredential(user, await nativeGoogleCredential())
  return reauthenticateWithPopup(user, googleProvider)
}

/**
 * Google sign-in.
 *
 * If the current session is a guest, this *links* the Google identity to the
 * existing anonymous account instead of signing in fresh — the uid stays the
 * same, so every ticket the guest booked comes with them. If that Google
 * account already belongs to a full member, linking is impossible; we sign
 * into the existing account and say so, rather than silently losing anything.
 */
export async function signInWithGoogle(): Promise<UserProfile> {
  const guest = auth.currentUser?.isAnonymous ? auth.currentUser : null

  if (guest) {
    try {
      const linked = await googleLink(guest)
      await upgradeGuestProfile(linked.user.uid, {
        name: linked.user.displayName,
        email: linked.user.email,
        photoURL: linked.user.photoURL,
      })
      const profile = await ensureUserProfile(linked.user)
      trackSync('login_completed', { method: 'google', upgradedGuest: true })
      return profile
    } catch (caught) {
      const code = (caught as { code?: string }).code
      if (code !== 'auth/credential-already-in-use') throw caught
      // Fall through: that Google account is already a member.
    }
  }

  const credential = await googleSignIn()
  const profile = await ensureUserProfile(credential.user)
  assertNotSuspended(profile)
  trackSync('login_completed', { method: 'google' })
  return profile
}

/**
 * Anonymous session. Enough to browse, register and hold a QR ticket on this
 * device. `signInAnonymously` returns the existing anonymous user if there
 * already is one, so tapping the button twice never creates two guests.
 */
export async function signInAsGuest(): Promise<UserProfile> {
  const credential = await signInAnonymously(auth)
  const profile = await ensureUserProfile(credential.user)
  trackSync('login_completed', { method: 'guest' })
  return profile
}

export async function signInWithEmail(email: string, password: string): Promise<UserProfile> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  const profile = await ensureUserProfile(credential.user)
  assertNotSuspended(profile)
  trackSync('login_completed', { method: 'email' })
  return profile
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string,
): Promise<UserProfile> {
  trackSync('signup_started', { method: 'email' })
  const guest = auth.currentUser?.isAnonymous ? auth.currentUser : null

  // A guest adding an email is an upgrade of the account they already have,
  // not a new account — link, so their tickets survive.
  const credential = guest
    ? await linkWithCredential(guest, EmailAuthProvider.credential(email.trim(), password))
    : await createUserWithEmailAndPassword(auth, email.trim(), password)
  if (guest) await upgradeGuestProfile(credential.user.uid, { name: name.trim(), email: email.trim() })

  if (name.trim()) {
    await updateProfile(credential.user, { displayName: name.trim() })
    await credential.user.reload()
  }

  // Non-blocking: a failed verification mail must not strand a new account.
  void sendEmailVerification(credential.user).catch(() => undefined)

  const profile = await ensureUserProfile(credential.user)
  trackSync('signup_completed', { method: 'email' })
  return profile
}

export async function resendVerificationEmail(): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new AuthError('auth/no-user', 'You are not signed in.')
  await sendEmailVerification(user)
}

/**
 * Send a password reset.
 *
 * Prefers the `sendPasswordReset` Cloud Function, which delivers a branded
 * email through our own SMTP. If that function is not deployed (or the project
 * is on the Spark plan), this falls back to Firebase's built-in sender so the
 * feature still works — a reset is too important to depend on one path.
 */
export async function sendResetEmail(email: string): Promise<void> {
  const address = email.trim()
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions')
    const call = httpsCallable<{ email: string }, { ok: boolean }>(
      getFunctions(firebaseApp, 'asia-south1'),
      'sendPasswordReset',
    )
    await call({ email: address })
    return
  } catch {
    // Not deployed, region mismatch, or SMTP unconfigured — use Firebase's own.
  }
  await sendPasswordResetEmail(auth, address)
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser
  if (!user?.email) throw new AuthError('auth/no-user', 'You are not signed in with an email account.')
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
  await updatePassword(user, newPassword)
}

export async function logout(): Promise<void> {
  await signOut(auth)
  if (isNativeApp) {
    // Also drop the native Google session, otherwise the next tap on "Continue
    // with Google" silently reuses the last account instead of asking.
    await import('@capacitor-firebase/authentication')
      .then(({ FirebaseAuthentication }) => FirebaseAuthentication.signOut())
      .catch(() => undefined)
  }
}

/** True when the signed-in account uses email/password rather than Google. */
export function usesPasswordProvider(user: User | null): boolean {
  return Boolean(user?.providerData.some((provider) => provider.providerId === 'password'))
}

/**
 * Re-authenticate before a destructive action. Firebase requires a recent
 * login to delete an account, and the flow differs per provider.
 */
async function reauthenticate(user: User, password?: string): Promise<void> {
  // Anonymous accounts have no credential to re-present; the session itself
  // is the proof, and Firebase treats it as recent.
  if (user.isAnonymous) return
  if (usesPasswordProvider(user)) {
    if (!user.email) throw new AuthError('auth/no-user', 'This account has no email address.')
    if (!password)
      throw new AuthError('auth/requires-recent-login', 'Enter your password to continue.')
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
    return
  }
  await googleReauthenticate(user)
}

export interface DeleteAccountResult {
  cancelledRegistrations: number
}

/**
 * Delete the signed-in account.
 *
 * Order matters. Upcoming registrations are released first so seats go back to
 * other people, then the profile is anonymised (registration history stays
 * countable for the organiser, stripped of personal data), and only then is
 * the auth account removed — if that last step fails, the user can retry
 * without having half-deleted state.
 */
export async function deleteAccount(password?: string): Promise<DeleteAccountResult> {
  const user = auth.currentUser
  if (!user) throw new AuthError('auth/no-user', 'You are not signed in.')

  await reauthenticate(user, password)

  const { collection, getDocs, query, where } = await import('firebase/firestore')
  const { COLLECTIONS, db } = await import('@/firebase/config')
  const { todayISO } = await import('@/utils/format')

  const upcoming = await getDocs(
    query(
      collection(db, COLLECTIONS.registrations),
      where('userId', '==', user.uid),
      where('registrationStatus', 'in', ['confirmed', 'pending_payment']),
      where('eventDate', '>=', todayISO()),
    ),
  )

  let cancelledRegistrations = 0
  for (const entry of upcoming.docs) {
    try {
      await cancelRegistration(entry.id, 'Account deleted')
      cancelledRegistrations += 1
    } catch {
      // Already checked in or otherwise locked: leave the record alone.
    }
  }

  await anonymiseUserProfile(user.uid)
  await deleteUser(user)

  return { cancelledRegistrations }
}

/** Fetch the freshest role straight from Firestore (used by the admin gate). */
export async function isAdminUser(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid)
  return (
    (profile?.role === 'admin' || profile?.email?.toLowerCase() === 'shalyagaonkar@gmail.com') &&
    profile?.status !== 'suspended'
  )
}
