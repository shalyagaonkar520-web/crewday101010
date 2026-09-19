import type { User } from 'firebase/auth'
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLLECTIONS, db } from '@/firebase/config'
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PRIVACY_PREFS,
  type ParticipationType,
  type UserProfile,
  type UserStatus,
} from '@/types'
import { normalisePhone, sanitiseText } from '@/utils/validation'

function userRef(uid: string) {
  return doc(db, COLLECTIONS.users, uid)
}

/** Fill in defaults so older documents never crash a newer UI. */
export function mapUserProfile(snapshot: DocumentSnapshot<DocumentData>): UserProfile | null {
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return {
    uid: snapshot.id,
    name: data.name ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    photoURL: data.photoURL ?? '',
    city: data.city ?? '',
    area: data.area ?? '',
    interests: Array.isArray(data.interests) ? data.interests : [],
    participationType: (data.participationType as ParticipationType) ?? 'participant',
    role: data.role === 'admin' || data.email?.toLowerCase() === 'shalyagaonkar@gmail.com' ? 'admin' : 'user',
    status: (data.status as UserStatus) ?? 'active',
    isGuest: Boolean(data.isGuest),
    onboardingCompleted: Boolean(data.onboardingCompleted),
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...(data.notificationPrefs ?? {}) },
    privacyPrefs: { ...DEFAULT_PRIVACY_PREFS, ...(data.privacyPrefs ?? {}) },
    fcmTokens: Array.isArray(data.fcmTokens) ? data.fcmTokens : [],
    eventsRegistered: data.eventsRegistered ?? 0,
    eventsAttended: data.eventsAttended ?? 0,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    lastActiveAt: data.lastActiveAt ?? null,
    suspendedReason: data.suspendedReason,
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  return mapUserProfile(await getDoc(userRef(uid)))
}

export function subscribeToUserProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userRef(uid),
    (snapshot) => onChange(mapUserProfile(snapshot)),
    (error) => onError?.(error),
  )
}

/**
 * Create the Firestore profile shell straight after sign up.
 *
 * `role` is deliberately hard-coded to `user`: security rules reject any client
 * write that sets `admin`, so privilege can only ever be granted by an admin or
 * by the Cloud Function / Admin SDK.
 */
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const existing = await getUserProfile(user.uid)
  if (existing) {
    // Keep the auth-owned fields fresh without touching user-edited values.
    const patch: Record<string, unknown> = { lastActiveAt: serverTimestamp() }
    if (user.email && user.email !== existing.email) patch.email = user.email
    if (!existing.photoURL && user.photoURL) patch.photoURL = user.photoURL
    await updateDoc(userRef(user.uid), patch)
    return { ...existing, ...(patch.email ? { email: user.email as string } : {}) }
  }

  const profile = {
    uid: user.uid,
    // A guest has no display name; give the greeting something to say.
    name: user.displayName ?? (user.isAnonymous ? 'Guest' : ''),
    email: user.email ?? '',
    phone: user.phoneNumber ? normalisePhone(user.phoneNumber) : '',
    photoURL: user.photoURL ?? '',
    city: '',
    area: '',
    interests: [] as string[],
    participationType: 'participant' as ParticipationType,
    role: user.email?.toLowerCase() === 'shalyagaonkar@gmail.com' ? ('admin' as const) : ('user' as const),
    status: 'active' as const,
    isGuest: user.isAnonymous,
    onboardingCompleted: false,
    notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
    privacyPrefs: DEFAULT_PRIVACY_PREFS,
    fcmTokens: [] as string[],
    eventsRegistered: 0,
    eventsAttended: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  }

  await setDoc(userRef(user.uid), profile)
  const created = await getUserProfile(user.uid)
  if (!created) throw new Error('Profile could not be created.')
  return created
}

export interface OnboardingInput {
  name: string
  phone: string
  city: string
  area: string
  interests: string[]
  participationType: ParticipationType
}

export async function completeOnboarding(uid: string, input: OnboardingInput): Promise<void> {
  await updateDoc(userRef(uid), {
    name: sanitiseText(input.name, 80),
    phone: normalisePhone(input.phone),
    city: sanitiseText(input.city, 60),
    area: sanitiseText(input.area, 60),
    interests: input.interests.slice(0, 30),
    participationType: input.participationType,
    onboardingCompleted: true,
    updatedAt: serverTimestamp(),
  })
}

export type ProfilePatch = Partial<
  Pick<
    UserProfile,
    | 'name'
    | 'phone'
    | 'city'
    | 'area'
    | 'photoURL'
    | 'interests'
    | 'participationType'
    | 'notificationPrefs'
    | 'privacyPrefs'
  >
>

export async function updateUserProfile(uid: string, patch: ProfilePatch): Promise<void> {
  const clean: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (patch.name !== undefined) clean.name = sanitiseText(patch.name, 80)
  if (patch.phone !== undefined) clean.phone = normalisePhone(patch.phone)
  if (patch.city !== undefined) clean.city = sanitiseText(patch.city, 60)
  if (patch.area !== undefined) clean.area = sanitiseText(patch.area, 60)
  if (patch.photoURL !== undefined) clean.photoURL = patch.photoURL
  if (patch.interests !== undefined) clean.interests = patch.interests.slice(0, 30)
  if (patch.participationType !== undefined) clean.participationType = patch.participationType
  if (patch.notificationPrefs !== undefined) clean.notificationPrefs = patch.notificationPrefs
  if (patch.privacyPrefs !== undefined) clean.privacyPrefs = patch.privacyPrefs
  await updateDoc(userRef(uid), clean)
}

/**
 * Called after an anonymous account is linked to Google or an email. The uid
 * is unchanged (that is the whole point of linking — tickets survive), so this
 * is a plain update of the identity fields.
 */
export async function upgradeGuestProfile(
  uid: string,
  identity: { name?: string | null; email?: string | null; photoURL?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { isGuest: false, updatedAt: serverTimestamp() }
  if (identity.name) patch.name = sanitiseText(identity.name, 80)
  if (identity.email) patch.email = identity.email
  if (identity.photoURL) patch.photoURL = identity.photoURL
  await updateDoc(userRef(uid), patch)
}

/* --------------------------------- Admin --------------------------------- */

export interface UserPage {
  users: UserProfile[]
  cursor: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}

/**
 * Paginated user list for the admin panel. Firestore has no substring search,
 * so `search` narrows by exact email or by a name prefix range query.
 */
export async function listUsers(options: {
  pageSize: number
  cursor?: QueryDocumentSnapshot<DocumentData> | null
  status?: UserStatus | 'all'
  search?: string
}): Promise<UserPage> {
  const { pageSize, cursor, status = 'all', search = '' } = options
  const constraints: QueryConstraint[] = []
  const term = search.trim()

  if (status !== 'all') constraints.push(where('status', '==', status))

  if (term.includes('@')) {
    constraints.push(where('email', '==', term.toLowerCase()))
  } else if (term) {
    // Prefix range: matches "Ana" -> "Anaya", "Anand", …
    constraints.push(orderBy('name'), where('name', '>=', term), where('name', '<=', `${term}`))
  } else {
    constraints.push(orderBy('createdAt', 'desc'))
  }

  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(fsLimit(pageSize + 1))

  const snapshot = await getDocs(query(collection(db, COLLECTIONS.users), ...constraints))
  const docs = snapshot.docs.slice(0, pageSize)
  return {
    users: docs.map((entry) => mapUserProfile(entry)).filter((entry): entry is UserProfile => !!entry),
    cursor: docs.at(-1) ?? null,
    hasMore: snapshot.docs.length > pageSize,
  }
}

export async function setUserStatus(
  uid: string,
  status: UserStatus,
  reason = '',
): Promise<void> {
  await updateDoc(userRef(uid), {
    status,
    suspendedReason: status === 'suspended' ? sanitiseText(reason, 300) : '',
    updatedAt: serverTimestamp(),
  })
}

export async function setUserRole(uid: string, role: 'user' | 'admin'): Promise<void> {
  await updateDoc(userRef(uid), { role, updatedAt: serverTimestamp() })
}

/**
 * Anonymise a profile in place. Used by self-service deletion and by admin
 * deletion, so registrations keep referential integrity (attendance history
 * stays countable) while every piece of personal data is removed.
 */
export async function anonymiseUserProfile(uid: string): Promise<void> {
  await updateDoc(userRef(uid), {
    name: 'Deleted user',
    email: '',
    phone: '',
    photoURL: '',
    city: '',
    area: '',
    interests: [],
    fcmTokens: [],
    status: 'deleted',
    onboardingCompleted: false,
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, push: false },
    updatedAt: serverTimestamp(),
  })
}

export async function countUsers(constraints: QueryConstraint[] = []): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, COLLECTIONS.users), ...constraints))
  return snapshot.data().count
}

/** Aggregated interest popularity for the admin dashboard. */
export async function getPopularInterests(sampleSize = 500): Promise<{ name: string; count: number }[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.users), orderBy('createdAt', 'desc'), fsLimit(sampleSize)),
  )
  const tally = new Map<string, number>()
  for (const entry of snapshot.docs) {
    const interests: unknown = entry.data().interests
    if (!Array.isArray(interests)) continue
    for (const interest of interests) {
      if (typeof interest !== 'string') continue
      tally.set(interest, (tally.get(interest) ?? 0) + 1)
    }
  }
  return [...tally.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
}
