import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarHeart, Compass, Mic2, Users } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button, LinkButton } from '@/components/ui/Button'
import { ResponsiveEventCard } from '@/components/events/EventCard'
import { HeroCollage } from '@/components/events/HeroCollage'
import { EventCardSkeleton } from '@/components/ui/Feedback'
import { listPublishedEvents } from '@/services/eventService'
import { EMPTY_FILTERS, type CrewEvent } from '@/types'

const PILLARS = [
  {
    icon: Compass,
    title: 'Discover',
    body: 'Find activities based on what you are actually into, not what your job says you do.',
  },
  {
    icon: Users,
    title: 'Meet',
    body: 'Meet people who enjoy the same things, in your city, this weekend.',
  },
  {
    icon: Mic2,
    title: 'Participate',
    body: 'Join as a participant when you want to play, or as audience when you want to watch.',
  },
  {
    icon: CalendarHeart,
    title: 'Every weekend',
    body: 'A new reason to leave the house. Jams, games, treks, festivals and workshops.',
  },
]

export default function LandingPage() {
  const [events, setEvents] = useState<CrewEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listPublishedEvents({ filters: EMPTY_FILTERS, pageSize: 3 })
      .then((page) => {
        if (!cancelled) setEvents(page.events)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-surface/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100"
            >
              Sign in
            </Link>
            <LinkButton to="/signup" size="sm">
              Join CrewDay
            </LinkButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/60 bg-surface">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 55% at 15% 0%, rgb(190 24 93 / 0.09) 0%, transparent 60%), radial-gradient(50% 45% at 90% 100%, rgb(198 154 88 / 0.10) 0%, transparent 60%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
          <img
            src="/brand/crewday-banner.png"
            alt="CrewDay"
            className="mb-8 w-full max-w-xl drop-shadow-[0_12px_24px_rgb(74_22_143_/_0.25)]"
            onError={(event) => {
              event.currentTarget.hidden = true
            }}
          />
          <p className="mb-4 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-bold tracking-[0.18em] text-brand-600 uppercase ring-1 ring-brand-200">
            Find your crew. Make your day.
          </p>
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] font-extrabold text-ink-900 sm:text-6xl lg:text-7xl">
            Find Your Crew.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-600 sm:text-xl">
            Work is only one part of life. Discover people, hobbies, activities and events happening
            around you — every single weekend.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <LinkButton to="/explore" size="lg" variant="primary" icon={<Compass size={18} />}>
              Explore Events
            </LinkButton>
            <LinkButton
              to="/signup"
              size="lg"
              className="border border-white/70 bg-surface text-ink-900 hover:bg-white/70"
              variant="ghost"
              icon={<ArrowRight size={18} />}
            >
              Join CrewDay
            </LinkButton>
          </div>
          <Link
            to="/plan"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
          >
            ✨ Not sure what to do? Plan my CrewDay <ArrowRight size={15} aria-hidden />
          </Link>

          <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-ink-100 pt-8">
            {[
              { label: 'Ways to join', value: '2', hint: 'Participant or audience' },
              { label: 'Interests', value: '20+', hint: 'From guitar to trekking' },
              { label: 'Most events', value: 'Free', hint: 'No ticket price to start' },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                  {stat.label}
                </dt>
                <dd className="mt-1 font-display text-2xl font-bold text-ink-900">{stat.value}</dd>
                <dd className="text-xs text-ink-500">{stat.hint}</dd>
              </div>
            ))}
          </dl>
          </div>
          <HeroCollage events={events} />
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-card border border-ink-100 bg-surface p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <pillar.icon size={22} aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-lg font-bold text-ink-900">{pillar.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live events */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink-900 sm:text-3xl">
              What are you doing this Sunday?
            </h2>
            <p className="mt-1 text-ink-500">Real events, happening soon.</p>
          </div>
          <Link
            to="/explore"
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 hover:underline sm:flex"
          >
            See all <ArrowRight size={15} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </div>
        ) : events.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {events.map((event) => (
              <ResponsiveEventCard key={event.id} event={event} eager />
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-ink-200 bg-surface px-6 py-14 text-center">
            <p className="text-3xl" aria-hidden>
              🎈
            </p>
            <h3 className="mt-3 font-display text-lg font-bold text-ink-900">
              The first CrewDay is being planned.
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
              Join now and you will be the first to know when events open in your city.
            </p>
            <div className="mt-6 flex justify-center">
              <LinkButton to="/signup">Join CrewDay</LinkButton>
            </div>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="overflow-hidden rounded-card bg-linear-to-br from-sky-400 via-brand-400 to-brand-600 px-6 py-14 text-center shadow-lift sm:px-12">
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
            Ready for your next CrewDay?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-white/85">
            Tell us what you are into. We will show you where to find your people.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton to="/signup" size="lg" variant="inverse">
              Create your profile
            </LinkButton>
            <Button
              size="lg"
              variant="ghost"
              className="border border-white/40 text-white hover:bg-surface/15"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Back to top
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-5 text-sm text-ink-500">
            <Link to="/explore" className="hover:text-ink-900">
              Explore
            </Link>
            <Link to="/terms" className="hover:text-ink-900">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-ink-900">
              Privacy
            </Link>
            <Link to="/refund-policy" className="hover:text-ink-900">
              Refunds
            </Link>
            <Link to="/shipping-policy" className="hover:text-ink-900">
              Delivery
            </Link>
            <Link to="/contact" className="hover:text-ink-900">
              Contact
            </Link>
            <Link to="/delete-account" className="hover:text-ink-900">
              Delete account
            </Link>
            <Link to="/admin/login" className="hover:text-ink-900">
              Organiser login
            </Link>
          </nav>
          <p className="text-sm text-white/55">© {new Date().getFullYear()} CrewDay</p>
        </div>
      </footer>
    </div>
  )
}
