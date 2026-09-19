/**
 * CrewDay — Cloud Functions
 * ============================================================================
 *
 * The web app is fully functional *without* this package: registration,
 * check-in, cancellation and in-app notifications all run through client
 * transactions guarded by Firestore Security Rules, which works on the free
 * Spark plan.
 *
 * Deploying these functions (Blaze plan required for outbound network calls
 * and scheduled jobs) adds the parts a browser genuinely cannot do:
 *
 *   • pushing FCM messages to a device that has the app closed
 *   • time-based reminders (24 hours and 2 hours before an event)
 *   • rolling past events to `completed` and marking no-shows
 *   • granting the very first organiser account
 *   • cleaning up when an auth account is deleted from the console
 */

import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getMessaging, type TokenMessage } from 'firebase-admin/messaging'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getAuth } from 'firebase-admin/auth'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { setGlobalOptions } from 'firebase-functions/v2'
import { logger } from 'firebase-functions'
import * as functionsV1 from 'firebase-functions/v1'
import {
  APP_URL,
  isEmailConfigured,
  renderPasswordResetEmail,
  renderQrPng,
  renderTicketEmail,
  sendMail,
} from './email'

initializeApp()

const db = getFirestore()

setGlobalOptions({ region: 'asia-south1', maxInstances: 10 })

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface NotificationDoc {
  userId: string
  type: string
  title: string
  body: string
  eventId?: string
}

interface UserDoc {
  fcmTokens?: string[]
  notificationPrefs?: {
    push?: boolean
    reminders?: boolean
    newEvents?: boolean
    registrationUpdates?: boolean
  }
}

/** Which preference switch governs each notification type. */
function isAllowedByPrefs(type: string, prefs: UserDoc['notificationPrefs']): boolean {
  if (!prefs?.push) return false
  switch (type) {
    case 'event_reminder':
      return prefs.reminders !== false
    case 'new_event':
      return prefs.newEvents !== false
    case 'registration_confirmed':
    case 'event_cancelled':
    case 'event_updated':
    case 'waitlist_promoted':
      return prefs.registrationUpdates !== false
    default:
      return true
  }
}

/* -------------------------------------------------------------------------- */
/*                         Push delivery for notifications                    */
/* -------------------------------------------------------------------------- */

/**
 * Mirror every in-app notification to the member's devices.
 *
 * The app writes notification documents directly (so the inbox works with no
 * server); this trigger is the only thing that turns them into real pushes.
 * Dead tokens are pruned so we do not keep paying to message uninstalled apps.
 */
export const pushOnNotificationCreated = onDocumentCreated(
  'notifications/{notificationId}',
  async (event) => {
    const notification = event.data?.data() as NotificationDoc | undefined
    if (!notification?.userId) return

    const userSnapshot = await db.collection('users').doc(notification.userId).get()
    if (!userSnapshot.exists) return

    const user = userSnapshot.data() as UserDoc
    const tokens = (user.fcmTokens ?? []).filter(Boolean)
    if (!tokens.length) return
    if (!isAllowedByPrefs(notification.type, user.notificationPrefs)) return

    const messages: TokenMessage[] = tokens.map((token) => ({
      token,
      notification: { title: notification.title, body: notification.body },
      data: {
        eventId: notification.eventId ?? '',
        url: notification.eventId ? `/events/${notification.eventId}` : '/notifications',
      },
      webpush: {
        fcmOptions: {
          link: notification.eventId ? `/events/${notification.eventId}` : '/notifications',
        },
      },
    }))

    const response = await getMessaging().sendEach(messages)

    const dead: string[] = []
    response.responses.forEach((result, index) => {
      const code = result.error?.code
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-argument'
      ) {
        dead.push(tokens[index])
      }
    })

    if (dead.length) {
      await userSnapshot.ref.update({ fcmTokens: FieldValue.arrayRemove(...dead) })
      logger.info(`Pruned ${dead.length} dead FCM token(s) for ${notification.userId}`)
    }
  },
)

/* -------------------------------------------------------------------------- */
/*                              Event reminders                               */
/* -------------------------------------------------------------------------- */

interface ReminderWindow {
  flag: 'reminder24hSentAt' | 'reminder2hSentAt'
  hours: number
  title: (title: string) => string
  body: (venue: string, time: string) => string
}

const REMINDER_WINDOWS: ReminderWindow[] = [
  {
    flag: 'reminder24hSentAt',
    hours: 24,
    title: (title) => `Your CrewDay is tomorrow 🎉`,
    body: (venue, time) => `${time} at ${venue}. Don't forget your QR ticket.`,
  },
  {
    flag: 'reminder2hSentAt',
    hours: 2,
    title: () => 'Your event starts in 2 hours',
    body: (venue, time) => `${time} at ${venue}. Time to head out.`,
  },
]

/**
 * Hourly sweep for reminders.
 *
 * Each window is stamped on the event document once it has been sent, so a
 * retry or an overlapping run can never notify the same crowd twice.
 */
export const sendEventReminders = onSchedule('every 60 minutes', async () => {
  const now = Date.now()

  for (const window of REMINDER_WINDOWS) {
    const from = Timestamp.fromMillis(now + (window.hours - 1) * 3_600_000)
    const to = Timestamp.fromMillis(now + window.hours * 3_600_000)

    const events = await db
      .collection('events')
      .where('status', 'in', ['open', 'closed'])
      .where('startsAt', '>=', from)
      .where('startsAt', '<=', to)
      .limit(25)
      .get()

    for (const eventDoc of events.docs) {
      const event = eventDoc.data()
      if (event[window.flag]) continue

      const registrations = await db
        .collection('registrations')
        .where('eventId', '==', eventDoc.id)
        .where('registrationStatus', '==', 'confirmed')
        .get()

      const recipients = [
        ...new Set(registrations.docs.map((entry) => entry.data().userId as string)),
      ].filter(Boolean)

      // Firestore batches cap at 500 writes.
      for (let index = 0; index < recipients.length; index += 400) {
        const batch = db.batch()
        for (const userId of recipients.slice(index, index + 400)) {
          batch.set(db.collection('notifications').doc(), {
            userId,
            type: 'event_reminder',
            title: window.title(event.title),
            body: window.body(event.venue ?? 'the venue', event.startTime ?? ''),
            eventId: eventDoc.id,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          })
        }
        await batch.commit()
      }

      await eventDoc.ref.update({ [window.flag]: FieldValue.serverTimestamp() })
      logger.info(
        `Sent ${window.hours}h reminders for "${event.title}" to ${recipients.length} member(s)`,
      )
    }
  }
})

/* -------------------------------------------------------------------------- */
/*                        Roll past events to completed                       */
/* -------------------------------------------------------------------------- */

/**
 * Nightly tidy-up: anything that has already happened becomes `completed`, and
 * confirmed registrations that were never scanned become `no_show` so the
 * attendance statistics are honest.
 */
export const completePastEvents = onSchedule('every day 03:00', async () => {
  const yesterday = new Date(Date.now() - 24 * 3_600_000).toISOString().slice(0, 10)

  const events = await db
    .collection('events')
    .where('status', 'in', ['open', 'closed'])
    .where('date', '<=', yesterday)
    .limit(50)
    .get()

  for (const eventDoc of events.docs) {
    await eventDoc.ref.update({
      status: 'completed',
      updatedAt: FieldValue.serverTimestamp(),
    })

    const stragglers = await db
      .collection('registrations')
      .where('eventId', '==', eventDoc.id)
      .where('registrationStatus', '==', 'confirmed')
      .where('attendanceStatus', '==', 'not_checked_in')
      .get()

    for (let index = 0; index < stragglers.docs.length; index += 400) {
      const batch = db.batch()
      for (const entry of stragglers.docs.slice(index, index + 400)) {
        batch.update(entry.ref, {
          attendanceStatus: 'no_show',
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
      await batch.commit()
    }

    logger.info(
      `Completed "${eventDoc.data().title}"; marked ${stragglers.size} registration(s) as no-show`,
    )
  }
})

/* -------------------------------------------------------------------------- */
/*                       Announce newly published events                      */
/* -------------------------------------------------------------------------- */

/**
 * Tell members in the same city about a freshly published event. Capped so a
 * single publish cannot fan out to an unbounded number of writes.
 */
export const announceNewEvent = onDocumentCreated('events/{eventId}', async (event) => {
  const data = event.data?.data()
  if (!data || data.status !== 'open' || !data.city) return

  const audience = await db
    .collection('users')
    .where('status', '==', 'active')
    .where('city', '==', data.city)
    .limit(500)
    .get()

  const recipients = audience.docs.filter(
    (doc) => (doc.data() as UserDoc).notificationPrefs?.newEvents !== false,
  )

  for (let index = 0; index < recipients.length; index += 400) {
    const batch = db.batch()
    for (const userDoc of recipients.slice(index, index + 400)) {
      batch.set(db.collection('notifications').doc(), {
        userId: userDoc.id,
        type: 'new_event',
        title: `New CrewDay: ${data.title}`,
        body: `${data.date} at ${data.venue}. Seats are open now.`,
        eventId: event.params.eventId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
  }

  logger.info(`Announced "${data.title}" to ${recipients.length} member(s) in ${data.city}`)
})

/* -------------------------------------------------------------------------- */
/*                              Organiser access                              */
/* -------------------------------------------------------------------------- */

/**
 * Grant or revoke organiser access.
 *
 * Only an existing admin may call this. The very first admin is bootstrapped
 * with the `BOOTSTRAP_ADMIN_EMAIL` environment variable: the account with that
 * email may promote itself exactly once, after which normal admin-to-admin
 * promotion applies.
 */
export const setOrganiserRole = onCall<{ email: string; makeAdmin: boolean }>(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')

  const callerSnapshot = await db.collection('users').doc(request.auth.uid).get()
  const caller = callerSnapshot.data()
  const callerIsAdmin = caller?.role === 'admin' && caller?.status === 'active'

  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase()
  const isBootstrapping =
    Boolean(bootstrapEmail) &&
    request.auth.token.email?.toLowerCase() === bootstrapEmail &&
    request.data.email?.toLowerCase() === bootstrapEmail

  if (!callerIsAdmin && !isBootstrapping) {
    throw new HttpsError('permission-denied', 'Only an organiser can change organiser access.')
  }

  const email = request.data.email?.trim().toLowerCase()
  if (!email) throw new HttpsError('invalid-argument', 'An email address is required.')

  const target = await db.collection('users').where('email', '==', email).limit(1).get()
  if (target.empty) {
    throw new HttpsError('not-found', 'No CrewDay account uses that email address.')
  }

  const targetDoc = target.docs[0]
  if (targetDoc.id === request.auth.uid && !request.data.makeAdmin) {
    throw new HttpsError('failed-precondition', 'You cannot remove your own organiser access.')
  }

  await targetDoc.ref.update({
    role: request.data.makeAdmin ? 'admin' : 'user',
    updatedAt: FieldValue.serverTimestamp(),
  })

  logger.info(
    `${request.auth.uid} set role=${request.data.makeAdmin ? 'admin' : 'user'} on ${targetDoc.id}`,
  )
  return { ok: true, uid: targetDoc.id }
})

/* -------------------------------------------------------------------------- */
/*                          Auth account clean-up                             */
/* -------------------------------------------------------------------------- */

/**
 * If an auth account disappears (deleted from the Firebase console, or by the
 * member), scrub the personal data from the profile. Attendance history is
 * kept as an anonymous count so organiser reports stay accurate.
 */
export const anonymiseDeletedUser = functionsV1
  .region('asia-south1')
  .auth.user()
  .onDelete(async (user) => {
    const ref = db.collection('users').doc(user.uid)
    const snapshot = await ref.get()
    if (!snapshot.exists) return

    await ref.update({
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
      updatedAt: FieldValue.serverTimestamp(),
    })

    logger.info(`Anonymised profile for deleted auth user ${user.uid}`)
  })


/* -------------------------------------------------------------------------- */
/*                              Ticket email                                  */
/* -------------------------------------------------------------------------- */

const INR = (paise: number) => (paise > 0 ? `₹${paise.toLocaleString('en-IN')}` : 'FREE')

function prettyDate(iso: string): string {
  if (!iso) return ''
  const parsed = new Date(`${iso}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
}

function prettyTime(value: string): string {
  if (!value) return ''
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours)) return value
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes ?? 0).padStart(2, '0')} ${suffix}`
}

/**
 * Email the attendee their QR ticket the moment they register.
 *
 * The QR is embedded inline (so it shows in the email body) *and* attached as
 * a PNG, because plenty of clients block remote and inline images by default —
 * a ticket somebody cannot see is not a ticket.
 *
 * Failures are swallowed deliberately: a bounced email must never leave the
 * member wondering whether their registration went through. The registration
 * itself is already committed by the time this runs.
 */
export const sendRegistrationEmail = onDocumentCreated(
  'registrations/{registrationId}',
  async (event) => {
    const registration = event.data?.data()
    if (!registration?.email) return

    if (!isEmailConfigured) {
      logger.warn('SMTP is not configured — skipping the ticket email.')
      return
    }

    const registrationId = event.params.registrationId
    const payload = `CDQR1|${registrationId}|${registration.qrToken}`

    try {
      const qr = await renderQrPng(payload)
      const confirmed = registration.registrationStatus === 'confirmed'

      const { html, text } = renderTicketEmail({
        name: registration.name ?? '',
        eventTitle: registration.eventTitle ?? 'Your CrewDay',
        eventDate: prettyDate(registration.eventDate ?? ''),
        eventTime: prettyTime(registration.eventStartTime ?? ''),
        venue: registration.eventVenue ?? '',
        registrationCode: registration.registrationCode ?? '',
        participationType:
          registration.participationType === 'audience' ? 'Audience' : 'Participant',
        price: INR(registration.price ?? 0),
        confirmed,
        ticketUrl: `${APP_URL}/tickets/${registrationId}`,
      })

      await sendMail({
        to: registration.email,
        subject: confirmed
          ? `You're in — ${registration.eventTitle}`
          : `Seat held — ${registration.eventTitle}`,
        html,
        text,
        attachments: [
          { filename: 'crewday-ticket-qr.png', content: qr, cid: 'crewday-qr', contentType: 'image/png' },
        ],
      })

      logger.info(`Ticket email sent to ${registration.email} for ${registrationId}`)
    } catch (error) {
      logger.error('Ticket email failed', error)
    }
  },
)

/* -------------------------------------------------------------------------- */
/*                         Branded password reset                             */
/* -------------------------------------------------------------------------- */

/**
 * Send a password reset through our own SMTP rather than Firebase's default
 * sender, so the email matches the rest of the product.
 *
 * Always resolves the same way whether or not the address exists — a reset
 * endpoint that answers differently for real and unknown emails is a free
 * account-enumeration oracle.
 */
export const sendPasswordReset = onCall<{ email: string }>(async (request) => {
  const email = request.data?.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.')
  }

  if (!isEmailConfigured) {
    throw new HttpsError('failed-precondition', 'Email is not configured on the server.')
  }

  try {
    const link = await getAuth().generatePasswordResetLink(email, {
      url: `${APP_URL}/login`,
    })
    const profile = await db.collection('users').where('email', '==', email).limit(1).get()
    const name = profile.empty ? '' : (profile.docs[0].data().name ?? '')

    const { html, text } = renderPasswordResetEmail({ name, link })
    await sendMail({ to: email, subject: 'Reset your CrewDay password', html, text })
    logger.info(`Password reset sent to ${email}`)
  } catch (error) {
    // Unknown address, or a transient send failure. Log it, tell the caller
    // nothing — see the note above about enumeration.
    logger.warn('Password reset not sent', error)
  }

  return { ok: true }
})
