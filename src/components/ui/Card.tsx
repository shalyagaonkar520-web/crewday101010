import type { ReactNode } from 'react'
import clsx from 'clsx'

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return (
    <Tag className={clsx('rounded-card bg-white shadow-soft ring-1 ring-ink-100/70', className)}>
      {children}
    </Tag>
  )
}

export type BadgeTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'sunset'

const BADGE_TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-100',
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
  success: 'bg-mint-100 text-mint-600 ring-mint-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  danger: 'bg-sunset-50 text-sunset-600 ring-sunset-100',
  sunset: 'bg-sky-50 text-sky-600 ring-sky-100',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  tone?: BadgeTone
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        {icon ? (
          <span
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-xl',
              BADGE_TONES[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-ink-900 tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </Card>
  )
}
