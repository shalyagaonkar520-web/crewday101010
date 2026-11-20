import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { REFUND_CUTOFF_HOURS } from '@/utils/constants'
import { InlineAlert } from '@/components/ui/Feedback'
import {
  createRazorpayOrder,
  loadCheckoutScript,
  openCheckout,
  OnlinePaymentError,
} from '@/services/onlinePaymentService'
import { formatPrice } from '@/utils/format'
import type { Registration } from '@/types'

type State =
  | { status: 'idle' }
  | { status: 'preparing' }
  | { status: 'confirming' }
  | { status: 'slow' }
  | { status: 'error'; message: string }

/** How long to wait for the server to confirm before telling the person it is slow. */
const CONFIRM_WAIT_MS = 60_000

/**
 * "Pay online" for a registration waiting for payment.
 *
 * Paying here never confirms the seat by itself. After Razorpay's checkout
 * reports success the button just waits: the server confirms the payment
 * (signed webhook) and the parent page, which subscribes to the registration,
 * replaces this whole panel with the ticket. If that takes unusually long the
 * person is told to keep the page and not pay twice.
 */
export function OnlineCheckoutButton({ registration }: { registration: Registration }) {
  const [state, setState] = useState<State>({ status: 'idle' })
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const start = async () => {
    setState({ status: 'preparing' })
    try {
      const [order] = await Promise.all([
        createRazorpayOrder(registration.id),
        loadCheckoutScript(),
      ])
      const outcome = await openCheckout(order, registration)
      if (outcome === 'paid') {
        setState({ status: 'confirming' })
        timer.current = window.setTimeout(() => setState({ status: 'slow' }), CONFIRM_WAIT_MS)
      } else if (outcome === 'failed') {
        setState({ status: 'error', message: 'The payment did not go through. You have not been charged; try again or pay by UPI below.' })
      } else {
        setState({ status: 'idle' })
      }
    } catch (caught) {
      setState({
        status: 'error',
        message:
          caught instanceof OnlinePaymentError
            ? caught.message
            : 'Could not start the payment. Please try again.',
      })
    }
  }

  if (state.status === 'confirming' || state.status === 'slow') {
    return (
      <InlineAlert tone={state.status === 'slow' ? 'warning' : 'info'}>
        {state.status === 'slow'
          ? 'Your payment is taking longer than usual to confirm. Keep this page open and do not pay again; your ticket appears here as soon as it is confirmed. If it does not, contact the organiser with your registration ID.'
          : 'Payment received. Confirming your seat…'}
      </InlineAlert>
    )
  }

  return (
    <div>
      <Button
        fullWidth
        loading={state.status === 'preparing'}
        icon={<CreditCard size={17} aria-hidden />}
        onClick={() => void start()}
      >
        Pay {formatPrice(registration.price, registration.currency)} online
      </Button>
      <p className="mt-2 text-center text-xs text-ink-500">
        Card, UPI or netbanking through Razorpay. Free cancellation up to {REFUND_CUTOFF_HOURS} hours
        before the event; see the{' '}
        <Link to="/refund-policy" className="font-semibold text-brand-600 hover:underline">
          refund policy
        </Link>
        .
      </p>
      {state.status === 'error' ? (
        <div className="mt-3">
          <InlineAlert tone="danger">{state.message}</InlineAlert>
        </div>
      ) : null}
    </div>
  )
}
