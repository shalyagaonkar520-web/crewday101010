import type { ReactNode } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/layout/Logo'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin text-brand-600', className)} aria-hidden />
}

/**
 * Full-viewport loader used while auth resolves and between lazy routes.
 *
 * Deliberately the same mark, wordmark and sliding bar as the pre-React splash
 * in `index.html`, so a reload looks like one continuous load rather than two
 * different screens handing over.
 */
export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <LogoMark className="h-22 w-22 animate-pop" />

      <p className="font-display text-xl font-extrabold tracking-tight">
        <span className="text-brand-500">CREW</span>
        <span className="text-sky-500">DAY</span>
      </p>

      <span className="h-1 w-30 overflow-hidden rounded-full bg-brand-100">
        <span className="block h-full w-2/5 rounded-full bg-linear-to-r from-brand-500 to-sky-500 motion-safe:animate-[loading-slide_1.1s_ease-in-out_infinite]" />
      </span>

      {label ? <p className="text-sm font-medium text-ink-500">{label}</p> : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-ink-200/70', className)} />
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-ink-100 bg-white shadow-soft">
      <Skeleton className="aspect-16/9 w-full rounded-none" />
      <div className="space-y-2 px-4 py-3.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-1.5 w-full" />
      </div>
    </div>
  )
}

export function EmptyState({
  emoji = '🗓️',
  title,
  description,
  action,
}: {
  emoji?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-ink-200 bg-white/70 px-6 py-14 text-center">
      <div className="mb-3 text-4xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please check your connection and try again.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-sunset-100 bg-sunset-50/60 px-6 py-12 text-center">
      <AlertTriangle className="mb-3 text-sunset-600" size={28} aria-hidden />
      <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-600">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-5" icon={<RefreshCw size={16} />} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function InlineAlert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  children: ReactNode
}) {
  const tones = {
    info: 'border-brand-100 bg-brand-50 text-brand-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-sunset-200 bg-sunset-50 text-sunset-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }
  return (
    <div className={clsx('rounded-2xl border px-4 py-3 text-sm font-medium', tones[tone])} role="alert">
      {children}
    </div>
  )
}
