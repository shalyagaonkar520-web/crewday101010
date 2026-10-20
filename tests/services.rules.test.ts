/**
 * Real-client-code vs real-rules suite.
 *
 * tests/firestore.rules.test.ts proves the rules with hand-written writes.
 * This file proves that the writes the app *actually makes* (the
 * runTransaction / writeBatch calls in src/services) are accepted by the same
 * firestore.rules, and that the Firestore state they leave behind is right.
 *
 *   npx firebase emulators:exec --only firestore "npx vitest run --project rules"
 */

import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, serverTimestamp, type Firestore } from 'firebase/firestore'

// The services read `db` from '@/firebase/config'. Swap it for a getter over a
// mutable holder so each test picks the identity it runs as.
const holder = vi.hoisted(() => ({ db: undefined as unknown }))

vi.mock('@/firebase/config', () => ({
  get db() {
    return holder.db
  },
  firebaseApp: {},
  useEmulators: false,
  COLLECTIONS: {
    users: 'users',
    interests: 'interests',
    events: 'events',
    eventRequests: 'eventRequests',
    registrations: 'registrations',
    notifications: 'notifications',
    waitlists: 'waitlists',
    reports: 'reports',
    feedback: 'feedback',
    settings: 'settings',
    analytics: 'analytics',
  },
}))

import {
  cancelRegistration,
  checkInByQr,
  eraseContactDetails,
  joinWaitlist,
  leaveWaitlist,
  listWaitlist,
  promoteFromWaitlist,
  registerForEvent,
  registrationIdFor,
  undoCheckIn,
  waitlistIdFor,
  type RegistrationInput,
} from '@/services/registrationService'
import { anonymiseUserProfile } from '@/services/userService'
import { bumpInterestUsage } from '@/services/interestService'

let testEnv: RulesTestEnvironment

const MEMBER = 'member-uid'
const OTHER = 'other-uid'
const ADMIN = 'admin-uid'
const EVENT = 'event-1'

function baseUser(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    uid,
    name: 'Test Member',
    email: `${uid}@example.com`,
    phone: '9876543210',
    photoURL: '',
    city: 'Bengaluru',
    area: 'Koramangala',
    interests: ['Guitar'],
    participationType: 'participant',
    role: 'user',
    status: 'active',
    onboardingCompleted: true,
    notificationPrefs: { newEvents: true, reminders: true, registrationUpdates: true, push: false },
    privacyPrefs: { showProfileInCrew: true, showInterests: true },
    fcmTokens: [],
    eventsRegistered: 0,
    eventsAttended: 0,
    ...overrides,
  }
}

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Sunday Guitar Jam',
    description: 'Bring a guitar.',
    imageURL: '',
    imagePath: '',
    category: 'Music',
    date: '2030-09-22',
    startTime: '17:00',
    endTime: '',
    weekday: 0,
    isFree: true,
    searchTokens: ['guitar', 'jam'],
    venue: 'The Humming Tree',
    address: '12th Main',
    city: 'Bengaluru',
    area: 'Indiranagar',
    mapsURL: '',
    capacity: 2,
    price: 0,
    currency: 'INR',
    eventTypes: ['both'],
    status: 'open',
    featured: false,
    waitlistEnabled: true,
    tags: [],
    registeredCount: 0,
    participantCount: 0,
    audienceCount: 0,
    checkedInCount: 0,
    waitlistCount: 0,
    createdBy: ADMIN,
    ...overrides,
  }
}

const [emulatorHost, emulatorPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'crewday-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: emulatorHost,
      port: Number(emulatorPort),
    },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'users', MEMBER), baseUser(MEMBER))
    await setDoc(doc(db, 'users', OTHER), baseUser(OTHER))
    await setDoc(doc(db, 'users', ADMIN), baseUser(ADMIN, { role: 'admin' }))
    await setDoc(doc(db, 'events', EVENT), baseEvent())
  })
})

/** Run subsequent service calls as this user. */
function as(uid: string, claims?: Record<string, unknown>) {
  holder.db = testEnv.authenticatedContext(uid, claims).firestore()
}

/** Read any document bypassing rules, for assertions. */
async function read(path: string, id: string): Promise<Record<string, unknown> | undefined> {
  let data: Record<string, unknown> | undefined
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const snap = await getDoc(doc(context.firestore(), path, id))
    data = snap.exists() ? snap.data() : undefined
  })
  return data
}

async function seed(fn: (db: Firestore) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await fn(context.firestore() as unknown as Firestore)
  })
}

const eventCounts = async (eventId = EVENT) => {
  const e = (await read('events', eventId)) ?? {}
  return {
    registered: e.registeredCount,
    participant: e.participantCount,
    audience: e.audienceCount,
    waitlist: e.waitlistCount,
    checkedIn: e.checkedInCount,
  }
}

const input = (uid: string, overrides: Partial<RegistrationInput> = {}): RegistrationInput => ({
  eventId: EVENT,
  userId: uid,
  name: 'Test Member',
  email: `${uid}@example.com`,
  phone: '9876543210',
  participationType: 'participant',
  ...overrides,
})

const regId = (uid: string) => registrationIdFor(EVENT, uid)

describe('registerForEvent (real transaction vs rules)', () => {
  it('registers a participant and updates counters and the profile', async () => {
    as(MEMBER)
    const result = await registerForEvent(input(MEMBER))
    expect(result.status).toBe('confirmed')

    expect(await eventCounts()).toMatchObject({ registered: 1, participant: 1, audience: 0 })
    expect((await read('users', MEMBER))?.eventsRegistered).toBe(1)
    const reg = await read('registrations', regId(MEMBER))
    expect(reg).toMatchObject({ registrationStatus: 'confirmed', userId: MEMBER, participationType: 'participant' })
  })

  it('registers an audience member and counts the role correctly', async () => {
    as(MEMBER)
    await registerForEvent(input(MEMBER, { participationType: 'audience' }))
    expect(await eventCounts()).toMatchObject({ registered: 1, participant: 0, audience: 1 })
  })

  it('rejects a second registration as already-registered, leaving counts alone', async () => {
    as(MEMBER)
    await registerForEvent(input(MEMBER))
    await expect(registerForEvent(input(MEMBER))).rejects.toMatchObject({ code: 'already-registered' })
    expect(await eventCounts()).toMatchObject({ registered: 1, participant: 1 })
    expect((await read('users', MEMBER))?.eventsRegistered).toBe(1)
  })

  it('rejects when the event is sold out', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', EVENT), baseEvent({ registeredCount: 2, participantCount: 2 }))
    })
    as(MEMBER)
    await expect(registerForEvent(input(MEMBER))).rejects.toMatchObject({ code: 'sold-out' })
    expect(await read('registrations', regId(MEMBER))).toBeUndefined()
    expect(await eventCounts()).toMatchObject({ registered: 2 })
  })

  it('paid event: registers as pending_payment and still moves counters', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', EVENT), baseEvent({ price: 199, isFree: false }))
    })
    as(MEMBER)
    const result = await registerForEvent(input(MEMBER))
    expect(result.status).toBe('pending_payment')
    expect(result.paymentStatus).toBe('pending')
    expect(await read('registrations', regId(MEMBER))).toMatchObject({
      registrationStatus: 'pending_payment',
      paymentStatus: 'pending',
      price: 199,
    })
    expect(await eventCounts()).toMatchObject({ registered: 1, participant: 1 })
    expect((await read('users', MEMBER))?.eventsRegistered).toBe(1)
  })
})

describe('cancelRegistration (real transaction vs rules)', () => {
  it('cancels, decrements everything, revokes the QR; re-register works', async () => {
    as(MEMBER)
    await registerForEvent(input(MEMBER))

    await cancelRegistration(regId(MEMBER), 'plans changed')
    expect(await eventCounts()).toMatchObject({ registered: 0, participant: 0, audience: 0 })
    expect((await read('users', MEMBER))?.eventsRegistered).toBe(0)
    expect(await read('registrations', regId(MEMBER))).toMatchObject({
      registrationStatus: 'cancelled',
      qrToken: `revoked-${regId(MEMBER)}`,
    })

    const again = await registerForEvent(input(MEMBER, { participationType: 'audience' }))
    expect(again.status).toBe('confirmed')
    expect(await eventCounts()).toMatchObject({ registered: 1, participant: 0, audience: 1 })
    expect((await read('users', MEMBER))?.eventsRegistered).toBe(1)
    const reg = await read('registrations', regId(MEMBER))
    expect(reg).toMatchObject({ registrationStatus: 'confirmed' })
    expect(reg?.qrToken).not.toBe(`revoked-${regId(MEMBER)}`)
  })

  it('cancelling a paid pending_payment seat releases it', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', EVENT), baseEvent({ price: 199, isFree: false }))
    })
    as(MEMBER)
    await registerForEvent(input(MEMBER))
    await cancelRegistration(regId(MEMBER))
    expect(await eventCounts()).toMatchObject({ registered: 0, participant: 0 })
  })
})

describe('waitlist (real transactions vs rules)', () => {
  it('joins, leaves and rejoins with correct waitlistCount each time', async () => {
    as(MEMBER)
    await joinWaitlist(input(MEMBER))
    expect(await eventCounts()).toMatchObject({ waitlist: 1 })
    expect(await read('waitlists', waitlistIdFor(EVENT, MEMBER))).toMatchObject({ status: 'waiting', position: 1 })

    await leaveWaitlist(EVENT, MEMBER)
    expect(await eventCounts()).toMatchObject({ waitlist: 0 })
    expect(await read('waitlists', waitlistIdFor(EVENT, MEMBER))).toMatchObject({ status: 'left' })

    await joinWaitlist(input(MEMBER))
    expect(await eventCounts()).toMatchObject({ waitlist: 1 })
    expect(await read('waitlists', waitlistIdFor(EVENT, MEMBER))).toMatchObject({ status: 'waiting' })
  })

  it('joining twice is a no-op that does not double count', async () => {
    as(MEMBER)
    await joinWaitlist(input(MEMBER))
    await joinWaitlist(input(MEMBER))
    expect(await eventCounts()).toMatchObject({ waitlist: 1 })
  })

  it('admin can list the waiting entries', async () => {
    as(MEMBER)
    await joinWaitlist(input(MEMBER))
    as(ADMIN)
    const waiting = await listWaitlist(EVENT)
    expect(waiting.map((entry) => entry.userId)).toEqual([MEMBER])
  })

  it('admin promoteFromWaitlist registers the waitlisted member once a seat frees', async () => {
    // Fill the event (capacity 2) with two members, then waitlist a third.
    await seed(async (db) => {
      await setDoc(doc(db, 'users', 'third-uid'), baseUser('third-uid'))
    })
    as(MEMBER)
    await registerForEvent(input(MEMBER))
    as(OTHER)
    await registerForEvent(input(OTHER))
    as('third-uid')
    await joinWaitlist(input('third-uid'))
    expect(await eventCounts()).toMatchObject({ registered: 2, waitlist: 1 })

    as(MEMBER)
    await cancelRegistration(regId(MEMBER))
    expect(await eventCounts()).toMatchObject({ registered: 1 })

    as(ADMIN)
    const promoted = await promoteFromWaitlist(EVENT)
    expect(promoted?.userId).toBe('third-uid')

    expect(await read('registrations', regId('third-uid'))).toMatchObject({
      userId: 'third-uid',
      registrationStatus: 'confirmed',
    })
    expect(await read('waitlists', waitlistIdFor(EVENT, 'third-uid'))).toMatchObject({ status: 'promoted' })
    expect(await eventCounts()).toMatchObject({ registered: 2, participant: 2, waitlist: 0 })
    expect((await read('users', 'third-uid'))?.eventsRegistered).toBe(1)
  })

  it('promoteFromWaitlist with an empty waitlist returns null', async () => {
    as(ADMIN)
    expect(await promoteFromWaitlist(EVENT)).toBeNull()
  })
})

describe('check-in (real transactions vs rules)', () => {
  async function registered() {
    as(MEMBER)
    const result = await registerForEvent(input(MEMBER))
    return result
  }

  it('admin checks in by QR then undoes it', async () => {
    const { registrationId, qrToken } = await registered()

    as(ADMIN)
    const outcome = await checkInByQr({ registrationId, qrToken }, EVENT, ADMIN)
    expect(outcome.result).toBe('valid')
    expect(await read('registrations', registrationId)).toMatchObject({
      attendanceStatus: 'checked_in',
      checkedInBy: ADMIN,
    })
    expect(await eventCounts()).toMatchObject({ checkedIn: 1 })
    expect((await read('users', MEMBER))?.eventsAttended).toBe(1)

    await undoCheckIn(registrationId)
    expect(await read('registrations', registrationId)).toMatchObject({
      attendanceStatus: 'not_checked_in',
      checkedInBy: '',
    })
    expect(await eventCounts()).toMatchObject({ checkedIn: 0 })
    expect((await read('users', MEMBER))?.eventsAttended).toBe(0)
  })

  it('a member calling checkInByQr is rejected and nothing changes', async () => {
    const { registrationId, qrToken } = await registered()
    as(MEMBER)
    await expect(checkInByQr({ registrationId, qrToken }, EVENT, MEMBER)).rejects.toBeTruthy()
    expect(await read('registrations', registrationId)).toMatchObject({ attendanceStatus: 'not_checked_in' })
    expect(await eventCounts()).toMatchObject({ checkedIn: 0 })
    expect((await read('users', MEMBER))?.eventsAttended).toBe(0)
  })

  it('a member cannot undo a check-in either', async () => {
    const { registrationId, qrToken } = await registered()
    as(ADMIN)
    await checkInByQr({ registrationId, qrToken }, EVENT, ADMIN)
    as(MEMBER)
    await expect(undoCheckIn(registrationId)).rejects.toBeTruthy()
    expect(await read('registrations', registrationId)).toMatchObject({ attendanceStatus: 'checked_in' })
  })
})

describe('account deletion (real batches vs rules)', () => {
  it('erases only the caller contact details, then anonymises; deleted member cannot register', async () => {
    // Member holds a registration and a waitlist entry on another event; OTHER has their own.
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'event-2'), baseEvent({ registeredCount: 0 }))
    })
    as(MEMBER)
    await registerForEvent(input(MEMBER))
    await joinWaitlist(input(MEMBER, { eventId: 'event-2' }))
    as(OTHER)
    await registerForEvent(input(OTHER))
    await joinWaitlist(input(OTHER, { eventId: 'event-2' }))

    as(MEMBER)
    await eraseContactDetails(MEMBER)

    expect(await read('registrations', regId(MEMBER))).toMatchObject({ name: '', email: '', phone: '' })
    expect(await read('waitlists', waitlistIdFor('event-2', MEMBER))).toMatchObject({ name: '', email: '', phone: '' })
    const otherReg = await read('registrations', regId(OTHER))
    expect(otherReg?.email).toBe(`${OTHER}@example.com`)
    expect(otherReg?.name).toBe('Test Member')
    const otherWait = await read('waitlists', waitlistIdFor('event-2', OTHER))
    expect(otherWait?.email).toBe(`${OTHER}@example.com`)
    // The seat itself stays so organiser counts remain accurate.
    expect(await read('registrations', regId(MEMBER))).toMatchObject({ registrationStatus: 'confirmed' })

    await anonymiseUserProfile(MEMBER)
    expect(await read('users', MEMBER)).toMatchObject({
      status: 'deleted',
      name: 'Deleted user',
      email: '',
      phone: '',
    })

    // A deleted profile can no longer take a seat.
    as(MEMBER)
    await expect(
      registerForEvent(input(MEMBER, { eventId: 'event-2' })),
    ).rejects.toBeTruthy()
    expect(await read('registrations', registrationIdFor('event-2', MEMBER))).toBeUndefined()
  })

  it('a member cannot erase someone else contact details through the service', async () => {
    as(OTHER)
    await registerForEvent(input(OTHER))
    as(MEMBER)
    // MEMBER's own query returns nothing for OTHER, so this is a no-op, not a leak.
    await eraseContactDetails(MEMBER)
    expect((await read('registrations', regId(OTHER)))?.email).toBe(`${OTHER}@example.com`)
  })

  it('anonymiseUserProfile succeeds for an admin acting on another member', async () => {
    as(ADMIN)
    await anonymiseUserProfile(MEMBER)
    expect(await read('users', MEMBER)).toMatchObject({ status: 'deleted' })
  })
})

describe('bumpInterestUsage (real batch vs rules)', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'interests', 'guitar'), {
        name: 'Guitar',
        emoji: '🎸',
        category: 'Music',
        enabled: true,
        custom: false,
        usageCount: 3,
        createdAt: serverTimestamp(),
        createdBy: ADMIN,
      })
    })
  })

  it('+1 then -1 succeed for a member', async () => {
    as(MEMBER)
    await bumpInterestUsage(['guitar'], 1)
    expect((await read('interests', 'guitar'))?.usageCount).toBe(4)
    await bumpInterestUsage(['guitar'], -1)
    expect((await read('interests', 'guitar'))?.usageCount).toBe(3)
  })

  it('a large delta is rejected', async () => {
    as(MEMBER)
    await expect(bumpInterestUsage(['guitar'], 5)).rejects.toBeTruthy()
    expect((await read('interests', 'guitar'))?.usageCount).toBe(3)
  })
})
