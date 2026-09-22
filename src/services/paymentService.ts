import { FirebaseError } from 'firebase/app'
import { firebaseApp } from '@/firebase/config'
import { trackSync } from '@/services/analyticsService'
import type { Registration } from '@/types'

/**
 * Razorpay checkout for a seat that is `pending_payment`.
 *
 * The app never touches the key secret and never decides that a seat is paid.
 * It asks the `createPaymentOrder` Cloud Function for an order, opens Razorpay
 * Checkout on it, and hands the signed result to `verifyPayment`, which is the
 * only thing that flips the registration to paid/confirmed. A webhook on the
 * server does the same if the phone dies before that last call.
 *
 * Works on the website and inside the Android shell alike: Checkout is a plain
 * script served over https and renders in the WebView like any other page.
 */

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'
const FUNCTIONS_REGION = 'asia-south1'

export type PaymentOutcome = 'paid' | 'cancelled'

export class PaymentError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'PaymentError'
  }
}

interface CreateOrderOutput {
  orderId: string
  amount: number
  currency: string
  keyId: string
  description: string
  prefill: { name: string; email: string; contact: string }
}

interface CheckoutSuccess {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface CheckoutFailure {
  error?: { code?: string; description?: string; reason?: string }
}

interface RazorpayInstance {
  open(): void
  on(event: 'payment.failed', handler: (response: CheckoutFailure) => void): void
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill: { name: string; email: string; contact: string }
  notes: Record<string, string>
  theme: { color: string }
  retry: { enabled: boolean }
  handler: (response: CheckoutSuccess) => void
  modal: { ondismiss: () => void; confirm_close: boolean }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

let checkoutLoader: Promise<void> | null = null

/** Load checkout.js once; every later call reuses the same promise. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (checkoutLoader) return checkoutLoader
  checkoutLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      checkoutLoader = null
      script.remove()
      reject(
        new PaymentError(
          'checkout/unavailable',
          'Could not reach the payment gateway. Check your connection and try again.',
        ),
      )
    }
    document.head.append(script)
  })
  return checkoutLoader
}

/** Turn a callable failure into something a member can act on. */
function translateFunctionError(caught: unknown): PaymentError {
  if (caught instanceof PaymentError) return caught
  const code = caught instanceof FirebaseError ? caught.code : ''
  const message = caught instanceof Error ? caught.message : ''
  switch (code) {
    case 'functions/not-found':
    case 'functions/unavailable':
    case 'functions/internal':
      return new PaymentError(
        'payment/unavailable',
        'Online payment is not available right now. Your seat stays held -- try again in a bit, or the organiser will contact you.',
      )
    case 'functions/failed-precondition':
      return new PaymentError('payment/precondition', message || 'This seat cannot be paid for right now.')
    case 'functions/already-exists':
      return new PaymentError('payment/already-paid', 'This seat is already paid for.')
    case 'functions/unauthenticated':
      return new PaymentError('payment/unauthenticated', 'Please sign in again to pay.')
    case 'functions/permission-denied':
      return new PaymentError('payment/denied', message || 'Payment could not be verified.')
    default:
      return new PaymentError('payment/failed', message || 'Payment could not be completed. Please try again.')
  }
}

async function callFunction<Input, Output>(name: string, data: Input): Promise<Output> {
  const { getFunctions, httpsCallable } = await import('firebase/functions')
  const call = httpsCallable<Input, Output>(getFunctions(firebaseApp, FUNCTIONS_REGION), name)
  try {
    return (await call(data)).data
  } catch (caught) {
    throw translateFunctionError(caught)
  }
}

/**
 * Run the whole checkout for one registration.
 *
 * Resolves `'paid'` once the server has verified the payment, `'cancelled'`
 * if the member closed the sheet, and rejects with a `PaymentError` for
 * anything that actually went wrong. A declined card inside the sheet is not
 * a rejection -- Razorpay offers a retry in place.
 */
export async function payForRegistration(registration: Registration): Promise<PaymentOutcome> {
  if (registration.registrationStatus !== 'pending_payment') {
    throw new PaymentError('payment/precondition', 'This seat is not awaiting payment.')
  }

  trackSync('payment_started', { eventId: registration.eventId, price: registration.price })

  const [order] = await Promise.all([
    callFunction<{ registrationId: string }, CreateOrderOutput>('createPaymentOrder', {
      registrationId: registration.id,
    }),
    loadCheckout(),
  ])

  const Razorpay = window.Razorpay
  if (!Razorpay) {
    throw new PaymentError('checkout/unavailable', 'The payment gateway did not load. Please try again.')
  }

  return new Promise<PaymentOutcome>((resolve, reject) => {
    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'CrewDay',
      description: order.description,
      order_id: order.orderId,
      prefill: order.prefill,
      notes: { registrationId: registration.id, eventId: registration.eventId },
      theme: { color: '#ff4d8d' },
      retry: { enabled: true },
      modal: {
        confirm_close: true,
        ondismiss: () =>
          settle(() => {
            trackSync('payment_cancelled', { eventId: registration.eventId })
            resolve('cancelled')
          }),
      },
      handler: (response) => {
        settle(() => {
          void callFunction<
            { registrationId: string; orderId: string; paymentId: string; signature: string },
            { ok: boolean; status: string }
          >('verifyPayment', {
            registrationId: registration.id,
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })
            .then((result) => {
              if (!result.ok) {
                reject(
                  new PaymentError(
                    'payment/unverified',
                    'We received the payment but could not confirm the seat. It will be confirmed automatically shortly.',
                  ),
                )
                return
              }
              trackSync('payment_completed', { eventId: registration.eventId, price: registration.price })
              resolve('paid')
            })
            .catch(reject)
        })
      },
    })

    // A declined attempt: Razorpay keeps the sheet open with a retry, so this
    // is informational only. Only a dismissal or a success ends the promise.
    checkout.on('payment.failed', (failure) => {
      trackSync('payment_failed', {
        eventId: registration.eventId,
        reason: failure.error?.reason ?? failure.error?.code ?? 'unknown',
      })
    })

    try {
      checkout.open()
    } catch (caught) {
      settle(() => reject(translateFunctionError(caught)))
    }
  })
}
