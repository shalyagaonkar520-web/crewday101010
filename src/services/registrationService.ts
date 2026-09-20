import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { COLLECTIONS, db } from '@/firebase/config'
import { isInlineImage } from '@/services/storageService'
import type {
  AttendanceStatus,
  CrewEvent,
  ParticipationType,
  PaymentStatus,
  Registration,
  RegistrationStatus,
  WaitlistEntry,
} from '@/types'
import { generateQrToken, generateRegistrationCode, type ParsedQrPayload } from '@/utils/ids'
import { normalisePhone, sanitiseText } from '@/utils/validation'
import { todayISO } from '@/utils/format'

/**
 * Registration ids are deterministic: `${eventId}__${uid}`.
 *
 * That makes "one person, one seat" an invariant of the data model rather than
 * something we hope a race does not break — a second attempt hits the same
 * document inside the same transaction. The id is not a secret; the QR is
 * validated against `qrToken`, which is.
 */
export function registrationIdFor(eventId: string, uid: string): string {
  return `${eventId}__${uid}`
}

export function mapRegistration(
  snapshot: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData | undefined },
): Registration | null {
  const data = snapshot.data()
  if (!data) return null
  return {
    id: snapshot.id,
    registrationCode: data.registrationCode ?? '',
    eventId: data.eventId ?? '',
    eventTitle: data.eventTitle ?? '',
    eventDate: data.eventDate ?? '',
    eventStartTime: data.eventStartTime ?? '',
    eventVenue: data.eventVenue ?? '',
    eventImageURL: data.eventImageURL ?? '',
    userId: data.userId ?? '',
    name: data.name ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    participationType: (data.participationType as ParticipationType) ?? 'participant',
    price: data.price ?? 0,
    currency: data.currency ?? 'INR',
    paymentStatus: (data.paymentStatus as PaymentStatus) ?? 'not_required',
    registrationStatus: (data.registrationStatus as RegistrationStatus) ?? 'confirmed',
    qrToken: data.qrToken ?? '',
    attendanceStatus: (data.attendanceStatus as AttendanceStatus) ?? 'not_checked_in',
    registeredAt: data.registeredAt ?? null,
    checkInTime: data.checkInTime ?? null,
    checkedInBy: data.checkedInBy ?? '',
    cancelledAt: data.cancelledAt ?? null,
    cancelledReason: data.cancelledReason,
    updatedAt: data.updatedAt ?? null,
  }
}

export class RegistrationError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'RegistrationError'
  }
}

/* ------------------------------- Registering ------------------------------ */

export interface RegistrationInput {
  eventId: string
  userId: string
  name: string
  email: string
  phone: string
  participationType: ParticipationType
}

export interface RegistrationResult {
  registrationId: string
  registrationCode: string
  qrToken: string
  status: RegistrationStatus
  paymentStatus: PaymentStatus
}

/**
 * Create a registration atomically.
 *
 * The transaction re-reads the event inside the lock, so capacity can never be
 * oversold by two people tapping Register at the same moment, and the stored
 * `price` is copied from the event document — a client-supplied price is never
 * trusted (security rules re-check the same thing server side).
 *
 * Paid events are written as `pending_payment` and are *not* confirmed until a
 * payment provider reports success; free events confirm immediately.
 */
export async function registerForEvent(input: RegistrationInput): Promise<RegistrationResult> {
  const registrationId = registrationIdFor(input.eventId, input.userId)
  const registrationRef = doc(db, COLLECTIONS.registrations, registrationId)
  const eventRef = doc(db, COLLECTIONS.events, input.eventId)
  const userRef = doc(db, COLLECTIONS.users, input.userId)

  return runTransaction(db, async (transaction) => {
    const [eventSnapshot, existingSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(registrationRef),
    ])

    if (!eventSnapshot.exists()) throw new RegistrationError('event-missing', 'This event no longer exists.')
    const event = eventSnapshot.data() as CrewEvent

    if (event.status === 'cancelled')
      throw new RegistrationError('event-cancelled', 'This event has been cancelled.')
    if (event.status !== 'open')
      throw new RegistrationError('event-closed', 'Registration is closed for this event.')
    if (event.date < todayISO())
      throw new RegistrationError('event-past', 'This event has already happened.')

    const existing = existingSnapshot.exists() ? mapRegistration(existingSnapshot) : null
    const isReactivation = existing !== null && existing.registrationStatus === 'cancelled'
    if (existing && !isReactivation)
      throw new RegistrationError('already-registered', 'You are already registered for this event.')

    const registeredCount = event.registeredCount ?? 0
    if (registeredCount >= event.capacity)
      throw new RegistrationError('sold-out', 'This event is currently full.')

    // The event decides what roles are allowed; never trust the form alone.
    const allowed = event.eventTypes ?? ['both']
    const participationType: ParticipationType = allowed.includes('both')
      ? input.participationType
      : (allowed[0] as ParticipationType)

    const isFree = (event.price ?? 0) <= 0
    const registrationStatus: RegistrationStatus = isFree ? 'confirmed' : 'pending_payment'
    const paymentStatus: PaymentStatus = isFree ? 'not_required' : 'pending'

    // A re-activated registration keeps its code but gets a fresh QR token, so
    // any screenshot of the cancelled ticket stops working.
    const registrationCode = existing?.registrationCode || generateRegistrationCode()
    const qrToken = generateQrToken()

    transaction.set(registrationRef, {
      registrationCode,
      eventId: input.eventId,
      eventTitle: event.title,
      eventDate: event.date,
      eventStartTime: event.startTime,
      eventVenue: event.venue,
      // An image saved inside the event document is a data URL of a few
      // hundred KB; copying it into every registration would bloat the
      // "my events" listing. The ticket falls back to its branded header.
      eventImageURL: isInlineImage(event.imagePath) ? '' : (event.imageURL ?? ''),
      userId: input.userId,
      name: sanitiseText(input.name, 80),
      email: input.email.trim().toLowerCase(),
      phone: normalisePhone(input.phone),
      participationType,
      price: event.price ?? 0,
      currency: event.currency ?? 'INR',
      paymentStatus,
      registrationStatus,
      qrToken,
      attendanceStatus: 'not_checked_in',
      registeredAt: serverTimestamp(),
      checkInTime: null,
      checkedInBy: '',
      cancelledAt: null,
      cancelledReason: '',
      updatedAt: serverTimestamp(),
    })

    // Seats are held for pending payments too, otherwise a paid event oversells
    // while people are in the payment flow.
    transaction.update(eventRef, {
      registeredCount: increment(1),
      participantCount: increment(participationType === 'participant' ? 1 : 0),
      audienceCount: increment(participationType === 'audience' ? 1 : 0),
      updatedAt: serverTimestamp(),
    })

    transaction.set(userRef, { eventsRegistered: increment(1) }, { merge: true })

    return { registrationId, registrationCode, qrToken, status: registrationStatus, paymentStatus }
  })
}

/**
 * Mark a pending-payment registration as paid. Kept here so a payment provider
 * can be wired in later by calling this from a verified server webhook — the
 * client never gets to flip `paid` under the security rules.
 */
export async function confirmPaidRegistration(registrationId: string): Promise<void> {
  const { updateDoc } = await import('firebase/firestore')
  await updateDoc(doc(db, COLLECTIONS.registrations, registrationId), {
    paymentStatus: 'paid',
    registrationStatus: 'confirmed',
    updatedAt: serverTimestamp(),
  })
}

export async function cancelRegistration(registrationId: string, reason = ''): Promise<void> {
  const registrationRef = doc(db, COLLECTIONS.registrations, registrationId)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(registrationRef)
    if (!snapshot.exists()) throw new RegistrationError('not-found', 'Registration not found.')
    const registration = mapRegistration(snapshot)
    if (!registration) throw new RegistrationError('not-found', 'Registration not found.')
    if (registration.registrationStatus === 'cancelled') return
    if (registration.attendanceStatus === 'checked_in')
      throw new RegistrationError('checked-in', 'You have already been checked in to this event.')

    const eventRef = doc(db, COLLECTIONS.events, registration.eventId)
    const eventSnapshot = await transaction.get(eventRef)

    transaction.update(registrationRef, {
      registrationStatus: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledReason: sanitiseText(reason, 300),
      // Retire the QR so a cancelled ticket cannot be scanned in.
      qrToken: `revoked-${registration.id}`,
      updatedAt: serverTimestamp(),
    })

    if (eventSnapshot.exists()) {
      transaction.update(eventRef, {
        registeredCount: increment(-1),
        participantCount: increment(registration.participationType === 'participant' ? -1 : 0),
        audienceCount: increment(registration.participationType === 'audience' ? -1 : 0),
        updatedAt: serverTimestamp(),
      })
    }

    transaction.set(
      doc(db, COLLECTIONS.users, registration.userId),
      { eventsRegistered: increment(-1) },
      { merge: true },
    )
  })
}

/* --------------------------------- Reading -------------------------------- */

export async function getRegistration(registrationId: string): Promise<Registration | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.registrations, registrationId))
  return snapshot.exists() ? mapRegistration(snapshot) : null
}

export async function getUserRegistrationForEvent(
  eventId: string,
  uid: string,
): Promise<Registration | null> {
  return getRegistration(registrationIdFor(eventId, uid))
}

export function subscribeToUserRegistrations(
  uid: string,
  onChange: (registrations: Registration[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.registrations),
      where('userId', '==', uid),
      orderBy('eventDate', 'desc'),
    ),
    (snapshot) =>
      onChange(
        snapshot.docs
          .map((entry) => mapRegistration(entry))
          .filter((entry): entry is Registration => !!entry),
      ),
    (error) => onError?.(error),
  )
}

export interface RegistrationPage {
  registrations: Registration[]
  cursor: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}

export async function listEventRegistrations(options: {
  eventId: string
  pageSize: number
  cursor?: QueryDocumentSnapshot<DocumentData> | null
  status?: RegistrationStatus | 'all'
}): Promise<RegistrationPage> {
  const { eventId, pageSize, cursor, status = 'all' } = options
  const constraints: QueryConstraint[] = [where('eventId', '==', eventId)]
  if (status !== 'all') constraints.push(where('registrationStatus', '==', status))
  constraints.push(orderBy('registeredAt', 'desc'))
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(fsLimit(pageSize + 1))

  const snapshot = await getDocs(query(collection(db, COLLECTIONS.registrations), ...constraints))
  const docs = snapshot.docs.slice(0, pageSize)
  return {
    registrations: docs
      .map((entry) => mapRegistration(entry))
      .filter((entry): entry is Registration => !!entry),
    cursor: docs.at(-1) ?? null,
    hasMore: snapshot.docs.length > pageSize,
  }
}

/** Every registration for an event — used only by CSV export. */
export async function getAllEventRegistrations(eventId: string): Promise<Registration[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.registrations),
      where('eventId', '==', eventId),
      orderBy('registeredAt', 'desc'),
    ),
  )
  return snapshot.docs
    .map((entry) => mapRegistration(entry))
    .filter((entry): entry is Registration => !!entry)
}

export async function countRegistrations(constraints: QueryConstraint[] = []): Promise<number> {
  const snapshot = await getCountFromServer(
    query(collection(db, COLLECTIONS.registrations), ...constraints),
  )
  return snapshot.data().count
}

/* --------------------------------- Check-in ------------------------------- */

export type CheckInOutcome =
  | { result: 'valid'; registration: Registration }
  | { result: 'already_checked_in'; registration: Registration }
  | {
      result: 'invalid'
      code: 'not_found' | 'wrong_event' | 'cancelled' | 'unpaid' | 'bad_token' | 'malformed'
      message: string
      /**
       * Identifying details, included only where the registration is genuine
       * and the organiser needs to help a real person standing in front of
       * them — a ticket for the wrong day, a cancellation, an unpaid seat.
       *
       * Deliberately omitted for `not_found`, `bad_token` and `malformed`:
       * those are either nothing at all or a forgery attempt, and a scanner
       * that echoes names back at unknown codes is an enumeration oracle.
       */
      registrationCode?: string
      name?: string
    }

/**
 * Verify a scanned ticket and check the attendee in, atomically.
 *
 * Deliberately terse on failure: an invalid scan never reveals who the ticket
 * belongs to or whether the registration exists at all under another event.
 */
export async function checkInByQr(
  payload: ParsedQrPayload,
  eventId: string,
  adminUid: string,
): Promise<CheckInOutcome> {
  const registrationRef = doc(db, COLLECTIONS.registrations, payload.registrationId)

  return runTransaction<CheckInOutcome>(db, async (transaction) => {
    const snapshot = await transaction.get(registrationRef)
    if (!snapshot.exists())
      return { result: 'invalid', code: 'not_found', message: 'Registration not found.' }

    const registration = mapRegistration(snapshot)
    if (!registration)
      return { result: 'invalid', code: 'not_found', message: 'Registration not found.' }

    if (registration.qrToken !== payload.qrToken)
      return { result: 'invalid', code: 'bad_token', message: 'This QR code is not valid.' }

    if (registration.eventId !== eventId)
      return {
        result: 'invalid',
        code: 'wrong_event',
        message: `This ticket is for "${registration.eventTitle}" on ${registration.eventDate}.`,
        registrationCode: registration.registrationCode,
        name: registration.name,
      }

    if (registration.registrationStatus === 'cancelled')
      return {
        result: 'invalid',
        code: 'cancelled',
        message: 'This registration was cancelled.',
        registrationCode: registration.registrationCode,
        name: registration.name,
      }

    if (registration.registrationStatus !== 'confirmed')
      return {
        result: 'invalid',
        code: 'unpaid',
        message: 'This registration is not confirmed yet.',
        registrationCode: registration.registrationCode,
        name: registration.name,
      }

    if (registration.attendanceStatus === 'checked_in')
      return { result: 'already_checked_in', registration }

    transaction.update(registrationRef, {
      attendanceStatus: 'checked_in',
      checkInTime: serverTimestamp(),
      checkedInBy: adminUid,
      updatedAt: serverTimestamp(),
    })
    transaction.update(doc(db, COLLECTIONS.events, registration.eventId), {
      checkedInCount: increment(1),
      updatedAt: serverTimestamp(),
    })
    transaction.set(
      doc(db, COLLECTIONS.users, registration.userId),
      { eventsAttended: increment(1) },
      { merge: true },
    )

    return {
      result: 'valid',
      registration: { ...registration, attendanceStatus: 'checked_in', checkedInBy: adminUid },
    }
  })
}

/** Manual check-in from the attendee table, for a phone with a dead battery. */
export async function manualCheckIn(registrationId: string, adminUid: string): Promise<CheckInOutcome> {
  const registration = await getRegistration(registrationId)
  if (!registration)
    return { result: 'invalid', code: 'not_found', message: 'Registration not found.' }
  return checkInByQr(
    { registrationId, qrToken: registration.qrToken },
    registration.eventId,
    adminUid,
  )
}

/** Undo an accidental check-in. */
export async function undoCheckIn(registrationId: string): Promise<void> {
  const registrationRef = doc(db, COLLECTIONS.registrations, registrationId)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(registrationRef)
    if (!snapshot.exists()) throw new RegistrationError('not-found', 'Registration not found.')
    const registration = mapRegistration(snapshot)
    if (!registration || registration.attendanceStatus !== 'checked_in') return

    transaction.update(registrationRef, {
      attendanceStatus: 'not_checked_in',
      checkInTime: null,
      checkedInBy: '',
      updatedAt: serverTimestamp(),
    })
    transaction.update(doc(db, COLLECTIONS.events, registration.eventId), {
      checkedInCount: increment(-1),
      updatedAt: serverTimestamp(),
    })
    transaction.set(
      doc(db, COLLECTIONS.users, registration.userId),
      { eventsAttended: increment(-1) },
      { merge: true },
    )
  })
}

/* --------------------------------- Waitlist ------------------------------- */

function mapWaitlistEntry(snapshot: QueryDocumentSnapshot<DocumentData>): WaitlistEntry {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    eventId: data.eventId ?? '',
    userId: data.userId ?? '',
    name: data.name ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    participationType: (data.participationType as ParticipationType) ?? 'participant',
    position: data.position ?? 0,
    status: data.status ?? 'waiting',
    createdAt: data.createdAt ?? null,
    promotedAt: data.promotedAt ?? null,
  }
}

export function waitlistIdFor(eventId: string, uid: string): string {
  return `${eventId}__${uid}`
}

export async function joinWaitlist(input: RegistrationInput): Promise<void> {
  const waitlistRef = doc(db, COLLECTIONS.waitlists, waitlistIdFor(input.eventId, input.userId))
  const eventRef = doc(db, COLLECTIONS.events, input.eventId)

  await runTransaction(db, async (transaction) => {
    const [eventSnapshot, existing] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(waitlistRef),
    ])
    if (!eventSnapshot.exists()) throw new RegistrationError('event-missing', 'This event no longer exists.')
    const event = eventSnapshot.data() as CrewEvent
    if (!event.waitlistEnabled)
      throw new RegistrationError('no-waitlist', 'This event does not have a waitlist.')
    if (existing.exists() && existing.data().status === 'waiting') return

    transaction.set(waitlistRef, {
      eventId: input.eventId,
      userId: input.userId,
      name: sanitiseText(input.name, 80),
      email: input.email.trim().toLowerCase(),
      phone: normalisePhone(input.phone),
      participationType: input.participationType,
      position: (event.waitlistCount ?? 0) + 1,
      status: 'waiting',
      createdAt: serverTimestamp(),
      promotedAt: null,
    })
    transaction.update(eventRef, { waitlistCount: increment(1), updatedAt: serverTimestamp() })
  })
}

export async function leaveWaitlist(eventId: string, uid: string): Promise<void> {
  const waitlistRef = doc(db, COLLECTIONS.waitlists, waitlistIdFor(eventId, uid))
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(waitlistRef)
    if (!snapshot.exists() || snapshot.data().status !== 'waiting') return
    transaction.update(waitlistRef, { status: 'left' })
    transaction.update(doc(db, COLLECTIONS.events, eventId), {
      waitlistCount: increment(-1),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function getWaitlistEntry(eventId: string, uid: string): Promise<WaitlistEntry | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.waitlists, waitlistIdFor(eventId, uid)))
  return snapshot.exists() ? mapWaitlistEntry(snapshot as QueryDocumentSnapshot<DocumentData>) : null
}

export async function listWaitlist(eventId: string, max = 100): Promise<WaitlistEntry[]> {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTIONS.waitlists),
      where('eventId', '==', eventId),
      where('status', '==', 'waiting'),
      orderBy('position', 'asc'),
      fsLimit(max),
    ),
  )
  return snapshot.docs.map(mapWaitlistEntry)
}

/**
 * Promote the next person on the waitlist into a real seat. Called by an admin
 * when a cancellation frees capacity.
 */
export async function promoteFromWaitlist(eventId: string): Promise<WaitlistEntry | null> {
  const waiting = await listWaitlist(eventId, 1)
  const next = waiting[0]
  if (!next) return null

  await registerForEvent({
    eventId,
    userId: next.userId,
    name: next.name,
    email: next.email,
    phone: next.phone,
    participationType: next.participationType,
  })

  const { updateDoc } = await import('firebase/firestore')
  await updateDoc(doc(db, COLLECTIONS.waitlists, next.id), {
    status: 'promoted',
    promotedAt: serverTimestamp(),
  })
  await updateDoc(doc(db, COLLECTIONS.events, eventId), {
    waitlistCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
  return next
}
