import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'

/** Split shell: brand story on the left (desktop), the form on the right. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(60% 55% at 15% 15%, #7422e3 0%, transparent 60%), radial-gradient(55% 50% at 85% 80%, #fe4c10 0%, transparent 55%)',
          }}
          aria-hidden
        />
        <div className="relative">
          <Link to="/explore">
            <Logo variant="light" withTagline />
          </Link>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl leading-tight font-extrabold text-white">
            Work is only one part of life.
          </h2>
          <p className="mt-4 text-lg text-ink-200">
            Find people who play the same music, run the same trails and show up for the same
            weekends. Join as a participant or just come and enjoy.
          </p>
          <ul className="mt-8 space-y-3 text-ink-100">
            <li className="flex items-center gap-3">🎸 Jam sessions, open mics and gigs</li>
            <li className="flex items-center gap-3">🏸 Pick-up games and weekend sport</li>
            <li className="flex items-center gap-3">🥾 Treks, rides and photo walks</li>
          </ul>
        </div>
        <p className="relative text-sm text-ink-400">Find your crew. Make your day.</p>
      </aside>

      <main className="flex min-h-dvh flex-col justify-center bg-ink-50 px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/explore">
              <Logo />
            </Link>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-ink-500">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 text-center text-sm text-ink-500">{footer}</div> : null}
        </div>
      </main>
    </div>
  )
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.7a11.5 11.5 0 0 0 0 10.3l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.22 15.1.5 12 .5 7.5.5 3.6 3.08 1.7 6.85l3.85 2.98C6.46 7.1 9 4.75 12 4.75Z"
      />
    </svg>
  )
}
