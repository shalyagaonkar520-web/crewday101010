import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { COLLECTIONS, db } from '@/firebase/config'
import type { EventFeedback, ProblemReport } from '@/types'
import { sanitiseText } from '@/utils/validation'

/* ------------------------------ Event feedback ---------------------------- */

function feedbackIdFor(eventId: string, uid: string): string {
  return `${eventId}__${uid}`
}

/** "How was your CrewDay?" — one rating per person per event. */
export async function submitEventFeedback(input: {
  eventId: string
  userId: string
  rating: number
  comment: string
}): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.feedback, feedbackIdFor(input.eventId, input.userId)), {
    eventId: input.eventId,
    userId: input.userId,
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    comment: sanitiseText(input.comment, 500),
    createdAt: serverTimestamp(),
  })
}

export async function getMyEventFeedback(
  eventId: string,
  uid: string,
): Promise<EventFeedback | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.feedback, feedbackIdFor(eventId, uid)))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return {
    id: snapshot.id,
    eventId: data.eventId ?? '',
    userId: data.userId ?? '',
    rating: data.rating ?? 0,
    comment: data.comment ?? '',
    createdAt: data.createdAt ?? null,
  }
}

export async function listEventFeedback(eventId: string, max = 100): Promise<EventFeedback[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.feedback),
      where('eventId', '==', eventId),
      orderBy('createdAt', 'desc'),
      fsLimit(max),
    ),
  )
  return snapshot.docs.map((entry) => {
    const data = entry.data()
    return {
      id: entry.id,
      eventId: data.eventId ?? '',
      userId: data.userId ?? '',
      rating: data.rating ?? 0,
      comment: data.comment ?? '',
      createdAt: data.createdAt ?? null,
    }
  })
}

/* ------------------------------ Problem reports --------------------------- */

export async function submitProblemReport(input: {
  userId: string
  email: string
  subject: string
  message: string
}): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.reports), {
    userId: input.userId,
    email: input.email.trim().toLowerCase(),
    subject: sanitiseText(input.subject, 120),
    message: sanitiseText(input.message, 2000),
    status: 'open',
    createdAt: serverTimestamp(),
  })
}

function mapReport(snapshot: QueryDocumentSnapshot<DocumentData>): ProblemReport {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    userId: data.userId ?? '',
    email: data.email ?? '',
    subject: data.subject ?? '',
    message: data.message ?? '',
    status: data.status === 'resolved' ? 'resolved' : 'open',
    createdAt: data.createdAt ?? null,
  }
}

export async function listProblemReports(status: 'open' | 'resolved' | 'all' = 'all', max = 100) {
  const constraints = status === 'all' ? [] : [where('status', '==', status)]
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.reports), ...constraints, orderBy('createdAt', 'desc'), fsLimit(max)),
  )
  return snapshot.docs.map(mapReport)
}

export async function setReportStatus(id: string, status: 'open' | 'resolved'): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.reports, id), { status })
}
