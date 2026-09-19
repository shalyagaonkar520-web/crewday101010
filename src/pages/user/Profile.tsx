import { Link } from 'react-router-dom'
import { LogOut, Settings, Ticket, UserPen } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, Card } from '@/components/ui/Card'
import { Button, LinkButton } from '@/components/ui/Button'
import { EmptyState, Skeleton } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'
import { useMyRegistrations } from '@/hooks/useMyRegistrations'
import { logout } from '@/services/authService'
import { formatDateTime, formatEventDateShort } from '@/utils/format'

export default function ProfilePage() {
  const { profile, user } = useAuth()
  const { upcoming, past, attended, loading } = useMyRegistrations(user?.uid)

  if (!profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-24 w-full rounded-card" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="overflow-hidden">
        <div className="h-32 bg-linear-to-br from-sky-200 via-grape-200 to-brand-200" />
        <div className="-mt-12 px-5 pb-5">
          <div className="flex items-end justify-between gap-4">
            <Avatar
              name={profile.name}
              photoURL={profile.photoURL}
              size="xl"
              className="ring-4 ring-white shadow-soft"
            />
            <div className="mb-1 flex gap-2">
              <LinkButton to="/settings/profile" size="sm" variant="outline" icon={<UserPen size={15} />}>
                Edit
              </LinkButton>
              <LinkButton to="/settings" size="sm" variant="ghost" icon={<Settings size={15} />}>
                Settings
              </LinkButton>
            </div>
          </div>

          <h1 className="mt-3 font-display text-2xl font-extrabold text-ink-900">{profile.name}</h1>
          <p className="text-sm text-ink-500">
            {[profile.area, profile.city].filter(Boolean).join(', ') || 'Add your city'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="brand">
              {profile.participationType === 'participant' ? '🎤 Participant' : '👀 Audience'}
            </Badge>
            {profile.role === 'admin' ? <Badge tone="sunset">Organiser</Badge> : null}
            {profile.status === 'suspended' ? <Badge tone="danger">Suspended</Badge> : null}
          </div>

          <p className="mt-4 text-xs text-ink-400">
            CrewDay member since {formatDateTime(profile.createdAt)}
          </p>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-3 divide-x divide-ink-100 rounded-card bg-white py-4 shadow-soft ring-1 ring-ink-100/70">
        {[
          { label: 'Events Joined', value: upcoming.length + past.length },
          { label: 'Attended', value: attended.length },
          { label: 'Upcoming', value: upcoming.length },
        ].map((stat) => (
          <div key={stat.label} className="px-2 text-center">
            <p className="font-display text-xl font-bold text-ink-900">{stat.value}</p>
            <p className="mt-0.5 text-[0.7rem] font-medium text-ink-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Interests</h2>
        {profile.interests.length ? (
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-600"
              >
                {interest}
              </span>
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <p className="text-sm text-ink-500">
              You have not picked any interests yet.{' '}
              <Link to="/settings/profile" className="font-semibold text-brand-600 hover:underline">
                Add some
              </Link>{' '}
              so we can show you better events.
            </p>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900">Upcoming events</h2>
          <Link to="/my-events" className="text-sm font-semibold text-brand-600 hover:underline">
            See all
          </Link>
        </div>

        {loading ? (
          <Skeleton className="h-20 w-full rounded-card" />
        ) : upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.slice(0, 3).map((registration) => (
              <Card as="li" key={registration.id}>
                <Link to={`/tickets/${registration.id}`} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-900">{registration.eventTitle}</p>
                    <p className="text-sm text-ink-500">
                      {formatEventDateShort(registration.eventDate)} · {registration.eventVenue}
                    </p>
                  </div>
                  <Ticket size={18} className="shrink-0 text-ink-300" aria-hidden />
                </Link>
              </Card>
            ))}
          </ul>
        ) : (
          <EmptyState
            emoji="🎈"
            title="Nothing booked yet"
            description="Your weekend is wide open."
            action={<LinkButton to="/explore">Find a CrewDay</LinkButton>}
          />
        )}
      </section>

      <div className="mt-8">
        <Button
          variant="ghost"
          fullWidth
          className="text-sunset-700 hover:bg-sunset-50"
          icon={<LogOut size={17} />}
          onClick={() => void logout()}
        >
          Log out
        </Button>
      </div>
    </div>
  )
}
