/**
 * The online (Razorpay) checkout button.
 *
 * Razorpay itself, the /api/razorpay-order route and the network are all stubbed: these
 * tests prove what the browser does and, just as important, what it never does
 * (send an amount, or mark anything paid).
 */

import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Registration } from '@/types'

// The panel links to the refund policy, so it needs a router around it.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter })

const getPaymentSettings = vi.hoisted(() => vi.fn())
const createRazorpayOrder = vi.hoisted(() => vi.fn())
const openCheckout = vi.hoisted(() => vi.fn())
const loadCheckoutScript = vi.hoisted(() => vi.fn())

vi.mock('@/services/paymentService', () => ({ getPaymentSettings }))
vi.mock('@/utils/constants', async () => ({
  ...(await vi.importActual<typeof import('@/utils/constants')>('@/utils/constants')),
  ONLINE_PAYMENTS: true,
}))
vi.mock('@/services/onlinePaymentService', async () => ({
  ...(await vi.importActual<typeof import('@/services/onlinePaymentService')>(
    '@/services/onlinePaymentService',
  )),
  createRazorpayOrder,
  openCheckout,
  loadCheckoutScript,
}))

import { PaymentPanel } from '@/components/payments/PaymentPanel'
import { OnlinePaymentError } from '@/services/onlinePaymentService'

const ORDER = { orderId: 'order_ABC123', amount: 19900, currency: 'INR', keyId: 'rzp_test_public' }

function registration(overrides: Partial<Registration> = {}): Registration {
  return {
    id: 'event-1__user-1',
    registrationCode: 'CD-2030-8F4A92',
    eventId: 'event-1',
    eventTitle: 'Sunday Guitar Jam',
    eventDate: '2030-09-22',
    eventStartTime: '17:00',
    eventVenue: 'The Humming Tree',
    eventImageURL: '',
    userId: 'user-1',
    name: 'Asha',
    email: 'asha@example.com',
    phone: '9876543210',
    participationType: 'participant',
    price: 199,
    currency: 'INR',
    paymentStatus: 'pending',
    registrationStatus: 'pending_payment',
    qrToken: 'token',
    attendanceStatus: 'not_checked_in',
    registeredAt: null,
    checkInTime: null,
    checkedInBy: '',
    cancelledAt: null,
    updatedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  getPaymentSettings.mockReset().mockResolvedValue({ upiId: 'crewday@okaxis', payeeName: 'CrewDay' })
  createRazorpayOrder.mockReset().mockResolvedValue(ORDER)
  loadCheckoutScript.mockReset().mockResolvedValue(undefined)
  openCheckout.mockReset().mockResolvedValue('dismissed')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const payButton = () => screen.findByRole('button', { name: /pay .*199.* online/i })

describe('online checkout button', () => {
  it('shows alongside the UPI option when online payments are switched on', async () => {
    render(<PaymentPanel registration={registration()} />)
    expect(await payButton()).toBeTruthy()
    expect(await screen.findByText(/crewday@okaxis/)).toBeTruthy()
  })

  it('does not appear for a confirmed registration', async () => {
    const { container } = render(
      <PaymentPanel registration={registration({ registrationStatus: 'confirmed', paymentStatus: 'paid' })} />,
    )
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('asks the server for an order by registration id only, never sending an amount', async () => {
    render(<PaymentPanel registration={registration()} />)
    fireEvent.click(await payButton())
    await waitFor(() => expect(openCheckout).toHaveBeenCalled())
    expect(createRazorpayOrder).toHaveBeenCalledTimes(1)
    expect(createRazorpayOrder.mock.calls[0]).toEqual(['event-1__user-1'])
    expect(openCheckout.mock.calls[0][0]).toEqual(ORDER)
  })

  it('waits for the server to confirm after a successful payment instead of marking it paid itself', async () => {
    openCheckout.mockResolvedValue('paid')
    render(<PaymentPanel registration={registration()} />)
    fireEvent.click(await payButton())
    expect(await screen.findByText(/confirming your seat/i)).toBeTruthy()
    // The pay button is gone while confirming, so it cannot be tapped twice.
    expect(screen.queryByRole('button', { name: /online/i })).toBeNull()
  })

  it('tells the person not to pay twice if confirmation is slow', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    openCheckout.mockResolvedValue('paid')
    render(<PaymentPanel registration={registration()} />)
    fireEvent.click(await payButton())
    await screen.findByText(/confirming your seat/i)
    await vi.advanceTimersByTimeAsync(61_000)
    expect(await screen.findByText(/do not pay again/i)).toBeTruthy()
  })

  it('goes back to idle quietly when the checkout is closed', async () => {
    openCheckout.mockResolvedValue('dismissed')
    render(<PaymentPanel registration={registration()} />)
    fireEvent.click(await payButton())
    await waitFor(() => expect(openCheckout).toHaveBeenCalled())
    expect(await payButton()).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports a declined payment and keeps both options available', async () => {
    openCheckout.mockResolvedValue('failed')
    render(<PaymentPanel registration={registration()} />)
    fireEvent.click(await payButton())
    expect(await screen.findByText(/did not go through/i)).toBeTruthy()
    expect(await payButton()).toBeTruthy()
  })

  it('points to UPI when online payment is not set up on the server', async () => {
    createRazorpayOrder.mockRejectedValue(
      new OnlinePaymentError('not-available', 'Online payment is not available right now. Pay by UPI below instead.'),
    )
    render(<PaymentPanel registration={registration()} />)
    fireEvent.click(await payButton())
    expect(await screen.findByText(/pay by upi below/i)).toBeTruthy()
    expect(openCheckout).not.toHaveBeenCalled()
  })

  it('shows a retryable error when the payment window cannot load', async () => {
    loadCheckoutScript.mockRejectedValue(new OnlinePaymentError('script-blocked', 'Could not load the payment window.'))
    render(<PaymentPanel registration={registration()} />)
    fireEvent.click(await payButton())
    expect(await screen.findByText(/could not load the payment window/i)).toBeTruthy()
    expect(openCheckout).not.toHaveBeenCalled()
    expect(await payButton()).toBeTruthy()
  })
})
