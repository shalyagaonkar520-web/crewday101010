/**
 * Razorpay payments for paid events.
 *
 * The client never decides whether a seat is paid. It asks this module for an
 * order, hands that order to Razorpay Checkout, and the seat is confirmed only
 * once a signature computed with the *secret* key checks out -- either the one
 * Checkout returns to the app (`verifyPayment`) or the one Razorpay posts to
 * our webhook (`razorpayWebhook`). Both paths end in the same idempotent
 * `markRegistrationPaid`, so a payment reported twice confirms once.
 *
 * Secrets (set once with `firebase functions:secrets:set NAME`):
 *   RAZORPAY_KEY_ID          rzp_test_... / rzp_live_...
 *   RAZORPAY_KEY_SECRET      the matching secret
 *   RAZORPAY_WEBHOOK_SECRET  whatever you typed when creating the webhook
 *
 * Webhook URL to register in the Razorpay dashboard (events: payment.captured,
 * payment.failed, order.paid):
 *   https://asia-south1-<project-id>.cloudfunctions.net/razorpayWebhook
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'

const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET')
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET')

const db = getFirestore()

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

interface RegistrationDoc {
  eventId: string
  eventTitle?: string
  userId: string
  name?: string
  email?: string
  phone?: string
  registrationCode?: string
  price: number
  currency?: string
  paymentStatus: 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded'
  registrationStatus: 'confirmed' | 'pending_payment' | 'cancelled' | 'waitlisted'
  payment?: {
    provider: 'razorpay'
    orderId: string
    paymentId?: string
    amount: number
    currency: string
  }
}

interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  status: string
}

interface RazorpayPaymentEntity {
  id: string
  order_id?: string
  amount?: number
  status?: string
  error_description?: string
  notes?: Record<string, string>
}

interface CreateOrderInput {
  registrationId: string
}

interface CreateOrderOutput {
  orderId: string
  amount: number
  currency: string
  keyId: string
  description: string
  prefill: { name: string; email: string; contact: string }
}

interface VerifyInput {
  registrationId: string
  orderId: string
  paymentId: string
  signature: string
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function hmacSha256(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

/** Rupees on the event -> paise for Razorpay, never fractional. */
function toPaise(price: number): number {
  return Math.round(price * 100)
}

async function razorpayCreateOrder(
  keyId: string,
  keySecret: string,
  body: { amount: number; currency: string; receipt: string; notes: Record<string, string> },
): Promise<RazorpayOrder> {
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
    },
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as
    | RazorpayOrder
    | { error?: { description?: string } }
  if (!response.ok || !('id' in payload)) {
    const reason = 'error' in payload ? payload.error?.description : undefined
    logger.error('Razorpay order creation failed', { status: response.status, reason })
    throw new HttpsError('unavailable', reason ?? 'Razorpay did not accept the order.')
  }
  return payload
}

/**
 * Flip a registration to paid + confirmed, exactly once.
 *
 * Runs in a transaction so a webhook and a client verification landing at the
 * same moment cannot both "confirm" and both write a notification. A seat
 * that was cancelled while the checkout was open still records the payment
 * (the money did move) but is *not* resurrected -- it is flagged for a refund
 * and logged so an organiser sees it.
 */
async function markRegistrationPaid(
  registrationId: string,
  payment: { orderId: string; paymentId: string; amount?: number },
): Promise<'confirmed' | 'already_paid' | 'needs_refund' | 'not_found'> {
  const ref = db.collection('registrations').doc(registrationId)

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) return 'not_found'
    const registration = snapshot.data() as RegistrationDoc

    if (registration.paymentStatus === 'paid') return 'already_paid'

    if (registration.registrationStatus === 'cancelled') {
      transaction.update(ref, {
        paymentStatus: 'paid',
        'payment.provider': 'razorpay',
        'payment.paymentId': payment.paymentId,
        'payment.orderId': payment.orderId,
        'payment.paidAt': FieldValue.serverTimestamp(),
        'payment.needsRefund': true,
        updatedAt: FieldValue.serverTimestamp(),
      })
      logger.warn(`Payment ${payment.paymentId} landed on cancelled seat ${registrationId}; refund needed`)
      return 'needs_refund'
    }

    transaction.update(ref, {
      paymentStatus: 'paid',
      registrationStatus: 'confirmed',
      'payment.provider': 'razorpay',
      'payment.paymentId': payment.paymentId,
      'payment.orderId': payment.orderId,
      'payment.paidAt': FieldValue.serverTimestamp(),
      'payment.failureReason': FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    transaction.set(db.collection('notifications').doc(), {
      userId: registration.userId,
      type: 'registration_confirmed',
      title: `You're in: ${registration.eventTitle ?? 'your CrewDay'}`,
      body: 'Payment received. Your QR ticket is active -- show it at the venue.',
      eventId: registration.eventId,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    })

    return 'confirmed'
  })
}

/* -------------------------------------------------------------------------- */
/*                         createPaymentOrder (callable)                      */
/* -------------------------------------------------------------------------- */

/**
 * Start (or resume) a checkout for a pending-payment seat.
 *
 * Every amount comes from the registration document -- which the security
 * rules already forced to equal the event's price -- never from the client.
 * A registration that already holds an unpaid order simply gets that order
 * back, so closing the sheet and tapping Pay again does not litter Razorpay
 * with duplicates.
 */
export const createPaymentOrder = onCall<CreateOrderInput, Promise<CreateOrderOutput>>(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')

    const keyId = RAZORPAY_KEY_ID.value()
    const keySecret = RAZORPAY_KEY_SECRET.value()
    if (!keyId || !keySecret) {
      throw new HttpsError('failed-precondition', 'Online payment is not configured yet.')
    }

    const registrationId = request.data?.registrationId?.trim()
    if (!registrationId) throw new HttpsError('invalid-argument', 'registrationId is required.')

    const ref = db.collection('registrations').doc(registrationId)
    const snapshot = await ref.get()
    if (!snapshot.exists) throw new HttpsError('not-found', 'Registration not found.')
    const registration = snapshot.data() as RegistrationDoc

    if (registration.userId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'This registration belongs to another account.')
    }
    if (registration.paymentStatus === 'paid') {
      throw new HttpsError('already-exists', 'This seat is already paid for.')
    }
    if (registration.registrationStatus !== 'pending_payment') {
      throw new HttpsError('failed-precondition', 'This registration is not awaiting payment.')
    }
    const amount = toPaise(registration.price)
    if (amount <= 0) throw new HttpsError('failed-precondition', 'This event is free.')

    const eventSnapshot = await db.collection('events').doc(registration.eventId).get()
    const event = eventSnapshot.data()
    if (!event || event.status === 'cancelled') {
      throw new HttpsError('failed-precondition', 'This event is no longer taking payments.')
    }

    const currency = registration.currency || 'INR'
    const prefill = {
      name: registration.name ?? '',
      email: registration.email ?? '',
      contact: registration.phone ?? '',
    }
    const description = registration.eventTitle ?? 'CrewDay ticket'

    const existing = registration.payment
    if (
      existing?.provider === 'razorpay' &&
      existing.orderId &&
      !existing.paymentId &&
      existing.amount === amount &&
      existing.currency === currency
    ) {
      return { orderId: existing.orderId, amount, currency, keyId, description, prefill }
    }

    const order = await razorpayCreateOrder(keyId, keySecret, {
      amount,
      currency,
      // Razorpay caps receipts at 40 characters; the ticket code fits, the
      // `${eventId}__${uid}` document id does not.
      receipt: (registration.registrationCode || registrationId).slice(0, 40),
      notes: {
        registrationId,
        eventId: registration.eventId,
        userId: registration.userId,
      },
    })

    await ref.update({
      payment: { provider: 'razorpay', orderId: order.id, amount, currency },
      updatedAt: FieldValue.serverTimestamp(),
    })

    logger.info(`Razorpay order ${order.id} created for ${registrationId} (${amount} ${currency})`)
    return { orderId: order.id, amount, currency, keyId, description, prefill }
  },
)

/* -------------------------------------------------------------------------- */
/*                           verifyPayment (callable)                         */
/* -------------------------------------------------------------------------- */

/**
 * Confirm a seat from the signature Razorpay Checkout hands back to the app.
 *
 * The signature is an HMAC over `order_id|payment_id` with the key *secret*,
 * which only this function holds -- a client cannot forge it. The webhook
 * below is the safety net for the case where the app dies before this call.
 */
export const verifyPayment = onCall<VerifyInput, Promise<{ ok: boolean; status: string }>>(
  { secrets: [RAZORPAY_KEY_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')

    const { registrationId, orderId, paymentId, signature } = request.data ?? {}
    if (!registrationId || !orderId || !paymentId || !signature) {
      throw new HttpsError('invalid-argument', 'Incomplete payment details.')
    }

    const expected = hmacSha256(RAZORPAY_KEY_SECRET.value(), `${orderId}|${paymentId}`)
    if (!safeEqualHex(expected, signature)) {
      logger.warn(`Bad Razorpay signature for ${registrationId} / ${orderId}`)
      throw new HttpsError('permission-denied', 'Payment could not be verified.')
    }

    const snapshot = await db.collection('registrations').doc(registrationId).get()
    const registration = snapshot.data() as RegistrationDoc | undefined
    if (!registration) throw new HttpsError('not-found', 'Registration not found.')
    if (registration.userId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'This registration belongs to another account.')
    }
    if (registration.payment?.orderId !== orderId) {
      throw new HttpsError('failed-precondition', 'This payment does not match the registration.')
    }

    const status = await markRegistrationPaid(registrationId, { orderId, paymentId })
    logger.info(`verifyPayment ${registrationId}: ${status}`)
    return { ok: status === 'confirmed' || status === 'already_paid', status }
  },
)

/* -------------------------------------------------------------------------- */
/*                          razorpayWebhook (HTTP)                            */
/* -------------------------------------------------------------------------- */

/**
 * Razorpay -> CrewDay. Confirms seats the app never got to verify itself (the
 * phone lost signal, the app was killed mid-checkout) and records failures so
 * the ticket can say why.
 *
 * Always answers 200 for a well-signed event we do not care about, and 4xx
 * only for a bad signature -- Razorpay retries anything else, and retrying an
 * event we deliberately ignore is just noise.
 */
export const razorpayWebhook = onRequest(
  { secrets: [RAZORPAY_WEBHOOK_SECRET], cors: false },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method not allowed')
      return
    }

    const secret = RAZORPAY_WEBHOOK_SECRET.value()
    const signature = request.get('x-razorpay-signature') ?? ''
    if (!secret || !signature || !safeEqualHex(hmacSha256(secret, request.rawBody), signature)) {
      logger.warn('Razorpay webhook rejected: bad signature')
      response.status(401).send('Invalid signature')
      return
    }

    const body = request.body as {
      event?: string
      payload?: { payment?: { entity?: RazorpayPaymentEntity } }
    }
    const event = body.event ?? ''
    const payment = body.payload?.payment?.entity
    const registrationId = payment?.notes?.registrationId

    if (!payment?.id || !registrationId) {
      response.status(200).send('Ignored')
      return
    }

    try {
      if (event === 'payment.captured' || event === 'order.paid') {
        const status = await markRegistrationPaid(registrationId, {
          orderId: payment.order_id ?? '',
          paymentId: payment.id,
          amount: payment.amount,
        })
        logger.info(`Webhook ${event} for ${registrationId}: ${status}`)
      } else if (event === 'payment.failed') {
        const ref = db.collection('registrations').doc(registrationId)
        const snapshot = await ref.get()
        const registration = snapshot.data() as RegistrationDoc | undefined
        // Never downgrade a seat that a later attempt already paid for.
        if (registration && registration.paymentStatus !== 'paid') {
          await ref.update({
            paymentStatus: 'failed',
            'payment.failureReason': payment.error_description ?? 'Payment failed',
            updatedAt: FieldValue.serverTimestamp(),
          })
        }
        logger.info(`Webhook payment.failed for ${registrationId}`)
      }
      response.status(200).send('OK')
    } catch (error) {
      logger.error('Razorpay webhook handling failed', error)
      response.status(500).send('Error')
    }
  },
)
