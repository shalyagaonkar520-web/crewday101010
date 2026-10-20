/**
 * Security-rules test suite.
 *
 * These run against the Firestore emulator and are the real proof that the
 * claims in the README hold: no self-promotion to admin, no client-set price,
 * no client-set attendance, no oversold events, no cross-user reads.
 *
 *   npx firebase emulators:exec --only firestore "npx vitest run"
 */

import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

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

function baseRegistration(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    registrationCode: 'CD-2030-ABC123',
    eventId: EVENT,
    eventTitle: 'Sunday Guitar Jam',
    eventDate: '2030-09-22',
    eventStartTime: '17:00',
    eventVenue: 'The Humming Tree',
    eventImageURL: '',
    userId: uid,
    name: 'Test Member',
    email: 'member@example.com',
    phone: '9876543210',
    participationType: 'participant',
    price: 0,
    currency: 'INR',
    paymentStatus: 'not_required',
    registrationStatus: 'confirmed',
    qrToken: 'CDREG-TESTTOKEN',
    attendanceStatus: 'not_checked_in',
    registeredAt: serverTimestamp(),
    checkInTime: null,
    checkedInBy: '',
    cancelledAt: null,
    cancelledReason: '',
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

function baseRequest(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    title: 'Sunday Acoustic Jam',
    description: 'An open circle for anyone who plays.',
    category: 'Music',
    date: '2030-09-22',
    startTime: '17:00',
    endTime: '',
    venue: 'The Hive',
    address: 'Electronic City Phase 1',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 20,
    price: 0,
    currency: 'INR',
    eventTypes: ['both'],
    requestedBy: uid,
    requesterName: 'Test Member',
    requesterEmail: 'member@example.com',
    requesterPhone: '9876543210',
    status: 'pending',
    reviewNote: '',
    reviewedBy: '',
    reviewedAt: null,
    createdEventId: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

const requestId = 'request-1'

const registrationId = `${EVENT}__${MEMBER}`

// `firebase emulators:exec` exports FIRESTORE_EMULATOR_HOST, so the suite follows
// whichever port the emulator actually got; 8080 is only the default.
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
    await setDoc(doc(db, 'events', 'draft-1'), baseEvent({ status: 'draft' }))
  })
})

const asMember = () => testEnv.authenticatedContext(MEMBER).firestore()
const asOther = () => testEnv.authenticatedContext(OTHER).firestore()
const asAdmin = () => testEnv.authenticatedContext(ADMIN).firestore()
const asGuest = () => testEnv.unauthenticatedContext().firestore()
// An *anonymous* Firebase session — signed in, but with no email or provider.
const ANON = 'anon-uid'
const asAnon = () =>
  testEnv.authenticatedContext(ANON, { firebase: { sign_in_provider: 'anonymous' } }).firestore()

/* -------------------------------------------------------------------------- */

describe('users', () => {
  it('lets a member read their own profile', async () => {
    await assertSucceeds(getDoc(doc(asMember(), 'users', MEMBER)))
  })

  it('blocks reading someone else profile', async () => {
    await assertFails(getDoc(doc(asMember(), 'users', OTHER)))
  })

  it('lets an admin read any profile', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'users', MEMBER)))
  })

  it('blocks self-promotion to admin', async () => {
    await assertFails(updateDoc(doc(asMember(), 'users', MEMBER), { role: 'admin' }))
  })

  it('blocks a member un-suspending themselves', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', MEMBER), { status: 'suspended' })
    })
    await assertFails(updateDoc(doc(asMember(), 'users', MEMBER), { status: 'active' }))
  })

  it('allows ordinary profile edits', async () => {
    await assertSucceeds(updateDoc(doc(asMember(), 'users', MEMBER), { city: 'Pune' }))
  })

  // The registration transaction bumps this with a merge-set; if rules
  // rejected it the whole registration would roll back.
  it('lets a member bump their own event counters', async () => {
    await assertSucceeds(
      setDoc(
        doc(asMember(), 'users', MEMBER),
        { eventsRegistered: 1 },
        { merge: true },
      ),
    )
  })

  it('blocks a member bumping someone else counters', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'users', OTHER), { eventsAttended: 99 }, { merge: true }),
    )
  })

  it('lets an admin record attendance on a member profile', async () => {
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'users', MEMBER), { eventsAttended: 1 }, { merge: true }),
    )
  })

  it('lets an admin grant organiser access', async () => {
    await assertSucceeds(updateDoc(doc(asAdmin(), 'users', MEMBER), { role: 'admin' }))
  })

  it('rejects a sign-up that asks for the admin role', async () => {
    const db = testEnv.authenticatedContext('fresh-uid').firestore()
    await assertFails(
      setDoc(doc(db, 'users', 'fresh-uid'), baseUser('fresh-uid', { role: 'admin', onboardingCompleted: false })),
    )
  })

  it('allows a normal sign-up', async () => {
    const db = testEnv.authenticatedContext('fresh-uid').firestore()
    await assertSucceeds(
      setDoc(doc(db, 'users', 'fresh-uid'), baseUser('fresh-uid', { onboardingCompleted: false })),
    )
  })
})

describe('events', () => {
  it('lets a signed-out visitor read a published event', async () => {
    await assertSucceeds(getDoc(doc(asGuest(), 'events', EVENT)))
  })

  it('hides drafts from members', async () => {
    await assertFails(getDoc(doc(asMember(), 'events', 'draft-1')))
  })

  it('shows drafts to admins', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'events', 'draft-1')))
  })

  it('blocks a member from editing the price', async () => {
    await assertFails(updateDoc(doc(asMember(), 'events', EVENT), { price: 0, capacity: 999 }))
  })

  it('blocks a member from creating an event', async () => {
    await assertFails(setDoc(doc(asMember(), 'events', 'sneaky'), baseEvent()))
  })

  it('lets an admin create an event', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'events', 'admin-made'), baseEvent()))
  })

  it('blocks a member nudging the counter without a registration behind it', async () => {
    // The hole this closes: any member could move registeredCount by one,
    // repeatedly, with no seat to show for it.
    await assertFails(
      updateDoc(doc(asMember(), 'events', EVENT), {
        registeredCount: 1,
        participantCount: 1,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('blocks a counter jump larger than one', async () => {
    await assertFails(updateDoc(doc(asMember(), 'events', EVENT), { registeredCount: 5 }))
  })

  it('blocks a counter update that exceeds capacity', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'events', EVENT), { registeredCount: 2 })
    })
    // capacity is 2, so going to 3 must fail even though the delta is +1
    await assertFails(updateDoc(doc(asMember(), 'events', EVENT), { registeredCount: 3 }))
  })

  it('blocks smuggling another field alongside a counter update', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'events', EVENT), { registeredCount: 1, capacity: 500 }),
    )
  })

  it('blocks a member from changing check-in counts', async () => {
    await assertFails(updateDoc(doc(asMember(), 'events', EVENT), { checkedInCount: 1 }))
  })
})

describe('registrations', () => {
  it('lets a member register for a free open event', async () => {
    await assertSucceeds(
      setDoc(doc(asMember(), 'registrations', registrationId), baseRegistration(MEMBER)),
    )
  })

  it('rejects a registration whose price does not match the event', async () => {
    await assertFails(
      setDoc(
        doc(asMember(), 'registrations', registrationId),
        baseRegistration(MEMBER, { price: 999 }),
      ),
    )
  })

  it('rejects confirming a paid registration from the client', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'events', EVENT), { price: 199, isFree: false })
    })
    await assertFails(
      setDoc(
        doc(asMember(), 'registrations', registrationId),
        baseRegistration(MEMBER, {
          price: 199,
          registrationStatus: 'confirmed',
          paymentStatus: 'paid',
        }),
      ),
    )
  })

  it('accepts a paid registration as pending_payment', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'events', EVENT), { price: 199, isFree: false })
    })
    await assertSucceeds(
      setDoc(
        doc(asMember(), 'registrations', registrationId),
        baseRegistration(MEMBER, {
          price: 199,
          registrationStatus: 'pending_payment',
          paymentStatus: 'pending',
        }),
      ),
    )
  })

  it('rejects a registration that pre-marks itself checked in', async () => {
    await assertFails(
      setDoc(
        doc(asMember(), 'registrations', registrationId),
        baseRegistration(MEMBER, { attendanceStatus: 'checked_in' }),
      ),
    )
  })

  it('rejects registering on behalf of somebody else', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'registrations', `${EVENT}__${OTHER}`), baseRegistration(OTHER)),
    )
  })

  it('rejects a registration id that does not match the owner', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'registrations', 'freeform-id'), baseRegistration(MEMBER)),
    )
  })

  it('rejects registering for a closed event', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'events', EVENT), { status: 'closed' })
    })
    await assertFails(
      setDoc(doc(asMember(), 'registrations', registrationId), baseRegistration(MEMBER)),
    )
  })

  it('rejects registering for a full event', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'events', EVENT), { registeredCount: 2 })
    })
    await assertFails(
      setDoc(doc(asMember(), 'registrations', registrationId), baseRegistration(MEMBER)),
    )
  })

  it('rejects a suspended member registering', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', MEMBER), { status: 'suspended' })
    })
    await assertFails(
      setDoc(doc(asMember(), 'registrations', registrationId), baseRegistration(MEMBER)),
    )
  })

  // The Register page fetches "have I already registered?" before the doc
  // exists. If rules deny a get on a missing document, that lookup throws and
  // the page reports "Event not found".
  it('lets a member check their own not-yet-created registration', async () => {
    await assertSucceeds(getDoc(doc(asMember(), 'registrations', registrationId)))
  })

  it("blocks probing someone else's not-yet-created registration", async () => {
    await assertFails(getDoc(doc(asMember(), 'registrations', `${EVENT}__${OTHER}`)))
  })

  it('lets a member check their own missing waitlist entry', async () => {
    await assertSucceeds(getDoc(doc(asMember(), 'waitlists', `${EVENT}__${MEMBER}`)))
  })

  it('lets a member check their own missing feedback', async () => {
    await assertSucceeds(getDoc(doc(asMember(), 'feedback', `${EVENT}__${MEMBER}`)))
  })

  describe('with an existing registration', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(
          doc(context.firestore(), 'registrations', registrationId),
          baseRegistration(MEMBER),
        )
      })
    })

    it('lets the owner read it', async () => {
      await assertSucceeds(getDoc(doc(asMember(), 'registrations', registrationId)))
    })

    it('blocks another member from reading it', async () => {
      await assertFails(getDoc(doc(asOther(), 'registrations', registrationId)))
    })

    it('lets an admin read it', async () => {
      await assertSucceeds(getDoc(doc(asAdmin(), 'registrations', registrationId)))
    })

    it('lets the owner cancel', async () => {
      await assertSucceeds(
        updateDoc(doc(asMember(), 'registrations', registrationId), {
          registrationStatus: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelledReason: 'Cannot make it',
          qrToken: `revoked-${registrationId}`,
          updatedAt: serverTimestamp(),
        }),
      )
    })

    it('blocks the owner from checking themselves in', async () => {
      await assertFails(
        updateDoc(doc(asMember(), 'registrations', registrationId), {
          attendanceStatus: 'checked_in',
          checkInTime: serverTimestamp(),
        }),
      )
    })

    it('blocks the owner from marking a paid registration as paid', async () => {
      await assertFails(
        updateDoc(doc(asMember(), 'registrations', registrationId), { paymentStatus: 'paid' }),
      )
    })

    it('lets an admin check the attendee in', async () => {
      await assertSucceeds(
        updateDoc(doc(asAdmin(), 'registrations', registrationId), {
          attendanceStatus: 'checked_in',
          checkInTime: serverTimestamp(),
          checkedInBy: ADMIN,
        }),
      )
    })

    it('blocks cancelling after check-in', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'registrations', registrationId), {
          attendanceStatus: 'checked_in',
        })
      })
      await assertFails(
        updateDoc(doc(asMember(), 'registrations', registrationId), {
          registrationStatus: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancelledReason: '',
          qrToken: 'revoked',
          updatedAt: serverTimestamp(),
        }),
      )
    })

    it('blocks another member from tampering with it', async () => {
      await assertFails(
        updateDoc(doc(asOther(), 'registrations', registrationId), {
          registrationStatus: 'cancelled',
        }),
      )
    })

    it('blocks a member from deleting it', async () => {
      await assertFails(deleteDoc(doc(asMember(), 'registrations', registrationId)))
    })

    it('lets the owner re-register after cancelling', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'registrations', registrationId), {
          registrationStatus: 'cancelled',
          qrToken: `revoked-${registrationId}`,
        })
      })
      await assertSucceeds(
        setDoc(
          doc(asMember(), 'registrations', registrationId),
          baseRegistration(MEMBER, { qrToken: 'CDREG-FRESHTOKEN' }),
        ),
      )
    })

    it('blocks re-registering with attendance pre-set', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), 'registrations', registrationId), {
          registrationStatus: 'cancelled',
        })
      })
      await assertFails(
        setDoc(
          doc(asMember(), 'registrations', registrationId),
          baseRegistration(MEMBER, { attendanceStatus: 'checked_in' }),
        ),
      )
    })
  })
})

describe('waitlist', () => {
  const waitlistId = `${EVENT}__${MEMBER}`

  it('lets a member join the waitlist for themselves', async () => {
    await assertSucceeds(
      setDoc(doc(asMember(), 'waitlists', waitlistId), {
        eventId: EVENT,
        userId: MEMBER,
        name: 'Test Member',
        email: 'member@example.com',
        phone: '9876543210',
        participationType: 'participant',
        position: 1,
        status: 'waiting',
        createdAt: serverTimestamp(),
        promotedAt: null,
      }),
    )
  })

  it('blocks joining the waitlist as someone else', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'waitlists', `${EVENT}__${OTHER}`), {
        eventId: EVENT,
        userId: OTHER,
        name: 'Someone else',
        email: 'other@example.com',
        phone: '9876543210',
        participationType: 'participant',
        position: 1,
        status: 'waiting',
        createdAt: serverTimestamp(),
        promotedAt: null,
      }),
    )
  })

  it('blocks a member from promoting themselves off the waitlist', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'waitlists', waitlistId), {
        eventId: EVENT,
        userId: MEMBER,
        name: 'Test Member',
        email: 'member@example.com',
        phone: '9876543210',
        participationType: 'participant',
        position: 1,
        status: 'waiting',
        createdAt: serverTimestamp(),
        promotedAt: null,
      })
    })
    await assertFails(updateDoc(doc(asMember(), 'waitlists', waitlistId), { status: 'promoted' }))
    await assertSucceeds(updateDoc(doc(asMember(), 'waitlists', waitlistId), { status: 'left' }))
  })
})

describe('notifications', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notifications', 'n1'), {
        userId: MEMBER,
        type: 'registration_confirmed',
        title: 'You are in',
        body: 'See you Sunday',
        eventId: EVENT,
        read: false,
        createdAt: serverTimestamp(),
      })
    })
  })

  it('lets the recipient read it', async () => {
    await assertSucceeds(getDoc(doc(asMember(), 'notifications', 'n1')))
  })

  it('blocks another member from reading it', async () => {
    await assertFails(getDoc(doc(asOther(), 'notifications', 'n1')))
  })

  it('lets the recipient mark it read', async () => {
    await assertSucceeds(updateDoc(doc(asMember(), 'notifications', 'n1'), { read: true }))
  })

  it('blocks rewriting the notification body', async () => {
    await assertFails(updateDoc(doc(asMember(), 'notifications', 'n1'), { title: 'Hacked' }))
  })

  it('blocks a member from notifying someone else', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'notifications', 'n2'), {
        userId: OTHER,
        type: 'system',
        title: 'Spam',
        body: 'Spam',
        eventId: '',
        read: false,
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('lets an admin notify anyone', async () => {
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'notifications', 'n3'), {
        userId: MEMBER,
        type: 'event_cancelled',
        title: 'Event cancelled',
        body: 'Sorry',
        eventId: EVENT,
        read: false,
        createdAt: serverTimestamp(),
      }),
    )
  })
})

describe('interests', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'interests', 'guitar'), {
        name: 'Guitar',
        emoji: '🎸',
        category: 'Music',
        enabled: true,
        custom: false,
        usageCount: 3,
        createdBy: ADMIN,
      })
    })
  })

  it('is publicly readable so onboarding works', async () => {
    await assertSucceeds(getDoc(doc(asGuest(), 'interests', 'guitar')))
  })

  it('lets a member add a custom interest', async () => {
    await assertSucceeds(
      setDoc(doc(asMember(), 'interests', 'pottery'), {
        name: 'Pottery',
        emoji: '🏺',
        category: '',
        enabled: true,
        custom: true,
        usageCount: 0,
        createdBy: MEMBER,
      }),
    )
  })

  it('blocks a member from renaming an existing interest', async () => {
    await assertFails(updateDoc(doc(asMember(), 'interests', 'guitar'), { name: 'Banjo' }))
  })

  it('lets a member bump the usage counter', async () => {
    await assertSucceeds(updateDoc(doc(asMember(), 'interests', 'guitar'), { usageCount: 4 }))
  })

  it('blocks a member from deleting an interest', async () => {
    await assertFails(deleteDoc(doc(asMember(), 'interests', 'guitar')))
  })
})

describe('reports and feedback', () => {
  it('lets a member file a report', async () => {
    await assertSucceeds(
      setDoc(doc(asMember(), 'reports', 'r1'), {
        userId: MEMBER,
        email: 'member@example.com',
        subject: 'QR not loading',
        message: 'It spins forever',
        status: 'open',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('blocks a member from reading the report queue', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'reports', 'r2'), {
        userId: OTHER,
        email: 'other@example.com',
        subject: 'x',
        message: 'y',
        status: 'open',
        createdAt: serverTimestamp(),
      })
    })
    await assertFails(getDoc(doc(asMember(), 'reports', 'r2')))
  })

  it('lets a member rate an event once', async () => {
    await assertSucceeds(
      setDoc(doc(asMember(), 'feedback', `${EVENT}__${MEMBER}`), {
        eventId: EVENT,
        userId: MEMBER,
        rating: 5,
        comment: 'Great jam',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('blocks feedback filed under another member id', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'feedback', `${EVENT}__${OTHER}`), {
        eventId: EVENT,
        userId: OTHER,
        rating: 1,
        comment: 'Sabotage',
        createdAt: serverTimestamp(),
      }),
    )
  })
})

describe('event requests', () => {
  it('lets a member submit a proposal', async () => {
    await assertSucceeds(
      setDoc(doc(asMember(), 'eventRequests', requestId), baseRequest(MEMBER)),
    )
  })

  it('blocks submitting a pre-approved proposal', async () => {
    await assertFails(
      setDoc(
        doc(asMember(), 'eventRequests', requestId),
        baseRequest(MEMBER, { status: 'approved' }),
      ),
    )
  })

  it('blocks a proposal that points at an existing event', async () => {
    await assertFails(
      setDoc(
        doc(asMember(), 'eventRequests', requestId),
        baseRequest(MEMBER, { createdEventId: EVENT }),
      ),
    )
  })

  it('blocks submitting on behalf of someone else', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'eventRequests', requestId), baseRequest(OTHER)),
    )
  })

  it('blocks a suspended member from submitting', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', MEMBER), { status: 'suspended' })
    })
    await assertFails(
      setDoc(doc(asMember(), 'eventRequests', requestId), baseRequest(MEMBER)),
    )
  })

  describe('with a pending proposal', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'eventRequests', requestId), baseRequest(MEMBER))
      })
    })

    it('lets the requester read their own', async () => {
      await assertSucceeds(getDoc(doc(asMember(), 'eventRequests', requestId)))
    })

    it('blocks another member from reading it', async () => {
      await assertFails(getDoc(doc(asOther(), 'eventRequests', requestId)))
    })

    it('lets an admin read it', async () => {
      await assertSucceeds(getDoc(doc(asAdmin(), 'eventRequests', requestId)))
    })

    it('lets the requester withdraw it', async () => {
      await assertSucceeds(
        updateDoc(doc(asMember(), 'eventRequests', requestId), {
          status: 'withdrawn',
          updatedAt: serverTimestamp(),
        }),
      )
    })

    it('blocks the requester approving their own proposal', async () => {
      await assertFails(
        updateDoc(doc(asMember(), 'eventRequests', requestId), {
          status: 'approved',
          updatedAt: serverTimestamp(),
        }),
      )
    })

    it('blocks the requester editing the proposal body', async () => {
      await assertFails(
        updateDoc(doc(asMember(), 'eventRequests', requestId), { price: 9999 }),
      )
    })

    it('lets an admin approve it', async () => {
      await assertSucceeds(
        updateDoc(doc(asAdmin(), 'eventRequests', requestId), {
          status: 'approved',
          reviewedBy: ADMIN,
          createdEventId: EVENT,
          reviewedAt: serverTimestamp(),
        }),
      )
    })

    it('blocks another member from touching it', async () => {
      await assertFails(
        updateDoc(doc(asOther(), 'eventRequests', requestId), { status: 'withdrawn' }),
      )
    })

    it('blocks a member from deleting it', async () => {
      await assertFails(deleteDoc(doc(asMember(), 'eventRequests', requestId)))
    })
  })
})

describe('guest (anonymous) accounts', () => {
  it('lets a guest create their own profile', async () => {
    await assertSucceeds(
      setDoc(
        doc(asAnon(), 'users', ANON),
        baseUser(ANON, { name: 'Guest', email: '', isGuest: true, onboardingCompleted: false }),
      ),
    )
  })

  describe('with a guest profile', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(
          doc(context.firestore(), 'users', ANON),
          baseUser(ANON, { name: 'Guest', email: '', isGuest: true }),
        )
      })
    })

    it('lets a guest register for an event', async () => {
      await assertSucceeds(
        setDoc(
          doc(asAnon(), 'registrations', `${EVENT}__${ANON}`),
          baseRegistration(ANON, { email: 'typed@example.com' }),
        ),
      )
    })

    it('lets a guest read their own ticket', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(
          doc(context.firestore(), 'registrations', `${EVENT}__${ANON}`),
          baseRegistration(ANON),
        )
      })
      await assertSucceeds(getDoc(doc(asAnon(), 'registrations', `${EVENT}__${ANON}`)))
    })

    it('blocks a guest from proposing an event', async () => {
      await assertFails(setDoc(doc(asAnon(), 'eventRequests', 'guest-req'), baseRequest(ANON)))
    })

    it('still lets a full member propose an event', async () => {
      await assertSucceeds(
        setDoc(doc(asMember(), 'eventRequests', 'member-req'), baseRequest(MEMBER)),
      )
    })
  })
})

describe('unknown collections', () => {
  it('denies everything not explicitly allowed', async () => {
    await assertFails(setDoc(doc(asMember(), 'secrets', 'x'), { a: 1 }))
    await assertFails(getDoc(doc(asAdmin(), 'secrets', 'x')))
  })
})

/* -------------------------------------------------------------------------- */
/*  Hardening: counters follow real registrations, plus related fixes          */
/* -------------------------------------------------------------------------- */

const waitlistKey = `${EVENT}__${MEMBER}`

const waitlistEntry = (uid: string, overrides: Record<string, unknown> = {}) => ({
  eventId: EVENT,
  userId: uid,
  name: 'Test Member',
  email: 'member@example.com',
  phone: '9876543210',
  participationType: 'participant',
  position: 1,
  status: 'waiting',
  createdAt: serverTimestamp(),
  promotedAt: null,
  ...overrides,
})

describe('event counters follow real registrations', () => {
  const regRef = (db: ReturnType<typeof asMember>) => doc(db, 'registrations', registrationId)
  const eventRef = (db: ReturnType<typeof asMember>) => doc(db, 'events', EVENT)

  async function seedRegistered() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'registrations', registrationId), baseRegistration(MEMBER))
      await updateDoc(doc(db, 'events', EVENT), { registeredCount: 1, participantCount: 1 })
    })
  }

  it('allows registering: the registration and the +1 land together', async () => {
    const db = asMember()
    const batch = writeBatch(db)
    batch.set(regRef(db), baseRegistration(MEMBER))
    batch.update(eventRef(db), {
      registeredCount: 1,
      participantCount: 1,
      audienceCount: 0,
      updatedAt: serverTimestamp(),
    })
    await assertSucceeds(batch.commit())
  })

  it('allows registering as audience and counts it as audience', async () => {
    const db = asMember()
    const batch = writeBatch(db)
    batch.set(regRef(db), baseRegistration(MEMBER, { participationType: 'audience' }))
    batch.update(eventRef(db), { registeredCount: 1, audienceCount: 1, updatedAt: serverTimestamp() })
    await assertSucceeds(batch.commit())
  })

  it('blocks counting a participant as audience', async () => {
    const db = asMember()
    const batch = writeBatch(db)
    batch.set(regRef(db), baseRegistration(MEMBER, { participationType: 'participant' }))
    batch.update(eventRef(db), { registeredCount: 1, audienceCount: 1, updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
  })

  it('blocks bumping the counter again once already registered', async () => {
    await seedRegistered()
    await assertFails(updateDoc(eventRef(asMember()), { registeredCount: 2, participantCount: 2 }))
  })

  it('blocks decrementing the counter without cancelling', async () => {
    await seedRegistered()
    await assertFails(updateDoc(eventRef(asMember()), { registeredCount: 0, participantCount: 0 }))
  })

  it('allows cancelling: the cancellation and the -1 land together', async () => {
    await seedRegistered()
    const db = asMember()
    const batch = writeBatch(db)
    batch.update(regRef(db), {
      registrationStatus: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledReason: 'Plans changed',
      qrToken: `revoked-${registrationId}`,
      updatedAt: serverTimestamp(),
    })
    batch.update(eventRef(db), { registeredCount: 0, participantCount: 0, updatedAt: serverTimestamp() })
    await assertSucceeds(batch.commit())
  })

  it('blocks a member from emptying an event they never registered for', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'events', EVENT), {
        registeredCount: 2,
        participantCount: 2,
      })
    })
    await assertFails(updateDoc(eventRef(asMember()), { registeredCount: 1, participantCount: 1 }))
  })

  it('allows joining the waitlist with the +1 landing together', async () => {
    const db = asMember()
    const batch = writeBatch(db)
    batch.set(doc(db, 'waitlists', waitlistKey), waitlistEntry(MEMBER))
    batch.update(eventRef(db), { waitlistCount: 1, updatedAt: serverTimestamp() })
    await assertSucceeds(batch.commit())
  })

  it('blocks bumping the waitlist counter with no waitlist entry', async () => {
    await assertFails(updateDoc(eventRef(asMember()), { waitlistCount: 1 }))
  })

  it('still lets an admin adjust every counter', async () => {
    await assertSucceeds(
      updateDoc(eventRef(asAdmin()), { registeredCount: 2, checkedInCount: 1, waitlistCount: 3 }),
    )
  })
})

describe('admin access comes from the role, not a hardcoded email', () => {
  const OWNER_CLAIMS = { email: 'shalyagaonkar@gmail.com', email_verified: true }

  it('does not treat a verified owner email as admin without the role', async () => {
    const db = testEnv.authenticatedContext('owner-uid', OWNER_CLAIMS).firestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'owner-uid'), baseUser('owner-uid'))
    })
    await assertFails(getDoc(doc(db, 'users', MEMBER)))
    await assertFails(setDoc(doc(db, 'events', 'sneaky'), baseEvent()))
  })

  it('does not let that email sign up directly as admin', async () => {
    const db = testEnv.authenticatedContext('owner-uid', OWNER_CLAIMS).firestore()
    await assertFails(
      setDoc(
        doc(db, 'users', 'owner-uid'),
        baseUser('owner-uid', { role: 'admin', onboardingCompleted: false }),
      ),
    )
  })

  it('still treats a profile with role admin as admin', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'users', MEMBER)))
  })
})

describe('profile counters and self-service deletion', () => {
  it('blocks a member from forging their own attendance count', async () => {
    await assertFails(setDoc(doc(asMember(), 'users', MEMBER), { eventsAttended: 99 }, { merge: true }))
  })

  it('blocks a member jumping their registered count', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'users', MEMBER), { eventsRegistered: 50 }, { merge: true }),
    )
  })

  it('blocks a negative registered count', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'users', MEMBER), { eventsRegistered: -1 }, { merge: true }),
    )
  })

  it('lets a member anonymise and mark their own profile deleted', async () => {
    await assertSucceeds(
      updateDoc(doc(asMember(), 'users', MEMBER), {
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
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('does not let a deleted profile come back to life', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', MEMBER), { status: 'deleted' })
    })
    await assertFails(updateDoc(doc(asMember(), 'users', MEMBER), { status: 'active' }))
  })

  it('does not let a member suspend themselves', async () => {
    await assertFails(updateDoc(doc(asMember(), 'users', MEMBER), { status: 'suspended' }))
  })
})

describe('organiser promotes someone off the waitlist', () => {
  it('lets an admin create a registration for a waitlisted member', async () => {
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'registrations', `${EVENT}__${OTHER}`), baseRegistration(OTHER)),
    )
  })

  it('still rejects an admin registration that disagrees with the event price', async () => {
    await assertFails(
      setDoc(
        doc(asAdmin(), 'registrations', `${EVENT}__${OTHER}`),
        baseRegistration(OTHER, { price: 500 }),
      ),
    )
  })

  it('rejects an admin registration whose id does not match the member', async () => {
    await assertFails(
      setDoc(doc(asAdmin(), 'registrations', `${EVENT}__${MEMBER}`), baseRegistration(OTHER)),
    )
  })

  it('rejects an admin registering a suspended member', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'users', OTHER), { status: 'suspended' })
    })
    await assertFails(
      setDoc(doc(asAdmin(), 'registrations', `${EVENT}__${OTHER}`), baseRegistration(OTHER)),
    )
  })

  it('does not extend that power to an ordinary member', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'registrations', `${EVENT}__${OTHER}`), baseRegistration(OTHER)),
    )
  })
})

describe('leaving and rejoining the waitlist', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'waitlists', waitlistKey),
        waitlistEntry(MEMBER, { status: 'left' }),
      )
    })
  })

  it('lets a member who left join again', async () => {
    await assertSucceeds(setDoc(doc(asMember(), 'waitlists', waitlistKey), waitlistEntry(MEMBER)))
  })

  it('does not let a member rejoin as somebody else', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'waitlists', waitlistKey), waitlistEntry(MEMBER, { userId: OTHER })),
    )
  })

  it('does not let a member jump straight to promoted', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'waitlists', waitlistKey), waitlistEntry(MEMBER, { status: 'promoted' })),
    )
  })
})

describe('erasing personal details from tickets and waitlist entries', () => {
  const scrub = () => ({ name: '', email: '', phone: '', updatedAt: serverTimestamp() })

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'registrations', registrationId), baseRegistration(MEMBER))
      await setDoc(doc(db, 'waitlists', waitlistKey), waitlistEntry(MEMBER))
    })
  })

  it('lets the owner blank the contact details on their registration', async () => {
    await assertSucceeds(updateDoc(doc(asMember(), 'registrations', registrationId), scrub()))
  })

  it('lets the owner blank the contact details on their waitlist entry', async () => {
    await assertSucceeds(
      updateDoc(doc(asMember(), 'waitlists', waitlistKey), { name: '', email: '', phone: '' }),
    )
  })

  it('does not let the owner swap in different contact details', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'registrations', registrationId), { name: 'Someone Else' }),
    )
  })

  it('does not let that blanking carry other changes with it', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'registrations', registrationId), {
        ...scrub(),
        attendanceStatus: 'checked_in',
      }),
    )
  })

  it("does not let a member blank somebody else's registration", async () => {
    await assertFails(updateDoc(doc(asOther(), 'registrations', registrationId), scrub()))
  })
})

describe('interest popularity counter', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'interests', 'guitar'), {
        name: 'Guitar',
        emoji: '🎸',
        category: 'Music',
        enabled: true,
        custom: false,
        usageCount: 5,
        createdBy: ADMIN,
      })
    })
  })

  it('lets a member move it by one either way', async () => {
    await assertSucceeds(updateDoc(doc(asMember(), 'interests', 'guitar'), { usageCount: 6 }))
    await assertSucceeds(updateDoc(doc(asMember(), 'interests', 'guitar'), { usageCount: 5 }))
  })

  it('blocks a member setting it to an arbitrary number', async () => {
    await assertFails(updateDoc(doc(asMember(), 'interests', 'guitar'), { usageCount: 99999 }))
  })

  it('blocks a negative count', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'interests', 'guitar'), { usageCount: 0 })
    })
    await assertFails(updateDoc(doc(asMember(), 'interests', 'guitar'), { usageCount: -1 }))
  })
})

describe('erasing personal details from event requests, reports and feedback', () => {
  const scrubRequest = () => ({
    requesterName: '',
    requesterEmail: '',
    requesterPhone: '',
    updatedAt: serverTimestamp(),
  })
  const reportDoc = (uid: string) => ({
    userId: uid,
    email: `${uid}@example.com`,
    subject: 'QR not loading',
    message: 'It spins forever',
    status: 'open',
    createdAt: serverTimestamp(),
  })

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'eventRequests', requestId), baseRequest(MEMBER))
      await setDoc(doc(db, 'eventRequests', 'request-other'), baseRequest(OTHER))
      await setDoc(doc(db, 'eventRequests', 'request-done'), baseRequest(MEMBER, { status: 'approved' }))
      await setDoc(doc(db, 'reports', 'rep-mine'), reportDoc(MEMBER))
      await setDoc(doc(db, 'reports', 'rep-other'), reportDoc(OTHER))
      await setDoc(doc(db, `feedback/${EVENT}__${MEMBER}`), {
        eventId: EVENT,
        userId: MEMBER,
        rating: 4,
        comment: 'Loved it, call me on 98765',
        createdAt: serverTimestamp(),
      })
    })
  })

  it('lets the owner blank the requester details on a pending request', async () => {
    await assertSucceeds(updateDoc(doc(asMember(), 'eventRequests', requestId), scrubRequest()))
  })

  it('lets the owner blank the requester details on a request that was already decided', async () => {
    await assertSucceeds(updateDoc(doc(asMember(), 'eventRequests', 'request-done'), scrubRequest()))
  })

  it('lets the owner find their own requests with a single equality filter', async () => {
    await assertSucceeds(
      getDocs(query(collection(asMember(), 'eventRequests'), where('requestedBy', '==', MEMBER))),
    )
  })

  it('does not let the owner swap in different requester details', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'eventRequests', requestId), { requesterName: 'Someone Else' }),
    )
  })

  it('does not let the owner blank only some of the requester fields', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'eventRequests', requestId), {
        requesterName: '',
        requesterEmail: '',
      }),
    )
  })

  it('does not let request erasure carry other changes with it', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'eventRequests', requestId), {
        ...scrubRequest(),
        status: 'approved',
      }),
    )
    await assertFails(
      updateDoc(doc(asMember(), 'eventRequests', requestId), { ...scrubRequest(), capacity: 9999 }),
    )
  })

  it("does not let a member blank somebody else's request", async () => {
    await assertFails(updateDoc(doc(asMember(), 'eventRequests', 'request-other'), scrubRequest()))
  })

  it('lets an admin blank the requester details on any request', async () => {
    await assertSucceeds(updateDoc(doc(asAdmin(), 'eventRequests', 'request-other'), scrubRequest()))
  })

  it('lets the owner blank the email on their own report', async () => {
    await assertSucceeds(updateDoc(doc(asMember(), 'reports', 'rep-mine'), { email: '' }))
  })

  it('lets the owner find their own reports with a single equality filter', async () => {
    await assertSucceeds(
      getDocs(query(collection(asMember(), 'reports'), where('userId', '==', MEMBER))),
    )
  })

  it("still blocks reading someone else's report", async () => {
    await assertFails(getDoc(doc(asMember(), 'reports', 'rep-other')))
    await assertFails(
      getDocs(query(collection(asMember(), 'reports'), where('userId', '==', OTHER))),
    )
  })

  it('does not let the owner put a different email on a report', async () => {
    await assertFails(updateDoc(doc(asMember(), 'reports', 'rep-mine'), { email: 'x@example.com' }))
  })

  it('does not let report erasure carry other changes with it', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'reports', 'rep-mine'), { email: '', status: 'resolved' }),
    )
    await assertFails(
      updateDoc(doc(asMember(), 'reports', 'rep-mine'), { email: '', userId: OTHER }),
    )
  })

  it("does not let a member blank somebody else's report", async () => {
    await assertFails(updateDoc(doc(asMember(), 'reports', 'rep-other'), { email: '' }))
  })

  it('lets an admin blank the email on any report', async () => {
    await assertSucceeds(updateDoc(doc(asAdmin(), 'reports', 'rep-other'), { email: '' }))
  })

  it('lets the owner blank the comment on their own feedback', async () => {
    await assertSucceeds(
      updateDoc(doc(asMember(), 'feedback', `${EVENT}__${MEMBER}`), { comment: '' }),
    )
  })

  it("does not let a member blank somebody else's feedback comment", async () => {
    await assertFails(
      updateDoc(doc(asOther(), 'feedback', `${EVENT}__${MEMBER}`), { comment: '' }),
    )
  })

  it('lets an admin blank contact details on a registration and a waitlist entry', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'registrations', registrationId), baseRegistration(MEMBER))
      await setDoc(doc(db, 'waitlists', waitlistKey), waitlistEntry(MEMBER))
    })
    await assertSucceeds(
      updateDoc(doc(asAdmin(), 'registrations', registrationId), {
        name: '',
        email: '',
        phone: '',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(doc(asAdmin(), 'waitlists', waitlistKey), { name: '', email: '', phone: '' }),
    )
  })
})
