import clsx from 'clsx'
import { initialsOf } from '@/utils/format'

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
}

export function Avatar({
  name,
  photoURL,
  size = 'md',
  className,
}: {
  name: string
  photoURL?: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const shared = clsx(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold',
    SIZES[size],
    className,
  )

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt=""
        loading="lazy"
        decoding="async"
        className={clsx(shared, 'bg-ink-100 object-cover')}
      />
    )
  }

  return (
    <span className={clsx(shared, 'bg-brand-100 text-brand-700')} aria-hidden>
      {initialsOf(name)}
    </span>
  )
}
