import { MapPin } from 'lucide-react'
import clsx from 'clsx'
import { LAUNCH_AREA, LAUNCH_CITY } from '@/utils/constants'

/**
 * The launch-city strip.
 *
 * CrewDay runs in one neighbourhood for now, and saying so up front is kinder
 * than letting someone search three times before working out there is nothing
 * near them. It disappears on its own once more areas go live.
 */
export function LocationBanner({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'flex items-center gap-2.5 rounded-2xl bg-linear-to-r from-brand-50 via-grape-50 to-sky-50 px-4 py-2.5 ring-1 ring-brand-100',
        className,
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
        <MapPin size={15} aria-hidden />
      </span>
      <p className="min-w-0 text-[0.8rem] leading-tight text-ink-700">
        <span className="font-bold text-ink-900">Now live in {LAUNCH_AREA}</span>
        <span className="text-ink-500"> · {LAUNCH_CITY}. More areas coming soon.</span>
      </p>
    </div>
  )
}
