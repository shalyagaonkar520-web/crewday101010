import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import clsx from 'clsx'

const CONTROL =
  'w-full rounded-2xl border bg-white px-4 text-[0.95rem] text-ink-900 placeholder:text-ink-400 transition outline-none disabled:bg-ink-100 disabled:text-ink-500'
const CONTROL_OK = 'border-ink-200 focus:border-brand-400 focus:ring-4 focus:ring-brand-100'
const CONTROL_BAD = 'border-sunset-400 focus:border-sunset-500 focus:ring-4 focus:ring-sunset-100'

interface FieldShellProps {
  id: string
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

function FieldShell({ id, label, hint, error, required, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-semibold text-ink-800">
          {label}
          {required ? <span className="ml-0.5 text-sunset-600">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-sunset-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  leading?: ReactNode
  trailing?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, className, id, required, ...rest },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-400">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={clsx(
            CONTROL,
            error ? CONTROL_BAD : CONTROL_OK,
            'h-12',
            leading && 'pl-11',
            trailing && 'pr-11',
            className,
          )}
          {...rest}
        />
        {trailing ? (
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-400">{trailing}</span>
        ) : null}
      </div>
    </FieldShell>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, required, rows = 5, ...rest },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={clsx(CONTROL, error ? CONTROL_BAD : CONTROL_OK, 'resize-y py-3', className)}
        {...rest}
      />
    </FieldShell>
  )
})

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, placeholder, className, id, required, ...rest },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        className={clsx(CONTROL, error ? CONTROL_BAD : CONTROL_OK, 'h-12 appearance-none pr-10', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236b6493' stroke-width='2'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 1rem center',
        }}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
})

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label
      className={clsx(
        'flex items-start justify-between gap-4 rounded-2xl border border-ink-200 bg-white p-4',
        disabled ? 'opacity-60' : 'cursor-pointer hover:border-brand-200',
      )}
    >
      <span className="flex-1">
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        {description ? <span className="mt-0.5 block text-sm text-ink-500">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-ink-300 transition peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
        <span className="pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
