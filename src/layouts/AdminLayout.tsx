import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarPlus,
  Heart,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  QrCode,
  Ticket,
  Users,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { Logo } from '@/components/layout/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { logout } from '@/services/authService'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/events', label: 'Events', icon: Ticket, end: false },
  { to: '/admin/events/new', label: 'Create event', icon: CalendarPlus, end: true },
  { to: '/admin/check-in', label: 'Check-in', icon: QrCode, end: false },
  { to: '/admin/requests', label: 'Requests', icon: Inbox, end: false },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/interests', label: 'Interests', icon: Heart, end: false },
  { to: '/admin/reports', label: 'Reports', icon: MessageSquareWarning, end: false },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition',
              isActive
                ? 'bg-brand-500 text-white shadow-pink'
                : 'text-ink-300 hover:bg-white/10 hover:text-white',
            )
          }
        >
          <item.icon size={18} aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AdminLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-ink-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-ink-950 p-4 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="space-y-6">
          <Link to="/admin" className="block px-1">
            <Logo variant="light" />
            <p className="mt-1 pl-11 text-xs font-semibold tracking-wide text-ink-400 uppercase">
              Admin
            </p>
          </Link>
          <NavItems />
        </div>
        <div className="space-y-2 border-t border-ink-800 pt-4">
          <div className="flex items-center gap-3 px-1">
            <Avatar name={profile?.name || 'Admin'} photoURL={profile?.photoURL} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{profile?.name || 'Admin'}</p>
              <p className="truncate text-xs text-ink-400">{profile?.email}</p>
            </div>
          </div>
          <Link
            to="/home"
            className="flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold text-ink-300 transition hover:bg-ink-800 hover:text-white"
          >
            <Ticket size={18} aria-hidden />
            User app
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold text-ink-300 transition hover:bg-ink-800 hover:text-white"
          >
            <LogOut size={18} aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-ink-800 bg-ink-950 px-4 lg:hidden">
        <Link to="/admin">
          <Logo variant="light" />
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-xl p-2 text-white"
          aria-label="Open admin menu"
        >
          <Menu size={22} aria-hidden />
        </button>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink-950/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-fade-in flex-col justify-between bg-ink-950 p-4">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Logo variant="light" />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-xl p-2 text-white"
                  aria-label="Close menu"
                >
                  <X size={20} aria-hidden />
                </button>
              </div>
              <NavItems onNavigate={() => setDrawerOpen(false)} />
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-300 hover:bg-ink-800 hover:text-white"
            >
              <LogOut size={18} aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
