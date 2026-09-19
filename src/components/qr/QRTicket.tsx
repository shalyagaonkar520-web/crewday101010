import { QRCodeCanvas } from 'qrcode.react'
import { Calendar, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import type { Registration } from '@/types'
import { buildQrPayload } from '@/utils/ids'
import { formatClockTime, formatEventDate, formatTime } from '@/utils/format'

function StatusBadge({ registration }: { registration: Registration }) {
  if (registration.registrationStatus === 'cancelled') return <Badge tone="danger">CANCELLED</Badge>
  if (registration.attendanceStatus === 'checked_in')
    return <Badge tone="success">CHECKED IN</Badge>
  if (registration.registrationStatus === 'pending_payment')
    return <Badge tone="warning">PAYMENT PENDING</Badge>
  if (registration.registrationStatus === 'waitlisted') return <Badge tone="neutral">WAITLISTED</Badge>
  return <Badge tone="brand">REGISTERED</Badge>
}

/**
 * The attendee's ticket.
 *
 * The QR encodes `CDQR1|registrationId|qrToken` and nothing else — no name, no
 * phone, no email — so a photo of someone's ticket leaks no personal data. The
 * code is greyed out once it can no longer be scanned.
 */
export function QRTicket({ registration }: { registration: Registration }) {
  const scannable =
    registration.registrationStatus === 'confirmed' &&
    registration.attendanceStatus !== 'checked_in'

  return (
    <div className="overflow-hidden rounded-card bg-white shadow-lift ring-1 ring-ink-100/70">
      {registration.eventImageURL ? (
        <div className="relative h-40 overflow-hidden bg-ink-100">
          <img src={registration.eventImageURL} alt="" className="h-full w-full object-cover" />
          <span className="absolute bottom-3 left-4 rounded-full bg-brand-500 px-3 py-1 text-[0.7rem] font-semibold text-white shadow-soft">
            CrewDay ticket
          </span>
        </div>
      ) : null}

      <div className="px-5 pt-5">
        <h2 className="font-display text-lg leading-tight font-bold text-ink-900">
          {registration.eventTitle}
        </h2>
        <div className="mt-2.5 grid gap-1.5 text-sm text-ink-600">
          <p className="flex items-center gap-2">
            <Calendar size={15} className="text-sky-400" aria-hidden />
            {formatEventDate(registration.eventDate)} · {formatTime(registration.eventStartTime)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={15} className="text-brand-400" aria-hidden />
            {registration.eventVenue}
          </p>
        </div>
      </div>

      {/* Perforation */}
      <div className="relative mt-5 h-6">
        <span className="absolute top-1/2 -left-3 h-6 w-6 -translate-y-1/2 rounded-full bg-[#fdf7fb]" />
        <span className="absolute top-1/2 -right-3 h-6 w-6 -translate-y-1/2 rounded-full bg-[#fdf7fb]" />
        <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-ink-200" />
      </div>

      <div className="flex flex-col items-center gap-4 px-5 pb-6">
        <div
          className={
            scannable
              ? 'rounded-3xl bg-linear-to-br from-brand-50 via-grape-50 to-sky-50 p-6 shadow-soft'
              : 'rounded-3xl bg-ink-100 p-6 opacity-40 grayscale'
          }
        >
          <QRCodeCanvas
            value={buildQrPayload(registration.id, registration.qrToken)}
            size={196}
            level="M"
            marginSize={2}
            title="CrewDay ticket QR code"
          />
        </div>

        {!scannable ? (
          <p className="text-center text-sm font-medium text-ink-500">
            {registration.attendanceStatus === 'checked_in'
              ? `Checked in at ${formatClockTime(registration.checkInTime)}`
              : registration.registrationStatus === 'cancelled'
                ? 'This registration was cancelled.'
                : 'Your QR code activates once payment is confirmed.'}
          </p>
        ) : (
          <p className="w-full rounded-2xl bg-sky-50 px-4 py-3 text-center text-sm text-sky-700">
            Show this QR code at the venue for quick check-in.
          </p>
        )}

        <div className="w-full space-y-2 rounded-2xl bg-ink-50 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-500">Registration ID</span>
            <span className="font-mono font-bold text-ink-900">{registration.registrationCode}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-500">Joining as</span>
            <span className="font-semibold text-ink-900 capitalize">
              {registration.participationType === 'participant' ? '🎤 Participant' : '👀 Audience'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-500">Status</span>
            <StatusBadge registration={registration} />
          </div>
        </div>
      </div>
    </div>
  )
}
