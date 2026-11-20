import { auth } from '@/firebase/config'
import { isNativeApp } from '@/platform'
import type { Registration } from '@/types'

/**
 * Online payment through Razorpay Checkout.
 *
 * Nothing here decides that a payment succeeded. The browser asks the
 * `/api/razorpay-order` route for an order (the route reads the price from the
 * event, so no amount is ever sent from here), shows Razorpay's own checkout,
 * and then waits. The seat is confirmed by the signed `/api/razorpay-webhook`
 * route, and the page learns of it through the live registration subscription
 * it already has.
 */

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

/**
 * Where the `/api` routes live. On the website they are same-origin. The
 * Android app serves its pages from https://localhost, which has no API, so it
 * calls the deployed site instead (that route allows the app's origin).
 */
const API_ORIGIN = isNativeApp
  ? (import.meta.env.VITE_API_ORIGIN as string | undefined) || 'https://crewday.nirmaansolutions.in'
  : ''

export interface RazorpayOrder {
  orderId: string
  amount: number
  currency: string
  keyId: string
}

interface CheckoutOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  prefill: { name: string; email: string; contact: string }
  notes: Record<string, string>
  theme: { color: string }
  handler: () => void
  modal: { ondismiss: () => void }
}

interface CheckoutInstance {
  open: () => void
  on: (event: 'payment.failed', handler: (response: unknown) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => CheckoutInstance
  }
}

export class OnlinePaymentError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'OnlinePaymentError'
  }
}

let scriptPromise: Promise<void> | null = null

/** Load Razorpay's checkout script once; reject (and allow a retry) if it is blocked. */
export function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      script.remove()
      reject(new OnlinePaymentError('script-blocked', 'Could not load the payment window.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** Ask the server for an order for this registration. The amount is decided there. */
export async function createRazorpayOrder(registrationId: string): Promise<RazorpayOrder> {
  const idToken = await auth.currentUser?.getIdToken().catch(() => undefined)
  if (!idToken) {
    throw new OnlinePaymentError('unauthenticated', 'Please sign in again to pay online.')
  }

  let response: Response
  try {
    response = await fetch(`${API_ORIGIN}/api/razorpay-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ registrationId }),
    })
  } catch {
    throw new OnlinePaymentError('order-failed', 'Could not start the payment. Please try again.')
  }

  if (response.ok) {
    const order = (await response.json().catch(() => null)) as Partial<RazorpayOrder> | null
    if (
      order &&
      typeof order.orderId === 'string' &&
      typeof order.amount === 'number' &&
      typeof order.currency === 'string' &&
      typeof order.keyId === 'string'
    ) {
      return order as RazorpayOrder
    }
    throw new OnlinePaymentError('order-failed', 'Could not start the payment. Please try again.')
  }
  // 503: payments are not set up on the server; 404: no such registration/event.
  if (response.status === 503 || response.status === 404) {
    throw new OnlinePaymentError(
      'not-available',
      'Online payment is not available right now. Pay by UPI below instead.',
    )
  }
  if (response.status === 401) {
    throw new OnlinePaymentError('unauthenticated', 'Please sign in again to pay online.')
  }
  throw new OnlinePaymentError('order-failed', 'Could not start the payment. Please try again.')
}

/**
 * Open Razorpay's checkout for an order. Resolves `paid` when the checkout
 * reports success (the seat is still confirmed by the server afterwards),
 * `dismissed` if the person closes it, or `failed` if the payment is declined.
 */
export function openCheckout(
  order: RazorpayOrder,
  registration: Registration,
): Promise<'paid' | 'dismissed' | 'failed'> {
  return new Promise((resolve) => {
    const Razorpay = window.Razorpay
    if (!Razorpay) {
      resolve('failed')
      return
    }
    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'CrewDay',
      description: registration.eventTitle,
      prefill: {
        name: registration.name,
        email: registration.email,
        contact: registration.phone,
      },
      notes: { registrationId: registration.id },
      theme: { color: '#ec4899' },
      handler: () => resolve('paid'),
      modal: { ondismiss: () => resolve('dismissed') },
    })
    checkout.on('payment.failed', () => resolve('failed'))
    checkout.open()
  })
}
