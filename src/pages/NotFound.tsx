import { LinkButton } from '@/components/ui/Button'
import { useLocation } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { usePageMeta } from '@/seo/usePageMeta'

export default function NotFoundPage() {
  const { pathname } = useLocation()
  // Vercel answers 200 for unknown paths (SPA fallback), so noindex is what keeps these out of search.
  usePageMeta({
    title: 'Page not found · CrewDay',
    description: 'This page does not exist. Browse upcoming CrewDay events instead.',
    path: pathname,
    noindex: true,
  })

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div>
        <p className="font-display text-6xl font-extrabold text-brand-600">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink-900">
          This page took the weekend off.
        </h1>
        <p className="mt-2 max-w-sm text-ink-500">
          The link you followed does not exist. Let&apos;s get you back to the good stuff.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <LinkButton to="/home">Go home</LinkButton>
        <LinkButton to="/explore" variant="outline">
          Explore events
        </LinkButton>
      </div>
    </div>
  )
}
