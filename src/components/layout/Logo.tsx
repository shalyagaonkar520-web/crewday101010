import clsx from 'clsx'

/**
 * The CrewDay mark.
 *
 * Inline SVG rather than an <img> so it inherits crispness at every size, can
 * be used inside buttons without a network round trip, and renders before any
 * asset has loaded. `/crewday-mark.svg` holds the same artwork for the favicon
 * and for anywhere that needs a file.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="CrewDay">
      <defs>
        <linearGradient id="cd-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff9fc1" />
          <stop offset="50%" stopColor="#c4a5f5" />
          <stop offset="100%" stopColor="#7cc0ff" />
        </linearGradient>
        <linearGradient id="cd-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff6fa" />
          <stop offset="100%" stopColor="#f2f7ff" />
        </linearGradient>
        <linearGradient id="cd-arc" x1="0.1" y1="0.1" x2="0.95" y2="0.9">
          <stop offset="0%" stopColor="#ff4d8d" />
          <stop offset="45%" stopColor="#a86ce0" />
          <stop offset="100%" stopColor="#3f9dff" />
        </linearGradient>
        <linearGradient id="cd-pink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6ba1" />
          <stop offset="100%" stopColor="#f4457f" />
        </linearGradient>
        <linearGradient id="cd-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#57b2ff" />
          <stop offset="100%" stopColor="#2f8ef0" />
        </linearGradient>
        <linearGradient id="cd-violet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b48cf2" />
          <stop offset="100%" stopColor="#9068e0" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="95" fill="url(#cd-face)" />
      <circle cx="100" cy="100" r="95" fill="none" stroke="url(#cd-ring)" strokeWidth="6" />

      <circle cx="66" cy="74" r="15" fill="url(#cd-pink)" />
      <path d="M40 116c0-15 12-25 26-25s26 10 26 25z" fill="url(#cd-pink)" />
      <circle cx="134" cy="74" r="15" fill="url(#cd-violet)" />
      <path d="M108 116c0-15 12-25 26-25s26 10 26 25z" fill="url(#cd-violet)" />
      <circle cx="100" cy="58" r="20" fill="url(#cd-blue)" stroke="#fff6fa" strokeWidth="4" />
      <path
        d="M66 106c0-19 15-31 34-31s34 12 34 31z"
        fill="url(#cd-blue)"
        stroke="#fff6fa"
        strokeWidth="4"
      />

      <g strokeLinecap="round" strokeWidth="7" opacity="0.95">
        <path d="M38 72l14 9" stroke="#ff6ba1" />
        <path d="M30 96h16" stroke="#57b2ff" />
        <path d="M38 120l14-9" stroke="#b48cf2" />
        <path d="M162 72l-14 9" stroke="#ff6ba1" />
        <path d="M170 96h-16" stroke="#57b2ff" />
        <path d="M162 120l-14-9" stroke="#b48cf2" />
      </g>

      <path
        d="M148 84a46 46 0 1 0 0 56"
        fill="none"
        stroke="url(#cd-arc)"
        strokeWidth="21"
        strokeLinecap="round"
      />

      <path
        d="M76 96h48a11 11 0 0 1 11 11v18a11 11 0 0 1-11 11h-20l-12 12v-12h-16a11 11 0 0 1-11-11v-18a11 11 0 0 1 11-11z"
        fill="#ffffff"
      />
      <g fill="#4a9eff">
        <circle cx="86" cy="116" r="5.5" />
        <circle cx="100" cy="116" r="5.5" />
        <circle cx="114" cy="116" r="5.5" />
      </g>
    </svg>
  )
}

export function Logo({
  variant = 'dark',
  withWordmark = true,
  withTagline = false,
  className,
}: {
  variant?: 'dark' | 'light'
  withWordmark?: boolean
  /** The "Meet · Explore · Do · Belong" strip, for large placements only. */
  withTagline?: boolean
  className?: string
}) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-10 w-10 shrink-0 drop-shadow-sm" />

      {withWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-extrabold tracking-tight">
            {variant === 'light' ? (
              <span className="text-white">CREWDAY</span>
            ) : (
              <>
                <span className="text-brand-500">CREW</span>
                <span className="text-sky-500">DAY</span>
              </>
            )}
          </span>
          <span
            className={clsx(
              'mt-0.5 text-[0.55rem] font-semibold tracking-[0.24em]',
              variant === 'light' ? 'text-white/60' : 'text-ink-400',
            )}
          >
            SOCIAL APP
          </span>
          {withTagline ? (
            <span
              className={clsx(
                'mt-1 text-[0.6rem] font-medium',
                variant === 'light' ? 'text-white/55' : 'text-ink-400',
              )}
            >
              Meet · Explore · Do · Belong
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
