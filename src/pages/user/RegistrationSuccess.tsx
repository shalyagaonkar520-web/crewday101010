import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarPlus, PartyPopper } from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState, LoadingScreen } from '@/components/ui/Feedback'
import { QRTicket } from '@/components/qr/QRTicket'
import { getRegistration } from '@/services/registrationService'
import { combineDateTime, formatEventDate, formatTime } from '@/utils/format'
import type { Registration } from '@/types'

/** Build a calendar file so the event actually lands in someone's diary. */
function downloadIcs(registration: Registration): void {
  const start = combineDateTime(registration.eventDate, registration.eventStartTime)
  if (!start) return
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const stamp = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CrewDay//EN',
    'BEGIN:VEVENT',
    `UID:${registration.id}@crewday`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${registration.eventTitle}`,
    `LOCATION:${registration.eventVenue}`,
    `DESCRIPTION:CrewDay registration ${registration.registrationCode}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `crewday-${registration.registrationCode}.ics`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function RegistrationSuccessPage() {
  const { registrationId = '' } = useParams()
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRegistration(registrationId)
      .then(setRegistration)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [registrationId])

  if (loading) return <LoadingScreen label="Creating your ticket…" />
  if (!registration) {
    return (
      <EmptyState
        emoji="🎫"
        title="Registration not found"
        description="We could not find that registration."
        action={<LinkButton to="/my-events">Go to My Events</LinkButton>}
      />
    )
  }

  const confirmed = registration.registrationStatus === 'confirmed'

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 animate-pop items-center justify-center rounded-2xl bg-mint-500 text-white shadow-lift">
          <PartyPopper size={30} aria-hidden />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">
          {confirmed ? 'Registration Confirmed 🎉' : 'Seat held for you'}
        </h1>
        <p className="mt-2 text-ink-500">
          {confirmed
            ? `See you on ${formatEventDate(registration.eventDate)} at ${formatTime(registration.eventStartTime)}.`
            : 'Complete payment and your QR code activates automatically.'}
        </p>
      </div>

      <QRTicket registration={registration} />

      <div className="mt-6 space-y-3">
        <Button
          variant="outline"
          fullWidth
          icon={<CalendarPlus size={18} />}
          onClick={() => downloadIcs(registration)}
        >
          Add to calendar
        </Button>
        <LinkButton to="/my-events" fullWidth>
          Go to My Events
        </LinkButton>
        <LinkButton to="/explore" variant="ghost" fullWidth>
          Find another CrewDay
        </LinkButton>
      </div>
    </div>
  )
}
