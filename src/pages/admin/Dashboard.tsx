import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarCheck,
  CalendarPlus,
  IndianRupee,
  QrCode,
  TicketCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import clsx from 'clsx'
import { Card, SectionHeading, StatTile } from '@/components/ui/Card'
import { ClayCardTitle, ClayStat } from '@/components/ui/Clay'
import { LinkButton } from '@/components/ui/Button'
import { ErrorState, InlineAlert, Skeleton } from '@/components/ui/Feedback'
import { EventImage } from '@/components/events/EventCard'
import { getDashboardStats, getFunnelStats, type DashboardStats, type FunnelStats } from '@/services/adminService'
import { listPublishedEvents } from '@/services/eventService'
import { seedInterestsIfEmpty } from '@/services/interestService'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { EMPTY_FILTERS, type CrewEvent } from '@/types'
import { formatEventDateShort, formatNumber, formatPercent, formatPrice, formatTime } from '@/utils/format'

/* ------------------------------ Clay pieces ------------------------------ */

const BAR_COLOURS = ['bg-brand-400', 'bg-sky-300', 'bg-[#ffb35c]', 'bg-[#ffd666]', 'bg-[#8ccf9b]']

/** The growth funnel as rounded candy bars. */
function FunnelBars({ funnel }: { funnel: FunnelStats }) {
  const steps = [
    { label: 'Signed up', value: funnel.signedUp },
    { label: 'Profile', value: funnel.profilesCompleted },
    { label: 'Registered', value: funnel.registeredForEvent },
    { label: 'Attended', value: funnel.attended },
    { label: 'Returned', value: funnel.repeatAttenders },
  ]
  const max = Math.max(1, funnel.signedUp)
  return (
    <div className="flex h-44 items-end justify-between gap-3 border-b border-ink-200 px-1">
      {steps.map((step, index) => (
        <div key={step.label} className="flex h-full flex-1 flex-col items-center justify-end">
          <span className="mb-1 text-xs font-bold tabular-nums text-ink-700">{formatNumber(step.value)}</span>
          <div
            className={clsx('w-full max-w-10 rounded-t-xl rounded-b-md', BAR_COLOURS[index])}
            style={{ height: `${Math.max(6, (step.value / max) * 78)}%` }}
            title={`${step.label}: ${step.value}`}
          />
          <span className="mt-1.5 mb-[-1.6rem] text-[0.68rem] font-semibold text-ink-500">{step.label}</span>
        </div>
      ))}
    </div>
  )
}

const DONUT_COLOURS = ['#a685f3', '#f97ba4', '#ffc94d', '#8ccf9b', '#8fa6f5']

/** Popular interests as a donut with a percentage legend. */
function InterestDonut({ interests }: { interests: { name: string; count: number }[] }) {
  const top = interests.slice(0, 4)
  const otherCount = interests.slice(4).reduce((sum, item) => sum + item.count, 0)
  const slices = otherCount > 0 ? [...top, { name: 'Other', count: otherCount }] : top
  const total = slices.reduce((sum, item) => sum + item.count, 0) || 1
  const stops = slices
    .map((slice, index) => {
      const before = slices.slice(0, index).reduce((sum, item) => sum + item.count, 0)
      const from = (before / total) * 100
      const to = ((before + slice.count) / total) * 100
      return `${DONUT_COLOURS[index]} ${from}% ${to}%`
    })
    .join(', ')

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-32 w-32 shrink-0 rounded-full shadow-soft"
        style={{ background: `conic-gradient(${stops})` }}
        role="img"
        aria-label="Share of members by interest"
      >
        <div className="absolute inset-[26%] rounded-full bg-white shadow-inner" />
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice, index) => (
          <li key={slice.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLOURS[index] }} />
            <span className="min-w-0 flex-1 truncate font-semibold text-ink-700">{slice.name}</span>
            <span className="shrink-0 font-bold tabular-nums text-ink-900">
              {Math.round((slice.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* --------------------------------- Page --------------------------------- */

export default function AdminDashboardPage() {
  const { user, profile } = useAuth()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const greetingEmoji = hour < 12 ? '☀️' : hour < 17 ? '🌤️' : '🌙'
  const firstName = profile?.name?.split(' ')[0]
  const { success, error: toastError } = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [funnel, setFunnel] = useState<FunnelStats | null>(null)
  const [upcoming, setUpcoming] = useState<CrewEvent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    // Settled, not all: the funnel failing should not take the headline
    // numbers down with it, and vice versa.
    Promise.allSettled([
      getDashboardStats(),
      getFunnelStats(),
      listPublishedEvents({ filters: EMPTY_FILTERS, pageSize: 4 }),
    ])
      .then(([dashboard, funnelStats, events]) => {
        if (dashboard.status === 'fulfilled') setStats(dashboard.value)
        if (funnelStats.status === 'fulfilled') setFunnel(funnelStats.value)
        setUpcoming(events.status === 'fulfilled' ? events.value.events : [])
        if (dashboard.status === 'rejected') {
          setError('We could not load dashboard data. Check your admin access and connection.')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const onSeed = async () => {
    if (!user) return
    setSeeding(true)
    try {
      const count = await seedInterestsIfEmpty(user.uid)
      if (count) success(`Added ${count} starter interests.`)
      else success('Interests already exist — nothing to seed.')
    } catch {
      toastError('Could not seed interests.')
    } finally {
      setSeeding(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-40 w-full rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-3xl" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return <ErrorState description={error ?? 'No data available.'} onRetry={load} />
  }

  const nextUp = upcoming?.[0]
  const moreNumbers = [
    { label: 'New users today', value: formatNumber(stats.users.newToday) },
    { label: 'Active (30 days)', value: formatNumber(stats.users.active) },
    { label: 'Suspended', value: formatNumber(stats.users.suspended) },
    { label: 'Completed events', value: formatNumber(stats.events.completed) },
    { label: 'Drafts', value: formatNumber(stats.events.drafts) },
    { label: 'Cancelled events', value: formatNumber(stats.events.cancelled) },
    { label: 'Registrations today', value: formatNumber(stats.registrations.today) },
    { label: 'No-show rate', value: formatPercent(stats.attendance.noShowRate) },
  ]

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <header className="relative overflow-hidden rounded-[2rem] bg-[#d5b8e2] px-5 py-5 shadow-soft ring-1 ring-white/70 sm:px-7">
        <div className="flex items-center gap-5">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold text-ink-900">
              {greeting}
              {firstName ? `, ${firstName}` : ''}! {greetingEmoji}
            </h1>
            <p className="mt-1 text-sm text-ink-600">Let’s make someone’s weekend today!</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton to="/admin/events/new" size="sm" icon={<CalendarPlus size={16} />}>
                Create Event
              </LinkButton>
              <LinkButton
                to="/admin/check-in"
                size="sm"
                variant="ghost"
                className="bg-white text-brand-600 shadow-soft hover:bg-white"
                icon={<QrCode size={16} />}
              >
                Check-in
              </LinkButton>
            </div>
          </div>
          <img
            src="/brand/ref/plant-dash.png"
            alt=""
            className="-my-3 hidden h-32 w-auto shrink-0 md:block"
            onError={(event) => {
              event.currentTarget.hidden = true
            }}
          />
        </div>
      </header>

      {stats.degraded.length ? (
        <InlineAlert tone="warning">
          <strong>{stats.degraded.length} metric(s) could not be read</strong> —{' '}
          {stats.degraded.join(', ')}. This is almost always a missing Firestore composite index:
          open the browser console, follow the “create it here” link in the error, then reload.
          Everything else below is accurate.
        </InlineAlert>
      ) : null}

      {/* Four pastel stat cards */}
      <div className="stat-pastel grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ClayStat
          icon={<Users size={19} />}
          iconClass="bg-brand-400"
          label="Total Users"
          value={formatNumber(stats.users.total)}
          note={`+${formatNumber(stats.users.newThisWeek)} this week`}
        />
        <ClayStat
          icon={<CalendarCheck size={19} />}
          iconClass="bg-sky-400"
          label="Events"
          value={formatNumber(stats.events.total)}
          note={`${formatNumber(stats.events.upcoming)} upcoming`}
        />
        <ClayStat
          icon={<TicketCheck size={19} />}
          iconClass="bg-[#f5b23d]"
          label="Registrations"
          value={formatNumber(stats.registrations.total)}
          note={`+${formatNumber(stats.registrations.thisWeek)} this week`}
        />
        <ClayStat
          icon={<UserCheck size={19} />}
          iconClass="bg-grape-400"
          label="Checked In"
          value={formatNumber(stats.attendance.checkedIn)}
          note={`${formatPercent(stats.attendance.attendanceRate)} attendance`}
        />
      </div>

      {/* Chart row */}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card className="rounded-3xl p-5">
          <ClayCardTitle title="Growth Overview" />
          {funnel ? (
            <div className="pb-7">
              <FunnelBars funnel={funnel} />
            </div>
          ) : (
            <p className="text-sm text-ink-500">Funnel data is unavailable right now.</p>
          )}
        </Card>

        <Card className="rounded-3xl p-5">
          <ClayCardTitle title="Top Interests" to="/admin/interests" />
          {stats.popularInterests.length ? (
            <InterestDonut interests={stats.popularInterests} />
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-200 p-6 text-center">
              <p className="text-sm text-ink-500">
                No interests recorded yet. Seed the starter list so onboarding is not empty.
              </p>
              <button
                type="button"
                onClick={() => void onSeed()}
                disabled={seeding}
                className="mt-3 text-sm font-semibold text-brand-600 hover:underline disabled:opacity-50"
              >
                {seeding ? 'Seeding…' : 'Seed starter interests'}
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Events row */}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card className="rounded-3xl p-5">
          <ClayCardTitle title="Upcoming Events" to="/admin/events" />
          {upcoming?.length ? (
            <ul className="divide-y divide-ink-100">
              {upcoming.slice(0, 3).map((event) => (
                <li key={event.id}>
                  <Link
                    to={`/admin/events/${event.id}/attendees`}
                    className="group flex items-center gap-3 py-2.5"
                  >
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-soft">
                      <EventImage event={event} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink-900">{event.title}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {formatEventDateShort(event.date)} · {formatTime(event.startTime)}
                      </span>
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-500 shadow-soft transition group-hover:bg-brand-500 group-hover:text-white">
                      <ArrowUpRight size={16} aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No upcoming events yet. Create one to get started.</p>
          )}
        </Card>

        <Card className="rounded-3xl p-5">
          <ClayCardTitle title="Next Up" to="/admin/events" />
          {nextUp ? (
            <Link
              to={`/admin/events/${nextUp.id}/attendees`}
              className="group relative block h-44 overflow-hidden rounded-2xl shadow-soft"
            >
              <EventImage event={nextUp} className="transition duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-linear-to-t from-[#2d2a4a]/85 via-transparent to-transparent" aria-hidden />
              <span className="absolute right-3 bottom-3 left-4 flex items-end justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg font-extrabold text-white">
                    {nextUp.title}
                  </span>
                  <span className="block text-xs font-semibold text-white/85">
                    {formatNumber(nextUp.registeredCount)} going · {formatEventDateShort(nextUp.date)}
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-500 shadow-soft">
                  <ArrowUpRight size={17} aria-hidden />
                </span>
              </span>
            </Link>
          ) : (
            <p className="text-sm text-ink-500">Nothing scheduled yet.</p>
          )}
        </Card>
      </div>

      {/* Bottom banner */}
      <div className="flex flex-wrap items-center gap-4 rounded-[2rem] bg-linear-to-r from-[#c292da] to-brand-500 px-6 py-3 shadow-lift">
        <img
          src="/brand/ref/star.png"
          alt=""
          className="h-16 w-auto shrink-0"
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-extrabold text-white">Check in your guests</p>
          <p className="text-sm text-white/85">Scan tickets at the door in one tap.</p>
        </div>
        <Link
          to="/admin/check-in"
          className="rounded-full bg-white/25 px-5 py-2 text-sm font-bold text-white ring-1 ring-white/50 transition hover:bg-white/35"
        >
          Open Scanner
        </Link>
      </div>

      {/* Every other number the dashboard tracks */}
      <section>
        <SectionHeading title="More numbers" />
        <div className="stat-pastel grid grid-cols-2 gap-3 sm:grid-cols-4">
          {moreNumbers.map((item) => (
            <div key={item.label} className="rounded-2xl px-4 py-3 shadow-soft ring-1 ring-white/80">
              <p className="text-xs font-semibold text-ink-600">{item.label}</p>
              <p className="font-display text-xl font-extrabold text-ink-900">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Revenue — hidden entirely while everything is free */}
      {stats.revenue.hasPaidEvents ? (
        <section>
          <SectionHeading title="Revenue" subtitle="Confirmed payments only" />
          <div className="grid gap-3 lg:grid-cols-3">
            <StatTile
              label="Total revenue"
              value={formatPrice(stats.revenue.total)}
              icon={<IndianRupee size={16} />}
              tone="success"
            />
            <Card className="p-4 lg:col-span-2">
              <p className="mb-3 text-sm font-semibold text-ink-700">By event</p>
              <ul className="space-y-2">
                {stats.revenue.byEvent.map((entry) => (
                  <li key={entry.title} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-ink-700">{entry.title}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink-900">
                      {formatPrice(entry.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  )
}
