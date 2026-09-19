import { NavLink, useNavigate } from 'react-router-dom'
import { CalendarDays, Home, LogIn, Plus, Ticket, User } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
}

const MEMBER_LEFT: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/explore', label: 'Events', icon: CalendarDays },
]
const MEMBER_RIGHT: NavItem[] = [
  { to: '/my-events', label: 'Tickets', icon: Ticket },
  { to: '/profile', label: 'Profile', icon: User },
]

const GUEST_LEFT: NavItem[] = [
  { to: '/explore', label: 'Events', icon: CalendarDays },
]
const GUEST_RIGHT: NavItem[] = [{ to: '/login', label: 'Sign in', icon: LogIn }]

function Tab({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        clsx(
          'flex h-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold transition-colors',
          isActive ? 'text-brand-500' : 'text-ink-400 hover:text-ink-600',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon size={21} strokeWidth={isActive ? 2.5 : 1.9} aria-hidden />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/**
 * Five-slot tab bar with a raised centre action.
 *
 * The centre button is the one thing that differs by who is looking: an
 * organiser gets "create event", everyone else gets discovery. It is never a
 * decorative plus that does nothing.
 */
export function BottomNav() {
  const { isAuthenticated, isAdmin } = useAuth()
  const navigate = useNavigate()

  const left = isAuthenticated ? MEMBER_LEFT : GUEST_LEFT
  const right = isAuthenticated ? MEMBER_RIGHT : GUEST_RIGHT
  // Organisers create an event outright; members send it as a request for
  // review. Signed-out visitors are pushed to sign in first, because a
  // proposal has to belong to somebody.
  const action = isAdmin
    ? { to: '/admin/events/new', label: 'Create event' }
    : isAuthenticated
      ? { to: '/suggest', label: 'Request an event' }
      : { to: '/login', label: 'Sign in to request an event' }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className={clsx(
          'relative mx-auto grid h-16 max-w-md items-stretch px-2',
          // Guests have fewer destinations, so the grid shrinks with them —
          // otherwise the centre action drifts off-centre.
          isAuthenticated ? 'grid-cols-5' : 'grid-cols-3',
        )}
      >
        {left.map((item) => (
          <Tab key={item.to} item={item} />
        ))}

        {/* Centre slot: the button itself floats above the bar. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => navigate(action.to)}
            aria-label={action.label}
            className="absolute -top-6 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-sky-500 text-white shadow-pink transition active:scale-92"
          >
            <Plus size={26} strokeWidth={2.6} aria-hidden />
          </button>
        </div>

        {right.map((item) => (
          <Tab key={item.to} item={item} />
        ))}
      </div>
    </nav>
  )
}
