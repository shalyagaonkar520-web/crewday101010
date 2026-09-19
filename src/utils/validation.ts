import type { EventDraft } from '@/types'

export type FieldErrors<T> = Partial<Record<keyof T, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Indian mobile numbers, with or without +91 / 0 prefix and spacing. */
const PHONE_RE = /^(?:\+?91[\s-]?)?[6-9]\d{9}$/

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function isPhone(value: string): boolean {
  return PHONE_RE.test(value.replace(/[\s-]/g, ''))
}

/** Store phones in a single canonical shape so admin search is predictable. */
export function normalisePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  const local = digits.length > 10 ? digits.slice(-10) : digits
  return local
}

export function isStrongEnoughPassword(value: string): boolean {
  return value.length >= 8 && /[a-zA-Z]/.test(value) && /\d/.test(value)
}

export function passwordHint(value: string): string | undefined {
  if (!value) return 'Password is required.'
  if (value.length < 8) return 'Use at least 8 characters.'
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value))
    return 'Mix letters and numbers so your account stays safe.'
  return undefined
}

/** Strip anything that could be read as markup before we store free text. */
export function sanitiseText(value: string, maxLength = 2000): string {
  return value.replace(/[<>]/g, '').trim().slice(0, maxLength)
}

export function validateProfileFields(fields: {
  name: string
  phone: string
  city: string
}): FieldErrors<{ name: string; phone: string; city: string }> {
  const errors: FieldErrors<{ name: string; phone: string; city: string }> = {}
  if (!fields.name.trim()) errors.name = 'Tell us your name.'
  else if (fields.name.trim().length < 2) errors.name = 'That name looks too short.'
  if (fields.phone && !isPhone(fields.phone)) errors.phone = 'Enter a valid 10 digit mobile number.'
  if (!fields.city.trim()) errors.city = 'Which city are you in?'
  return errors
}

export function validateRegistrationFields(fields: {
  name: string
  phone: string
  email: string
}): FieldErrors<{ name: string; phone: string; email: string }> {
  const errors: FieldErrors<{ name: string; phone: string; email: string }> = {}
  if (!fields.name.trim()) errors.name = 'Full name is required.'
  if (!fields.phone.trim()) errors.phone = 'Phone number is required.'
  else if (!isPhone(fields.phone)) errors.phone = 'Enter a valid 10 digit mobile number.'
  if (!fields.email.trim()) errors.email = 'Email is required.'
  else if (!isEmail(fields.email)) errors.email = 'Enter a valid email address.'
  return errors
}

export function validateEventDraft(draft: EventDraft): FieldErrors<EventDraft> {
  const errors: FieldErrors<EventDraft> = {}

  if (!draft.title.trim()) errors.title = 'Event name is required.'
  else if (draft.title.trim().length < 4) errors.title = 'Give the event a fuller name.'

  if (!draft.description.trim()) errors.description = 'Describe what happens at this event.'

  if (!draft.category) errors.category = 'Pick a category.'
  if (!draft.date) errors.date = 'Pick a date.'
  if (!draft.startTime) errors.startTime = 'Pick a start time.'

  if (draft.endTime && draft.startTime && draft.endTime <= draft.startTime)
    errors.endTime = 'End time must be after the start time.'

  if (!draft.venue.trim()) errors.venue = 'Venue name is required.'
  if (!draft.address.trim()) errors.address = 'Full address is required.'
  if (!draft.city.trim()) errors.city = 'City is required.'

  if (!Number.isFinite(draft.capacity) || draft.capacity < 1)
    errors.capacity = 'Capacity must be at least 1.'
  else if (draft.capacity > 100000) errors.capacity = 'That capacity looks unrealistic.'

  if (!Number.isFinite(draft.price) || draft.price < 0)
    errors.price = 'Price must be 0 or more. Use 0 for a free event.'

  if (!draft.eventTypes.length) errors.eventTypes = 'Choose who can join.'

  if (draft.mapsURL && !/^https?:\/\//i.test(draft.mapsURL))
    errors.mapsURL = 'Maps link must start with http:// or https://'

  return errors
}

export function hasErrors(errors: Record<string, unknown>): boolean {
  return Object.values(errors).some(Boolean)
}

/** Turn a Firebase Auth error code into something a human can act on. */
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support if this is unexpected.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.'
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Try signing in instead.'
    case 'auth/weak-password':
      return 'Please choose a stronger password (at least 8 characters).'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign in was cancelled.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign in popup. Allow popups and try again.'
    case 'auth/account-exists-with-different-credential':
      return 'This email is already registered with a different sign in method.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a minute and try again.'
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection and try again.'
    case 'auth/requires-recent-login':
      return 'For your security, please sign in again before making this change.'
    case 'auth/operation-not-allowed':
      return 'This sign in method is not enabled for the project yet.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
