import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLLECTIONS, db } from '@/firebase/config'
import { createEvent } from '@/services/eventService'
import { createNotification } from '@/services/notificationService'
import type { EventRequest, EventRequestDraft, EventRequestStatus, UserProfile } from '@/types'
import { DEFAULT_CURRENCY, LAUNCH_CITY } from '@/utils/constants'
import { normalisePhone, sanitiseText } from '@/utils/validation'

function mapRequest(snapshot: QueryDocumentSnapshot<DocumentData>): EventRequest {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    title: data.title ?? '',
    description: data.description ?? '',
    category: data.category ?? 'Other',
    date: data.date ?? '',
    startTime: data.startTime ?? '',
    endTime: data.endTime ?? '',
    venue: data.venue ?? '',
    address: data.address ?? '',
    city: data.city ?? LAUNCH_CITY,
    area: data.area ?? '',
    capacity: data.capacity ?? 0,
    price: data.price ?? 0,
    currency: data.currency ?? DEFAULT_CURRENCY,
    eventTypes: Array.isArray(data.eventTypes) && data.eventTypes.length ? data.eventTypes : ['both'],
    requestedBy: data.requestedBy ?? '',
    requesterName: data.requesterName ?? '',
    requesterEmail: data.requesterEmail ?? '',
    requesterPhone: data.requesterPhone ?? '',
    status: (data.status as EventRequestStatus) ?? 'pending',
    reviewNote: data.reviewNote ?? '',
    reviewedBy: data.reviewedBy ?? '',
    reviewedAt: data.reviewedAt ?? null,
    createdEventId: data.createdEventId ?? '',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  }
}

/**
 * Submit a proposal.
 *
 * `status` is pinned to `pending` and `createdEventId` to empty — the security
 * rules reject anything else, so a member cannot submit a pre-approved request
 * or point one at an existing event.
 */
export async function submitEventRequest(
  draft: EventRequestDraft,
  profile: UserProfile,
): Promise<string> {
  const created = await addDoc(collection(db, COLLECTIONS.eventRequests), {
    title: sanitiseText(draft.title, 120),
    description: sanitiseText(draft.description, 4000),
    category: draft.category,
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime ?? '',
    venue: sanitiseText(draft.venue, 120),
    address: sanitiseText(draft.address, 300),
    city: LAUNCH_CITY,
    area: sanitiseText(draft.area, 60),
    capacity: Math.max(1, Math.floor(draft.capacity)),
    price: Math.max(0, Math.round(draft.price)),
    currency: DEFAULT_CURRENCY,
    eventTypes: draft.eventTypes,
    requestedBy: profile.uid,
    requesterName: profile.name,
    requesterEmail: profile.email,
    requesterPhone: normalisePhone(draft.requesterPhone || profile.phone),
    status: 'pending',
    reviewNote: '',
    reviewedBy: '',
    reviewedAt: null,
    createdEventId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return created.id
}

/** Live list of a member's own proposals. */
export function subscribeToMyRequests(
  uid: string,
  onChange: (requests: EventRequest[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.eventRequests),
      where('requestedBy', '==', uid),
      orderBy('createdAt', 'desc'),
      fsLimit(30),
    ),
    (snapshot) => onChange(snapshot.docs.map(mapRequest)),
    (error) => onError?.(error),
  )
}

/** A member can pull their own proposal back while it is still pending. */
export async function withdrawEventRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.eventRequests, requestId), {
    status: 'withdrawn',
    updatedAt: serverTimestamp(),
  })
}

/* --------------------------------- Admin ---------------------------------- */

export async function listEventRequests(
  status: EventRequestStatus | 'all' = 'pending',
  max = 50,
): Promise<EventRequest[]> {
  const constraints = status === 'all' ? [] : [where('status', '==', status)]
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.eventRequests),
      ...constraints,
      orderBy('createdAt', 'desc'),
      fsLimit(max),
    ),
  )
  return snapshot.docs.map(mapRequest)
}

export async function countPendingRequests(): Promise<number> {
  const snapshot = await getCountFromServer(
    query(collection(db, COLLECTIONS.eventRequests), where('status', '==', 'pending')),
  )
  return snapshot.data().count
}

/**
 * Approve a proposal by creating the real event from it.
 *
 * The event is created as a **draft** rather than published: an organiser
 * still owns the decision about imagery, price and going live, and approving
 * a proposal should never put an unreviewed listing in front of members.
 */
export async function approveEventRequest(
  request: EventRequest,
  adminUid: string,
  note = '',
): Promise<string> {
  const eventId = await createEvent(
    {
      title: request.title,
      description: request.description,
      imageURL: '',
      imagePath: '',
      category: request.category,
      date: request.date,
      startTime: request.startTime,
      endTime: request.endTime,
      venue: request.venue,
      address: request.address,
      city: request.city,
      area: request.area,
      mapsURL: '',
      capacity: request.capacity,
      price: request.price,
      currency: request.currency,
      eventTypes: request.eventTypes,
      status: 'draft',
      featured: false,
      waitlistEnabled: true,
      tags: [],
    },
    adminUid,
  )

  await updateDoc(doc(db, COLLECTIONS.eventRequests, request.id), {
    status: 'approved',
    reviewNote: sanitiseText(note, 500),
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp(),
    createdEventId: eventId,
    updatedAt: serverTimestamp(),
  })

  await createNotification({
    userId: request.requestedBy,
    type: 'request_approved',
    title: `Your event was approved: ${request.title}`,
    body: note || 'An organiser is finalising the details and will publish it shortly.',
  }).catch(() => undefined)

  return eventId
}

export async function rejectEventRequest(
  request: EventRequest,
  adminUid: string,
  note: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.eventRequests, request.id), {
    status: 'rejected',
    reviewNote: sanitiseText(note, 500),
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await createNotification({
    userId: request.requestedBy,
    type: 'request_rejected',
    title: `Update on your event request: ${request.title}`,
    body: note || 'We could not run this one. Tap to submit another idea.',
  }).catch(() => undefined)
}
