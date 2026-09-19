import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, Send, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { Button, LinkButton } from '@/components/ui/Button'
import { Badge, Card } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { InlineAlert, Skeleton } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  submitEventRequest,
  subscribeToMyRequests,
  withdrawEventRequest,
} from '@/services/eventRequestService'
import { EVENT_CATEGORIES, LAUNCH_AREA, LAUNCH_CITY } from '@/utils/constants'
import { formatEventDateShort, formatPrice, isoDaysFromNow } from '@/utils/format'
import { isPhone } from '@/utils/validation'
import type { EventAudienceType, EventRequest, EventRequestDraft } from '@/types'

const STATUS_TONE = {
  pending: { tone: 'warning' as const, icon: Clock, label: 'Awaiting review' },
  approved: { tone: 'success' as const, icon: CheckCircle2, label: 'Approved' },
  rejected: { tone: 'danger' as const, icon: XCircle, label: 'Not this time' },
  withdrawn: { tone: 'neutral' as const, icon: XCircle, label: 'Withdrawn' },
}

function emptyDraft(): EventRequestDraft {
  return {
    title: '',
    description: '',
    category: '',
    date: isoDaysFromNow(10),
    startTime: '18:00',
    endTime: '',
    venue: '',
    address: '',
    area: LAUNCH_AREA,
    capacity: 20,
    price: 0,
    eventTypes: ['both'],
    requesterPhone: '',
  }
}

function MyRequests({ requests, loading }: { requests: EventRequest[]; loading: boolean }) {
  const { success, error } = useToast()
  const [target, setTarget] = useState<EventRequest | null>(null)
  const [busy, setBusy] = useState(false)

  const withdraw = async () => {
    if (!target) return
    setBusy(true)
    try {
      await withdrawEventRequest(target.id)
      success('Request withdrawn.')
      setTarget(null)
    } catch {
      error('Could not withdraw that request.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Skeleton className="h-24 w-full rounded-card" />
  if (!requests.length) return null

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Your requests</h2>
      <ul className="space-y-3">
        {requests.map((request) => {
          const meta = STATUS_TONE[request.status]
          return (
            <Card as="li" key={request.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900">{request.title}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {formatEventDateShort(request.date)} · {request.venue || request.area} ·{' '}
                    {formatPrice(request.price, request.currency)}
                  </p>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>

              {request.reviewNote ? (
                <p className="mt-3 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-sm text-ink-700">
                  <span className="font-semibold">Organiser: </span>
                  {request.reviewNote}
                </p>
              ) : null}

              {request.status === 'pending' ? (
                <button
                  type="button"
                  onClick={() => setTarget(request)}
                  className="mt-3 text-sm font-semibold text-sunset-600 hover:underline"
                >
                  Withdraw request
                </button>
              ) : null}
            </Card>
          )
        })}
      </ul>

      <ConfirmDialog
        open={Boolean(target)}
        title="Withdraw this request?"
        description="The organisers will no longer see it. You can always submit a new one."
        confirmLabel="Withdraw"
        loading={busy}
        onConfirm={() => void withdraw()}
        onCancel={() => setTarget(null)}
      />
    </section>
  )
}

/**
 * Member-submitted event proposal.
 *
 * This writes to `eventRequests`, never to `events` — an organiser reviews it
 * and creates the real listing. That keeps discovery, pricing and capacity out
 * of reach of a member's credentials.
 */
export default function SuggestEventPage() {
  const navigate = useNavigate()
  const { user, profile, isGuest } = useAuth()
  const { success } = useToast()

  const [draft, setDraft] = useState<EventRequestDraft>(emptyDraft)
  const [requests, setRequests] = useState<EventRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.phone) setDraft((current) => ({ ...current, requesterPhone: current.requesterPhone || profile.phone }))
  }, [profile])

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToMyRequests(
      user.uid,
      (list) => {
        setRequests(list)
        setLoadingRequests(false)
      },
      () => setLoadingRequests(false),
    )
    return unsubscribe
  }, [user])

  const patch = (next: Partial<EventRequestDraft>) => setDraft((current) => ({ ...current, ...next }))

  const errors = {
    title: touched && draft.title.trim().length < 4 ? 'Give your event a name.' : undefined,
    description:
      touched && draft.description.trim().length < 20
        ? 'Tell people what actually happens — at least a couple of sentences.'
        : undefined,
    category: touched && !draft.category ? 'Pick a category.' : undefined,
    venue: touched && !draft.venue.trim() ? 'Where should people meet?' : undefined,
    requesterPhone:
      touched && !isPhone(draft.requesterPhone) ? 'A valid 10 digit number, so we can reach you.' : undefined,
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!user || !profile) return

    if (Object.values(errors).some(Boolean) || !draft.category || draft.title.trim().length < 4) {
      setFormError('Please fix the highlighted fields.')
      return
    }

    setFormError(null)
    setSubmitting(true)
    try {
      await submitEventRequest(draft, profile)
      success('Request sent. An organiser will review it shortly.')
      setDraft({ ...emptyDraft(), requesterPhone: draft.requesterPhone })
      setTouched(false)
    } catch {
      setFormError('We could not send your request. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const audienceOptions: { value: EventAudienceType; emoji: string; label: string }[] = [
    { value: 'participant', emoji: '🎤', label: 'Participants' },
    { value: 'audience', emoji: '👀', label: 'Audience' },
    { value: 'both', emoji: '🤝', label: 'Both' },
  ]

  // An organiser has to be able to reach whoever proposed an event. A guest
  // has no persistent identity to reach, so the door is a save-your-account
  // prompt rather than a form that would go nowhere.
  if (isGuest) {
    return (
      <div className="mx-auto max-w-md pt-6 text-center">
        <span className="text-5xl" aria-hidden>💡</span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">Got an event idea?</h1>
        <p className="mt-2 text-ink-500">
          Save your account first so the organisers can get back to you about it. Your booked
          tickets come with you.
        </p>
        <div className="mt-6 space-y-3">
          <LinkButton to="/signup" fullWidth size="lg">
            Save my account
          </LinkButton>
          <LinkButton to="/explore" fullWidth variant="ghost">
            Keep browsing
          </LinkButton>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft size={16} aria-hidden /> Back
      </button>

      <h1 className="font-display text-2xl font-bold text-ink-900">Host your own CrewDay</h1>
      <p className="mt-1 text-ink-500">
        Got an idea? Send it to the CrewDay team. If they like it, they will set it up and put it in
        front of everyone in {LAUNCH_AREA}.
      </p>

      <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-5" noValidate>
        <Card className="space-y-4 p-5">
          <Input
            label="What is it?"
            required
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            error={errors.title}
            placeholder="Sunday Acoustic Jam"
          />
          <Textarea
            label="What happens?"
            required
            rows={5}
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
            error={errors.description}
            placeholder="Who is it for, what will you do, what should people bring?"
          />
          <Select
            label="Category"
            required
            placeholder="Choose one"
            value={draft.category}
            onChange={(event) => patch({ category: event.target.value })}
            error={errors.category}
            options={EVENT_CATEGORIES.map((category) => ({ value: category, label: category }))}
          />
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-display font-bold text-ink-900">When &amp; where</h2>
          <Input
            type="date"
            label="Date"
            required
            value={draft.date}
            onChange={(event) => patch({ date: event.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="time"
              label="Start time"
              required
              value={draft.startTime}
              onChange={(event) => patch({ startTime: event.target.value })}
            />
            <Input
              type="time"
              label="End time"
              hint="Optional"
              value={draft.endTime}
              onChange={(event) => patch({ endTime: event.target.value })}
            />
          </div>
          <Input
            label="Venue"
            required
            value={draft.venue}
            onChange={(event) => patch({ venue: event.target.value })}
            error={errors.venue}
            placeholder="The Hive, Electronic City"
          />
          <Input
            label="Area"
            value={draft.area}
            onChange={(event) => patch({ area: event.target.value })}
            hint={`CrewDay currently runs in ${LAUNCH_AREA}, ${LAUNCH_CITY}.`}
          />
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-display font-bold text-ink-900">Who and how many</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="number"
              min={1}
              label="How many people?"
              required
              value={String(draft.capacity)}
              onChange={(event) => patch({ capacity: Number(event.target.value) })}
            />
            <Input
              type="number"
              min={0}
              label="Suggested price"
              value={String(draft.price)}
              leading={<span className="font-semibold">₹</span>}
              onChange={(event) => patch({ price: Number(event.target.value) })}
              hint="0 for free. Organisers decide the final price."
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink-800">Open to</legend>
            <div className="grid grid-cols-3 gap-2">
              {audienceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => patch({ eventTypes: [option.value] })}
                  aria-pressed={draft.eventTypes[0] === option.value}
                  className={clsx(
                    'rounded-2xl px-2 py-3 text-center text-sm font-semibold transition',
                    draft.eventTypes[0] === option.value
                      ? 'bg-brand-500 text-white shadow-pink'
                      : 'bg-white text-ink-700 ring-1 ring-ink-200 hover:ring-brand-300',
                  )}
                >
                  <span className="block text-lg" aria-hidden>
                    {option.emoji}
                  </span>
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <Input
            label="Your phone number"
            required
            value={draft.requesterPhone}
            onChange={(event) => patch({ requesterPhone: event.target.value })}
            error={errors.requesterPhone}
            inputMode="tel"
            hint="Only the organisers see this."
          />
        </Card>

        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}

        <Button type="submit" fullWidth size="lg" loading={submitting} icon={<Send size={18} />}>
          Send request
        </Button>

        <p className="text-center text-xs text-ink-500">
          Organisers review every request. You will get a notification either way.
        </p>
      </form>

      <MyRequests requests={requests} loading={loadingRequests} />

      <div className="mt-8 text-center">
        <LinkButton to="/explore" variant="ghost">
          Browse existing events instead
        </LinkButton>
      </div>

      <p className="mt-4 text-center text-xs text-ink-400">
        By submitting you agree to our{' '}
        <Link to="/terms" className="font-semibold text-brand-500 hover:underline">
          Terms
        </Link>
        .
      </p>
    </div>
  )
}
