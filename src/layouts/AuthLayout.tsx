import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'

/**
 * The sign-in poster: a tall pastel panel with the logo above a soft rounded
 * card and a plant at each corner. Same shell for login,
 * sign-up and reset.
 *
 * The poster keeps its natural size and is scaled down as a whole when the
 * screen is shorter than it, so these pages never need to scroll.
 */
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
  const posterRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const poster = posterRef.current
    if (!poster) return
    const fit = () => {
      // offsetHeight ignores the transform, so this is always the natural height.
      const natural = poster.offsetHeight
      if (natural > 0) setScale(Math.min(1, (window.innerHeight - 16) / natural))
    }
    fit()
    // Not every embedded browser has ResizeObserver; the resize listener still covers rotation.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    observer?.observe(poster)
    window.addEventListener('resize', fit)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [])

  return (
    <div className="auth-compact relative flex h-dvh items-center justify-center overflow-hidden px-2">
      <main
        ref={posterRef}
        className="relative w-full max-w-[38rem] shrink-0 overflow-hidden rounded-[2rem] pb-[5%] shadow-lift"
        style={{
          background: 'linear-gradient(100deg, #beb5fc 0%, #e2bbfc 50%, #ffc6d6 100%)',
          transform: `scale(${scale})`,
        }}
      >
        <Link
          to="/explore"
          className="relative z-10 mx-auto mt-[7%] mb-[5%] flex w-fit rounded-full bg-white/85 py-2 pr-5 pl-2.5 shadow-soft"
        >
          <Logo />
        </Link>

        <img
          src="/brand/ref/plant-left.png"
          alt=""
          className="absolute bottom-[4%] -left-[1%] hidden w-[19.5%] sm:block"
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />
        <img
          src="/brand/ref/plant-right.png"
          alt=""
          className="absolute -right-[1.5%] bottom-[4%] hidden w-[18.5%] sm:block"
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />

        <div className="relative mx-auto w-[92%] rounded-[2.25rem] bg-[#fdf4fb] px-6 pt-7 pb-5 shadow-lift sm:w-[70%] sm:px-7">
          <h1 className="text-center font-display text-2xl font-extrabold text-ink-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-center text-sm text-ink-500">{subtitle}</p> : null}
          <div className="mt-4">{children}</div>
          {footer ? <div className="mt-3 text-center text-sm text-ink-500">{footer}</div> : null}
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
