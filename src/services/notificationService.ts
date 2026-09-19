import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLLECTIONS, db } from '@/firebase/config'
import type { AppNotification, NotificationType } from '@/types'
import { sanitiseText } from '@/utils/validation'

/**
 * In-app notifications live in Firestore so they work on the free Spark plan
 * with no server. Push delivery (FCM) is layered on top by a Cloud Function
 * that watches this collection — see `functions/src/index.ts`.
 */

function mapNotification(snapshot: QueryDocumentSnapshot<DocumentData>): AppNotification {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    userId: data.userId ?? '',
    type: (data.type as NotificationType) ?? 'system',
    title: data.title ?? '',
    body: data.body ?? '',
    eventId: data.eventId ?? '',
    read: Boolean(data.read),
    createdAt: data.createdAt ?? null,
  }
}

export function subscribeToNotifications(
  uid: string,
  onChange: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.notifications),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      fsLimit(50),
    ),
    (snapshot) => onChange(snapshot.docs.map(mapNotification)),
    (error) => onError?.(error),
  )
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.notifications, id), { read: true })
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.notifications),
      where('userId', '==', uid),
      where('read', '==', false),
      fsLimit(200),
    ),
  )
  if (snapshot.empty) return
  const batch = writeBatch(db)
  for (const entry of snapshot.docs) batch.update(entry.ref, { read: true })
  await batch.commit()
}

export interface NotificationInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  eventId?: string
}

export async function createNotification(input: NotificationInput): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(collection(db, COLLECTIONS.notifications)), {
    userId: input.userId,
    type: input.type,
    title: sanitiseText(input.title, 120),
    body: sanitiseText(input.body, 300),
    eventId: input.eventId ?? '',
    read: false,
    createdAt: serverTimestamp(),
  })
  await batch.commit()
}

/**
 * Fan a notification out to many users. Firestore batches cap at 500 writes,
 * so this chunks. Admin-only under the security rules.
 */
export async function createNotifications(inputs: NotificationInput[]): Promise<number> {
  if (!inputs.length) return 0
  const CHUNK = 400
  let written = 0

  for (let index = 0; index < inputs.length; index += CHUNK) {
    const batch = writeBatch(db)
    for (const input of inputs.slice(index, index + CHUNK)) {
      batch.set(doc(collection(db, COLLECTIONS.notifications)), {
        userId: input.userId,
        type: input.type,
        title: sanitiseText(input.title, 120),
        body: sanitiseText(input.body, 300),
        eventId: input.eventId ?? '',
        read: false,
        createdAt: serverTimestamp(),
      })
      written += 1
    }
    await batch.commit()
  }
  return written
}

/** Notify everyone holding a live registration for an event. */
export async function notifyEventAudience(options: {
  eventId: string
  type: NotificationType
  title: string
  body: string
}): Promise<number> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.registrations),
      where('eventId', '==', options.eventId),
      where('registrationStatus', 'in', ['confirmed', 'pending_payment']),
    ),
  )
  const recipients = new Set<string>()
  for (const entry of snapshot.docs) {
    const userId = entry.data().userId
    if (typeof userId === 'string' && userId) recipients.add(userId)
  }
  return createNotifications(
    [...recipients].map((userId) => ({
      userId,
      type: options.type,
      title: options.title,
      body: options.body,
      eventId: options.eventId,
    })),
  )
}
