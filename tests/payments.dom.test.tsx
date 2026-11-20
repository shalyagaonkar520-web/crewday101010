/**
 * The manual UPI payment panel an attendee sees while a paid registration is
 * waiting for the organiser to confirm it, and the pure link builder behind it.
 */

import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'

// The panel can show the online checkout, which links to the refund policy.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter })
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentSettings, Registration } from '@/types'

const getPaymentSettings = vi.hoisted(() => vi.fn())

vi.mock('@/services/paymentService', () => ({ getPaymentSettings }))
// These cover the UPI panel; the online checkout has its own tests. Pin it off so a
// developer's .env.local (VITE_ONLINE_PAYMENTS=true) cannot change what renders.
vi.mock('@/utils/constants', async () => ({
  ...(await vi.importActual<typeof import('@/utils/constants')>('@/utils/constants')),
  ONLINE_PAYMENTS: false,
}))

import { PaymentPanel } from '@/components/payments/PaymentPanel'
import { buildUpiLink } from '@/utils/upi'

const SETTINGS: PaymentSettings = { upiId: 'crewday@okaxis', payeeName: 'CrewDay Events' }

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

/** The query string of a upi:// link, decoded the way a UPI app would read it. */
function paramsOf(link: string): URLSearchParams {
  return new URLSearchParams(link.slice(link.indexOf('?') + 1))
}

beforeEach(() => {
  getPaymentSettings.mockReset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('buildUpiLink', () => {
  const base = {
    upiId: 'crewday@okaxis',
    payeeName: 'CrewDay Events',
    amount: 199,
    registrationCode: 'CD-2030-8F4A92',
    eventTitle: 'Sunday Guitar Jam',
  }

  it('builds a standard upi://pay link with every field', () => {
    const link = buildUpiLink(base)
    expect(link.startsWith('upi://pay?')).toBe(true)

    const params = paramsOf(link)
    expect(params.get('pa')).toBe('crewday@okaxis')
    expect(params.get('pn')).toBe('CrewDay Events')
    expect(params.get('am')).toBe('199.00')
    expect(params.get('cu')).toBe('INR')
    expect(params.get('tr')).toBe('CD-2030-8F4A92')
    expect(params.get('tn')).toBe('Sunday Guitar Jam - CD-2030-8F4A92')
  })

  it('always uses two decimals for the amount', () => {
    expect(paramsOf(buildUpiLink({ ...base, amount: 1 })).get('am')).toBe('1.00')
    expect(paramsOf(buildUpiLink({ ...base, amount: 99.5 })).get('am')).toBe('99.50')
    expect(paramsOf(buildUpiLink({ ...base, amount: 1499 })).get('am')).toBe('1499.00')
    // No thousands separator: some UPI apps reject "1,499.00".
    expect(buildUpiLink({ ...base, amount: 1499 })).toContain('am=1499.00')
  })

  it('URL-encodes every value so reserved characters cannot inject parameters', () => {
    const link = buildUpiLink({
      ...base,
      upiId: 'a&b@bank',
      payeeName: 'Rock & Roll #1 = 100%',
      eventTitle: 'Jam?x=1&y=2',
    })
    // Exactly the six expected parameters survive.
    const keys = [...paramsOf(link).keys()]
    expect(keys).toEqual(['pa', 'pn', 'am', 'cu', 'tn', 'tr'])

    expect(link).toContain('pn=Rock%20%26%20Roll%20%231%20%3D%20100%25')
    expect(link).toContain('pa=a%26b%40bank')
    expect(paramsOf(link).get('pn')).toBe('Rock & Roll #1 = 100%')
    expect(paramsOf(link).get('pa')).toBe('a&b@bank')
    expect(paramsOf(link).get('tn')).toBe('Jam?x=1&y=2 - CD-2030-8F4A92')
    // Spaces are %20, never "+".
    expect(link).not.toContain('+')
  })

  it('carries the registration code as the reference and in the note', () => {
    const params = paramsOf(buildUpiLink({ ...base, eventTitle: '' }))
    expect(params.get('tr')).toBe('CD-2030-8F4A92')
    expect(params.get('tn')).toBe('CD-2030-8F4A92')
  })

  it('shortens a long event title but never the registration code', () => {
    const link = buildUpiLink({ ...base, eventTitle: 'A very long event title '.repeat(10) })
    const note = paramsOf(link).get('tn') ?? ''
    expect(note.length).toBeLessThanOrEqual(80)
    expect(note.endsWith(' - CD-2030-8F4A92')).toBe(true)
  })

  it('refuses a zero, negative or non-numeric amount', () => {
    expect(() => buildUpiLink({ ...base, amount: 0 })).toThrow(RangeError)
    expect(() => buildUpiLink({ ...base, amount: -5 })).toThrow(RangeError)
    expect(() => buildUpiLink({ ...base, amount: Number.NaN })).toThrow(RangeError)
  })
})

describe('PaymentPanel', () => {
  it('shows the amount, a UPI deep link button, the UPI ID, the code and a QR', async () => {
    getPaymentSettings.mockResolvedValue(SETTINGS)
    const { container } = render(<PaymentPanel registration={registration()} />)

    const button = await screen.findByRole('link', { name: /pay with upi app/i })
    const href = button.getAttribute('href') ?? ''
    const params = paramsOf(href)
    expect(href.startsWith('upi://pay?')).toBe(true)
    // Amount comes from the registration's stored price.
    expect(params.get('am')).toBe('199.00')
    expect(params.get('pa')).toBe('crewday@okaxis')
    expect(params.get('tr')).toBe('CD-2030-8F4A92')

    expect(screen.getByText('₹199')).toBeTruthy()
    expect(screen.getByText('crewday@okaxis')).toBeTruthy()
    expect(screen.getByText('CD-2030-8F4A92')).toBeTruthy()
    expect(screen.getByText(/seat is held for you/i)).toBeTruthy()
    expect(screen.getByText(/marks it as received/i)).toBeTruthy()

    // The QR encodes the same link.
    expect(container.querySelector('svg title')?.textContent).toMatch(/upi payment qr code/i)
    expect(container.querySelector('svg path')).toBeTruthy()
  })

  it('copies the UPI ID to the clipboard', async () => {
    getPaymentSettings.mockResolvedValue(SETTINGS)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<PaymentPanel registration={registration()} />)

    fireEvent.click(await screen.findByRole('button', { name: /copy upi id/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('crewday@okaxis'))
    expect(await screen.findByText('Copied')).toBeTruthy()
  })

  it('shows a clear message instead of a broken button when payments are not set up', async () => {
    getPaymentSettings.mockResolvedValue(null)
    const { container } = render(<PaymentPanel registration={registration()} />)

    expect(await screen.findByText(/hasn.t set up payments yet/i)).toBeTruthy()
    expect(screen.getByText(/contact them/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /pay with upi app/i })).toBeNull()
    expect(container.querySelector('svg path')).toBeNull()
    // The amount owed is still stated.
    expect(screen.getByText('₹199')).toBeTruthy()
  })

  it('offers a retry when the payment details cannot be loaded', async () => {
    getPaymentSettings.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(SETTINGS)
    render(<PaymentPanel registration={registration()} />)

    expect(await screen.findByText(/could not load the payment details/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByRole('link', { name: /pay with upi app/i })).toBeTruthy()
  })

  it('does not offer UPI for an event priced in another currency', async () => {
    getPaymentSettings.mockResolvedValue(SETTINGS)
    render(<PaymentPanel registration={registration({ currency: 'USD' })} />)

    expect(await screen.findByText(/cannot be paid by upi/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /pay with upi app/i })).toBeNull()
  })

  it('renders the online checkout slot above the UPI option', async () => {
    getPaymentSettings.mockResolvedValue(SETTINGS)
    render(
      <PaymentPanel
        registration={registration()}
        onlineCheckout={<button type="button">Pay online</button>}
      />,
    )

    const online = screen.getByRole('button', { name: /pay online/i })
    const upi = await screen.findByRole('link', { name: /pay with upi app/i })
    expect(online.compareDocumentPosition(upi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    ['confirmed', { registrationStatus: 'confirmed', paymentStatus: 'paid' }],
    ['cancelled', { registrationStatus: 'cancelled' }],
    ['a free confirmed seat', { registrationStatus: 'confirmed', paymentStatus: 'not_required', price: 0 }],
  ] as const)('renders nothing for %s registrations and never loads settings', (_label, change) => {
    const { container } = render(
      <PaymentPanel registration={registration(change as Partial<Registration>)} />,
    )
    expect(container.innerHTML).toBe('')
    expect(getPaymentSettings).not.toHaveBeenCalled()
  })

  it('disappears when the registration becomes confirmed', async () => {
    getPaymentSettings.mockResolvedValue(SETTINGS)
    const { rerender, container } = render(<PaymentPanel registration={registration()} />)
    expect(await screen.findByRole('link', { name: /pay with upi app/i })).toBeTruthy()

    rerender(
      <PaymentPanel
        registration={registration({ registrationStatus: 'confirmed', paymentStatus: 'paid' })}
      />,
    )
    expect(container.innerHTML).toBe('')
  })
})
