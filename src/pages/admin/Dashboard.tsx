import { useEffect, useState } from 'react'
import {
  CalendarCheck,
  CalendarPlus,
  IndianRupee,
  QrCode,
  TicketCheck,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { Card, SectionHeading, StatTile } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/Button'
import { ErrorState, InlineAlert, Skeleton } from '@/components/ui/Feedback'
import { getDashboardStats, getFunnelStats, type DashboardStats, type FunnelStats } from '@/services/adminService'
import { seedInterestsIfEmpty } from '@/services/interestService'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatNumber, formatPercent, formatPrice } from '@/utils/format'

function FunnelBar({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-ink-800">{label}</span>
        <span className="tabular-nums text-ink-500">
          {formatNumber(value)} · {formatPercent(percent)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-linear-to-r from-brand-500 to-sunset-500"
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const { success, error: toastError } = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [funnel, setFunnel] = useState<FunnelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    // Settled, not all: the funnel failing should not take the headline
    // numbers down with it, and vice versa.
    Promise.allSettled([getDashboardStats(), getFunnelStats()])
      .then(([dashboard, funnelStats]) => {
        if (dashboard.status === 'fulfilled') setStats(dashboard.value)
        if (funnelStats.status === 'fulfilled') setFunnel(funnelStats.value)
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
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-card" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return <ErrorState description={error ?? 'No data available.'} onRetry={load} />
  }

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-card bg-ink-950 px-5 py-7 shadow-lift sm:px-7">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(65% 75% at 8% 10%, #7422e3 0%, transparent 60%), radial-gradient(55% 70% at 95% 95%, #fe4c10 0%, transparent 55%)',
          }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-white">Dashboard</h1>
            <p className="mt-1 text-white/70">How CrewDay is doing right now.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton
              to="/admin/events/new"
              variant="inverse"
              icon={<CalendarPlus size={17} />}
            >
              Create event
            </LinkButton>
            <LinkButton
              to="/admin/check-in"
              variant="ghost"
              className="border border-white/30 text-white hover:bg-white/15"
              icon={<QrCode size={17} />}
            >
              Check-in
            </LinkButton>
          </div>
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

      {/* Users */}
      <section>
        <SectionHeading title="Users" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total users" value={formatNumber(stats.users.total)} icon={<Users size={16} />} />
          <StatTile
            label="New today"
            value={formatNumber(stats.users.newToday)}
            icon={<UserPlus size={16} />}
            tone="success"
          />
          <StatTile label="New this week" value={formatNumber(stats.users.newThisWeek)} tone="brand" />
          <StatTile
            label="Active (30 days)"
            value={formatNumber(stats.users.active)}
            hint={stats.users.suspended ? `${stats.users.suspended} suspended` : undefined}
            tone="neutral"
          />
        </div>
      </section>

      {/* Events */}
      <section>
        <SectionHeading title="Events" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total events" value={formatNumber(stats.events.total)} icon={<CalendarCheck size={16} />} />
          <StatTile label="Upcoming" value={formatNumber(stats.events.upcoming)} tone="brand" />
          <StatTile label="Completed" value={formatNumber(stats.events.completed)} tone="success" />
          <StatTile
            label="Drafts"
            value={formatNumber(stats.events.drafts)}
            hint={stats.events.cancelled ? `${stats.events.cancelled} cancelled` : undefined}
            tone="warning"
          />
        </div>
      </section>

      {/* Registrations & attendance */}
      <section>
        <SectionHeading title="Registrations & attendance" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Total registrations"
            value={formatNumber(stats.registrations.total)}
            icon={<TicketCheck size={16} />}
          />
          <StatTile label="Today" value={formatNumber(stats.registrations.today)} tone="success" />
          <StatTile label="This week" value={formatNumber(stats.registrations.thisWeek)} tone="brand" />
          <StatTile
            label="Checked in"
            value={formatNumber(stats.attendance.checkedIn)}
            hint={`${formatPercent(stats.attendance.attendanceRate)} attendance · ${formatPercent(stats.attendance.noShowRate)} no-show`}
            tone="success"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-600" aria-hidden />
            <h2 className="font-display text-lg font-bold text-ink-900">Growth funnel</h2>
          </div>
          {funnel ? (
            <>
              <p className="mb-4 text-sm text-ink-500">
                Based on the {formatNumber(funnel.signedUp)} most recent sign-ups.
              </p>
              <div className="space-y-4">
                <FunnelBar label="Signed up" value={funnel.signedUp} total={funnel.signedUp} />
                <FunnelBar label="Completed profile" value={funnel.profilesCompleted} total={funnel.signedUp} />
                <FunnelBar label="Registered for an event" value={funnel.registeredForEvent} total={funnel.signedUp} />
                <FunnelBar label="Actually attended" value={funnel.attended} total={funnel.signedUp} />
                <FunnelBar label="Came back for another" value={funnel.repeatAttenders} total={funnel.signedUp} />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-500">Funnel data is unavailable right now.</p>
          )}
        </Card>

        {/* Popular interests */}
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold text-ink-900">Popular interests</h2>
          {stats.popularInterests.length ? (
            <ul className="space-y-2.5">
              {stats.popularInterests.map((interest) => {
                const max = stats.popularInterests[0]?.count || 1
                return (
                  <li key={interest.name} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-sm font-semibold text-ink-800">
                      {interest.name}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <span
                        className="block h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.max(4, (interest.count / max) * 100)}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right text-sm tabular-nums text-ink-500">
                      {interest.count}
                    </span>
                  </li>
                )
              })}
            </ul>
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
