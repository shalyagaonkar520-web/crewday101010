import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react'
import { Button, LinkButton } from '@/components/ui/Button'
import { Badge, Card, StatTile } from '@/components/ui/Card'
import { Select } from '@/components/ui/Field'
import { EmptyState, Spinner } from '@/components/ui/Feedback'
import { QRScanner } from '@/components/qr/QRScanner'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { listCheckInEvents, subscribeToEvent } from '@/services/eventService'
import { checkInByQr, type CheckInOutcome } from '@/services/registrationService'
import { trackSync } from '@/services/analyticsService'
import { parseQrPayload } from '@/utils/ids'
import { formatClockTime, formatEventDateShort, formatPercent } from '@/utils/format'
import type { CrewEvent } from '@/types'

type ScanState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'result'; outcome: CheckInOutcome }
  | { kind: 'malformed' }

const INVALID_REASONS: Record<string, string> = {
  not_found: 'Registration not found',
  wrong_event: 'Ticket is for a different event',
  cancelled: 'Registration was cancelled',
  unpaid: 'Payment not completed',
  bad_token: 'QR code is not valid',
  malformed: 'Not a CrewDay ticket',
}

function ResultPanel({ state, onReset }: { state: ScanState; onReset: () => void }) {
  if (state.kind === 'idle') return null

  if (state.kind === 'checking') {
    return (
      <Card className="flex items-center gap-3 p-5">
        <Spinner className="h-5 w-5" />
        <p className="font-semibold text-ink-700">Verifying ticket…</p>
      </Card>
    )
  }

  if (state.kind === 'malformed') {
    return (
      <Card className="border-sunset-200 bg-sunset-50 p-5">
        <div className="flex items-start gap-3">
          <XCircle className="shrink-0 text-sunset-600" size={26} aria-hidden />
          <div className="flex-1">
            <h3 className="font-display text-xl font-extrabold text-sunset-800">❌ INVALID TICKET</h3>
            <p className="mt-1 text-sm text-sunset-700">
              That code is not a CrewDay ticket. Ask the attendee to open their ticket from My
              Events.
            </p>
          </div>
        </div>
        <Button variant="outline" className="mt-4" onClick={onReset} icon={<RotateCcw size={16} />}>
          Scan next
        </Button>
      </Card>
    )
  }

  const { outcome } = state

  if (outcome.result === 'valid') {
    const { registration } = outcome
    return (
      <Card className="animate-pop border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="shrink-0 text-emerald-600" size={26} aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-extrabold text-emerald-800">✅ VALID TICKET</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-emerald-700">Name</dt>
                <dd className="font-semibold text-ink-900">{registration.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-emerald-700">Event</dt>
                <dd className="font-semibold text-ink-900">{registration.eventTitle}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-emerald-700">Registration</dt>
                <dd className="font-mono font-semibold text-ink-900">
                  {registration.registrationCode}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-emerald-700">Joining as</dt>
                <dd className="font-semibold text-ink-900 capitalize">
                  {registration.participationType}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-emerald-700">Status</dt>
                <dd>
                  <Badge tone="success">CHECKED IN</Badge>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <Button className="mt-4" onClick={onReset} icon={<RotateCcw size={16} />}>
          Scan next
        </Button>
      </Card>
    )
  }

  if (outcome.result === 'already_checked_in') {
    return (
      <Card className="animate-pop border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="shrink-0 text-amber-600" size={26} aria-hidden />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-extrabold text-amber-900">
              ⚠️ ALREADY CHECKED IN
            </h3>
            <p className="mt-1 font-semibold text-ink-900">{outcome.registration.name}</p>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-800">
              <Clock size={15} aria-hidden />
              Checked in at {formatClockTime(outcome.registration.checkInTime)}
            </p>
            <p className="mt-1 font-mono text-sm text-ink-600">
              {outcome.registration.registrationCode}
            </p>
          </div>
        </div>
        <Button variant="outline" className="mt-4" onClick={onReset} icon={<RotateCcw size={16} />}>
          Scan next
        </Button>
      </Card>
    )
  }

  return (
    <Card className="animate-pop border-sunset-200 bg-sunset-50 p-5">
      <div className="flex items-start gap-3">
        <XCircle className="shrink-0 text-sunset-600" size={26} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-extrabold text-sunset-800">❌ INVALID TICKET</h3>
          <p className="mt-1 text-sm font-semibold text-sunset-700">
            {INVALID_REASONS[outcome.code] ?? 'This ticket cannot be accepted'}
          </p>
          {outcome.name ? (
            <p className="mt-2 text-lg font-bold text-ink-900">{outcome.name}</p>
          ) : null}
          <p className="mt-1 text-sm text-sunset-800">{outcome.message}</p>
          {outcome.registrationCode ? (
            <p className="mt-2 font-mono text-sm text-ink-600">{outcome.registrationCode}</p>
          ) : null}
          <p className="mt-3 text-xs text-sunset-700">
            Check the attendee is at the right event, then look them up in the attendee list.
          </p>
        </div>
      </div>
      <Button variant="outline" className="mt-4" onClick={onReset} icon={<RotateCcw size={16} />}>
        Scan next
      </Button>
    </Card>
  )
}

/**
 * A door log for the current session.
 *
 * The result card is replaced by the next scan, but an organiser needs to see
 * who they have just let through — to answer "did you already scan me?" and to
 * spot a run of failures without digging through the attendee table.
 */
interface ScanLogEntry {
  id: string
  at: Date
  name: string
  code: string
  tone: 'valid' | 'duplicate' | 'invalid'
  detail: string
}

function ScanLog({ entries, onClear }: { entries: ScanLogEntry[]; onClear: () => void }) {
  if (!entries.length) return null

  const TONE: Record<ScanLogEntry['tone'], { dot: string; label: string }> = {
    valid: { dot: 'bg-emerald-500', label: 'Checked in' },
    duplicate: { dot: 'bg-amber-500', label: 'Duplicate' },
    invalid: { dot: 'bg-sunset-500', label: 'Rejected' },
  }

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
        <h2 className="font-display font-bold text-ink-900">
          This session
          <span className="ml-2 text-sm font-semibold text-ink-500">
            {entries.filter((entry) => entry.tone === 'valid').length} checked in
          </span>
        </h2>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
      <ul className="divide-y divide-ink-100">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE[entry.tone].dot}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink-900">{entry.name}</p>
              <p className="truncate text-xs text-ink-500">
                {TONE[entry.tone].label}
                {entry.detail ? ` · ${entry.detail}` : ''}
                {entry.code ? ` · ${entry.code}` : ''}
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-ink-400">
              {entry.at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function CheckInPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { error: toastError } = useToast()

  const [events, setEvents] = useState<CrewEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selectedId, setSelectedId] = useState(searchParams.get('event') ?? '')
  const [liveEvent, setLiveEvent] = useState<CrewEvent | null>(null)
  const [state, setState] = useState<ScanState>({ kind: 'idle' })
  const [log, setLog] = useState<ScanLogEntry[]>([])

  // Guards against the decoder firing the same frame dozens of times a second.
  const lastScan = useRef<{ value: string; at: number }>({ value: '', at: 0 })
  const inFlight = useRef(false)

  useEffect(() => {
    listCheckInEvents()
      .then((list) => {
        setEvents(list)
        setSelectedId((current) => current || list[0]?.id || '')
      })
      .catch(() => toastError('We could not load your events.'))
      .finally(() => setLoadingEvents(false))
  }, [toastError])

  useEffect(() => {
    if (!selectedId) {
      setLiveEvent(null)
      return
    }
    return subscribeToEvent(selectedId, setLiveEvent)
  }, [selectedId])

  const handleScan = useCallback(
    (raw: string) => {
      if (inFlight.current || !user || !selectedId) return

      const now = Date.now()
      if (lastScan.current.value === raw && now - lastScan.current.at < 3000) return
      lastScan.current = { value: raw, at: now }

      const payload = parseQrPayload(raw)
      if (!payload) {
        setState({ kind: 'malformed' })
        setLog((current) =>
          [
            {
              id: crypto.randomUUID(),
              at: new Date(),
              name: 'Unrecognised code',
              code: '',
              tone: 'invalid' as const,
              detail: 'Not a CrewDay ticket',
            },
            ...current,
          ].slice(0, 25),
        )
        return
      }

      inFlight.current = true
      setState({ kind: 'checking' })

      checkInByQr(payload, selectedId, user.uid)
        .then((outcome) => {
          setState({ kind: 'result', outcome })

          const entry: ScanLogEntry =
            outcome.result === 'valid'
              ? {
                  id: crypto.randomUUID(),
                  at: new Date(),
                  name: outcome.registration.name,
                  code: outcome.registration.registrationCode,
                  tone: 'valid',
                  detail: outcome.registration.participationType,
                }
              : outcome.result === 'already_checked_in'
                ? {
                    id: crypto.randomUUID(),
                    at: new Date(),
                    name: outcome.registration.name,
                    code: outcome.registration.registrationCode,
                    tone: 'duplicate',
                    detail: `already in at ${formatClockTime(outcome.registration.checkInTime)}`,
                  }
                : {
                    id: crypto.randomUUID(),
                    at: new Date(),
                    name: outcome.name ?? 'Unknown ticket',
                    code: outcome.registrationCode ?? '',
                    tone: 'invalid',
                    detail: INVALID_REASONS[outcome.code] ?? 'Rejected',
                  }
          setLog((current) => [entry, ...current].slice(0, 25))

          if (outcome.result === 'valid') {
            trackSync('event_attended', { eventId: selectedId })
            // A short vibration is the fastest feedback at a noisy door.
            navigator.vibrate?.(60)
          }
        })
        .catch(() => {
          toastError('Check-in failed. Please try that ticket again.')
          setState({ kind: 'idle' })
        })
        .finally(() => {
          inFlight.current = false
        })
    },
    [selectedId, user, toastError],
  )

  const reset = () => {
    lastScan.current = { value: '', at: 0 }
    setState({ kind: 'idle' })
  }

  if (loadingEvents) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }

  if (!events.length) {
    return (
      <EmptyState
        emoji="📷"
        title="No events to check in to"
        description="Publish an event first, then come back here to scan tickets at the door."
        action={<LinkButton to="/admin/events/new">Create event</LinkButton>}
      />
    )
  }

  const attendanceRate =
    liveEvent && liveEvent.registeredCount > 0
      ? (liveEvent.checkedInCount / liveEvent.registeredCount) * 100
      : 0

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold text-ink-900">Event Check-In</h1>
      <p className="mt-1 text-ink-500">Scan an attendee&apos;s QR code to mark them present.</p>

      <div className="mt-5">
        <Select
          label="Which event?"
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value)
            setSearchParams({ event: event.target.value }, { replace: true })
            setLog([])
            reset()
          }}
          options={events.map((event) => ({
            value: event.id,
            label: `${event.title} — ${formatEventDateShort(event.date)}`,
          }))}
        />
      </div>

      {liveEvent ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatTile label="Registered" value={liveEvent.registeredCount} />
          <StatTile label="Checked in" value={liveEvent.checkedInCount} tone="success" />
          <StatTile label="Attendance" value={formatPercent(attendanceRate)} tone="brand" />
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <QRScanner onScan={handleScan} paused={state.kind !== 'idle'} />
        <ResultPanel state={state} onReset={reset} />
      </div>

      <ScanLog entries={log} onClear={() => setLog([])} />

      {selectedId ? (
        <div className="mt-6">
          <LinkButton to={`/admin/events/${selectedId}/attendees`} variant="outline" fullWidth>
            Open attendee list
          </LinkButton>
          <p className="mt-2 text-center text-xs text-ink-500">
            Phone battery dead? Check someone in manually from the attendee list.
          </p>
        </div>
      ) : null}
    </div>
  )
}
