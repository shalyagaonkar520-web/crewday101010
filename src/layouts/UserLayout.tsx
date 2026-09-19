import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppHeader } from '@/components/layout/AppHeader'
import { BottomNav } from '@/components/layout/BottomNav'
import { GuestBanner } from '@/components/layout/GuestBanner'
import { InlineAlert } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { onForegroundPush } from '@/services/messagingService'

export function UserLayout() {
  const { profile } = useAuth()
  const { info } = useToast()
  const { pathname } = useLocation()

  // Surface pushes that arrive while the app is open (the service worker only
  // fires when the tab is backgrounded).
  useEffect(() => {
    let dispose: (() => void) | undefined
    void onForegroundPush((payload) => info(payload.title)).then((unsubscribe) => {
      dispose = unsubscribe
    })
    return () => dispose?.()
  }, [info])

  return (
    <div className="min-h-dvh bg-ink-50">
      {/* Explore owns its own search box; showing the header one too gave that
          screen two search bars. */}
      <AppHeader showSearch={pathname === '/home'} />

      <GuestBanner />

      {profile?.status === 'suspended' ? (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <InlineAlert tone="danger">
            Your account is suspended, so you cannot register for events. Contact support if you
            think this is a mistake.
          </InlineAlert>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 pt-5 pb-28 lg:pb-12">
        {/* Keyed on the path so each screen fades in rather than snapping
            into place — the difference between "a website" and "an app".
            Respects prefers-reduced-motion via the global CSS rule. */}
        <div key={pathname} className="animate-fade-up">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
