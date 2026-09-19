import { Link } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

/**
 * Shown to anonymous sessions. A guest's tickets are tied to this browser's
 * anonymous uid — clear site data or switch phones and they are gone — so the
 * one thing worth nagging about is saving the account, which links an identity
 * onto the same uid and keeps everything.
 */
export function GuestBanner() {
  const { isGuest } = useAuth()
  if (!isGuest) return null

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-soft ring-1 ring-brand-100">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <UserRound size={18} aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug text-ink-700">
          <span className="font-semibold text-ink-900">Browsing as a guest.</span>{' '}
          <span className="text-ink-500">Save an account to keep your tickets on any device.</span>
        </p>
        <Link
          to="/signup"
          className="shrink-0 rounded-full bg-brand-500 px-3.5 py-2 text-xs font-bold text-white shadow-pink"
        >
          Save
        </Link>
      </div>
    </div>
  )
}
