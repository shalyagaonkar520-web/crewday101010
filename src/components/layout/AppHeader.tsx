import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Bell, CalendarDays, Home, LayoutDashboard, Search, Ticket, User } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '@/components/ui/Avatar'
import { LinkButton } from '@/components/ui/Button'
import { Logo } from '@/components/layout/Logo'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToNotifications } from '@/services/notificationService'

const NAV = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/explore', label: 'Events', icon: CalendarDays },
  { to: '/my-events', label: 'Tickets', icon: Ticket },
  { to: '/profile', label: 'Profile', icon: User },
]

/** The rounded search field that sits under the logo row. */
export function SearchBar({
  defaultValue = '',
  placeholder = 'Search events, people, hobbies...',
}: {
  defaultValue?: string
  placeholder?: string
}) {
  const navigate = useNavigate()
  const [term, setTerm] = useState(defaultValue)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    navigate(term.trim() ? `/explore?q=${encodeURIComponent(term.trim())}` : '/explore')
  }

  return (
    <form onSubmit={submit} className="relative">
      <Search
        size={18}
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-400"
        aria-hidden
      />
      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={placeholder}
        aria-label="Search events"
        className="h-12 w-full rounded-full bg-white pr-4 pl-11 text-[0.95rem] text-ink-900 shadow-soft ring-1 ring-ink-100 outline-none transition placeholder:text-ink-400 focus:ring-2 focus:ring-brand-300"
      />
    </form>
  )
}

export function AppHeader({ showSearch = false }: { showSearch?: boolean }) {
  const { profile, isAdmin, isAuthenticated, user } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnread(0)
      return
    }
    return subscribeToNotifications(user.uid, (notifications) =>
      setUnread(notifications.filter((entry) => !entry.read).length),
    )
  }, [user])

  const navItems = isAuthenticated ? NAV : NAV.filter((item) => item.to === '/explore')

  return (
    <header className="sticky top-0 z-40 bg-[#fdf7fb]">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to={isAuthenticated ? '/home' : '/explore'} className="shrink-0">
            <Logo />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-ink-500 hover:bg-white',
                  )
                }
              >
                <item.icon size={17} aria-hidden />
                {item.label}
              </NavLink>
            ))}
            {isAdmin ? (
              <NavLink
                to="/admin"
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink-500 transition hover:bg-white"
              >
                <LayoutDashboard size={17} aria-hidden />
                Admin
              </NavLink>
            ) : null}
          </nav>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-500 shadow-soft ring-1 ring-ink-100 transition hover:text-brand-500"
                aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              >
                <Bell size={19} aria-hidden />
                {unread > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[0.6rem] font-bold text-white ring-2 ring-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </Link>
              <Link to="/profile" aria-label="Your profile">
                <Avatar
                  name={profile?.name || 'CrewDay'}
                  photoURL={profile?.photoURL}
                  size="md"
                  className="ring-2 ring-white shadow-soft"
                />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-white sm:block"
              >
                Sign in
              </Link>
              <LinkButton to="/signup" size="sm">
                Join
              </LinkButton>
            </div>
          )}
        </div>

        {showSearch ? (
          <div className="pb-3">
            <SearchBar />
          </div>
        ) : null}
      </div>
    </header>
  )
}
