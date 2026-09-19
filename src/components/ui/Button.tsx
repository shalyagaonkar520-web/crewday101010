import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'inverse'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98] select-none'

const VARIANTS: Record<ButtonVariant, string> = {
  // One hot pink, reserved for the primary action on a screen.
  primary:
    'bg-brand-500 text-white shadow-pink hover:bg-brand-600 disabled:hover:bg-brand-500',
  secondary: 'bg-sky-500 text-white shadow-soft hover:bg-sky-600',
  outline: 'border-2 border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-600',
  ghost: 'text-ink-600 hover:bg-ink-100',
  danger: 'bg-sunset-500 text-white hover:bg-sunset-600',
  // For use on dark or coloured backgrounds. A real variant rather than
  // `className="bg-white text-brand-700"`, because that leaves two text-colour
  // utilities on the element and Tailwind resolves the winner by stylesheet
  // order — which silently produced white text on a white button.
  inverse: 'bg-white text-brand-600 shadow-soft hover:bg-brand-50',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-14 px-7 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export interface LinkButtonProps {
  to: string
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  icon?: ReactNode
  className?: string
  children: ReactNode
  state?: unknown
}

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  className,
  children,
  state,
}: LinkButtonProps) {
  return (
    <Link
      to={to}
      state={state}
      role="button"
      className={clsx(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
    >
      {icon}
      {children}
    </Link>
  )
}
