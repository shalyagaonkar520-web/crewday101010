import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InlineAlert } from '@/components/ui/Feedback'
import { useToast } from '@/hooks/useToast'
import { payForRegistration, PaymentError } from '@/services/paymentService'
import { formatPrice } from '@/utils/format'
import type { Registration } from '@/types'

/**
 * The one call to action on a seat that is held but unpaid.
 *
 * Opens Razorpay Checkout for exactly the amount stored on the registration
 * and reports the outcome. Closing the sheet is not an error -- the seat is
 * still held, so the copy says so instead of shouting.
 */
export function PayNowButton({
  registration,
  onPaid,
}: {
  registration: Registration
  onPaid?: () => void
}) {
  const { success, info } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pay = async () => {
    setError(null)
    setBusy(true)
    try {
      const outcome = await payForRegistration(registration)
      if (outcome === 'paid') {
        success('Payment received — your seat is confirmed 🎉')
        onPaid?.()
      } else {
        info('No payment made. Your seat is still held — pay whenever you are ready.')
      }
    } catch (caught) {
      setError(
        caught instanceof PaymentError || caught instanceof Error
          ? caught.message
          : 'Payment could not be completed. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const failedBefore = registration.paymentStatus === 'failed'

  return (
    <div className="space-y-3">
      {failedBefore && !error ? (
        <InlineAlert tone="warning">
          Your last payment attempt did not go through
          {registration.payment?.failureReason ? ` (${registration.payment.failureReason})` : ''}.
          Your seat is still held — try again below.
        </InlineAlert>
      ) : null}

      <Button
        type="button"
        fullWidth
        size="lg"
        loading={busy}
        icon={<LockKeyhole size={18} />}
        onClick={() => void pay()}
      >
        Pay {formatPrice(registration.price, registration.currency)} securely
      </Button>

      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

      <p className="text-center text-xs text-ink-500">
        UPI, cards, netbanking and wallets via Razorpay. Your QR ticket activates the moment the
        payment goes through.
      </p>
    </div>
  )
}
