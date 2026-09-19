import clsx from 'clsx'

export interface TabItem<T extends string> {
  value: T
  label: string
  count?: number
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={clsx('no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-ink-100 p-1', className)}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={clsx(
              'flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition',
              active ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span className={clsx('ml-1.5 text-xs', active ? 'text-brand-600' : 'text-ink-400')}>
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-soft'
          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50',
        className,
      )}
    >
      {children}
    </button>
  )
}
