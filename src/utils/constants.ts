import type { EventAudienceType, EventStatus } from '@/types'

/**
 * Event categories. These are the *taxonomy* for events (distinct from user
 * interests, which admins manage from Firestore). Kept in code because the
 * admin event form needs a stable enum for filtering and indexes.
 */
export const EVENT_CATEGORIES = [
  'Singing',
  'Dance',
  'DJ',
  'Party',
  'Gaming',
  'Music',
  'Sports',
  'Fitness',
  'Photography',
  'Art',
  'Travel',
  'Food',
  'Festival',
  'Technology',
  'Books',
  'Other',
] as const

export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export const CATEGORY_EMOJI: Record<string, string> = {
  Singing: '🎤',
  DJ: '🎧',
  Party: '🥳',
  Music: '🎸',
  Sports: '🏏',
  Dance: '💃',
  Photography: '📸',
  Travel: '🧳',
  Gaming: '🎮',
  Technology: '💻',
  Fitness: '🏃',
  Food: '🍜',
  Festival: '🎉',
  Art: '🎨',
  Books: '📚',
  Other: '✨',
}

/**
 * Seed interests offered on first run. Admins can add, rename or disable
 * interests from the admin panel; these are only used to bootstrap an empty
 * `interests` collection so onboarding is never a blank screen.
 */
export const SEED_INTERESTS: { name: string; emoji: string; category: string }[] = [
  { name: 'Guitar', emoji: '🎸', category: 'Music' },
  { name: 'Singing', emoji: '🎤', category: 'Music' },
  { name: 'Piano', emoji: '🎹', category: 'Music' },
  { name: 'Dancing', emoji: '💃', category: 'Dance' },
  { name: 'Photography', emoji: '📸', category: 'Art' },
  { name: 'Painting', emoji: '🎨', category: 'Art' },
  { name: 'Cricket', emoji: '🏏', category: 'Sports' },
  { name: 'Football', emoji: '⚽', category: 'Sports' },
  { name: 'Badminton', emoji: '🏸', category: 'Sports' },
  { name: 'Trekking', emoji: '🥾', category: 'Outdoors' },
  { name: 'Running', emoji: '🏃', category: 'Fitness' },
  { name: 'Cycling', emoji: '🚴', category: 'Fitness' },
  { name: 'Fitness', emoji: '💪', category: 'Fitness' },
  { name: 'Gaming', emoji: '🎮', category: 'Gaming' },
  { name: 'Cooking', emoji: '🍳', category: 'Food' },
  { name: 'Travel', emoji: '🧳', category: 'Travel' },
  { name: 'Coding', emoji: '💻', category: 'Technology' },
  { name: 'Public speaking', emoji: '🗣️', category: 'Community' },
  { name: 'Books', emoji: '📚', category: 'Books' },
  { name: 'Movies', emoji: '🎬', category: 'Movies' },
  { name: 'Music', emoji: '🎧', category: 'Music' },
]

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Draft',
  open: 'Registration open',
  closed: 'Registration closed',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

export const AUDIENCE_TYPE_LABEL: Record<EventAudienceType, string> = {
  participant: 'Participants only',
  audience: 'Audience only',
  both: 'Participants & audience',
}

/**
 * The single neighbourhood CrewDay currently operates in.
 *
 * Kept here rather than hard-coded into screens so that opening a second area
 * is a one-line change plus removing the banner — the data model already
 * supports any city or area.
 */
export const LAUNCH_AREA = 'Electronic City'
export const LAUNCH_CITY = 'Bengaluru'
export const LAUNCH_PINCODE = '560100'

/** Default currency. Stored per event so other currencies can be added later. */
export const DEFAULT_CURRENCY = 'INR'

/** Page size for paginated event / table queries. */
export const PAGE_SIZE = 12
export const ADMIN_PAGE_SIZE = 25

/** Minimum gap (minutes) before start time at which check-in opens. */
export const CHECKIN_WINDOW_MINUTES = 180

/**
 * Public support address for the privacy policy and the account-deletion page.
 * Defaults to the mailbox the Play listing already uses; set `VITE_SUPPORT_EMAIL`
 * on the deployment to point it somewhere else. Play requires a real contact
 * email on the listing.
 */
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL ?? '').trim() || 'shalyagaonkar@gmail.com'

/**
 * Who legally runs CrewDay, as shown on the policy pages. Razorpay requires the
 * site to name the same merchant its account is registered to, and to publish a
 * grievance officer with an email and phone number (Payment Aggregator rules).
 * Phone and address are optional at build time: rows without a value are hidden,
 * but Razorpay's review expects both, so set them before going live.
 */
const env = (key: string) => ((import.meta.env[key] as string | undefined) ?? '').trim()
export const OPERATOR_NAME = env('VITE_OPERATOR_NAME') || 'Akshata Tirupati Rathod'
export const GRIEVANCE_OFFICER = env('VITE_GRIEVANCE_OFFICER') || OPERATOR_NAME
export const SUPPORT_PHONE = env('VITE_SUPPORT_PHONE')
export const BUSINESS_ADDRESS = env('VITE_BUSINESS_ADDRESS')

/** Refund policy numbers, shared by the policy page and the checkout note. */
export const REFUND_CUTOFF_HOURS = 24
export const REFUND_START_BUSINESS_DAYS = 5
export const REFUND_CREDIT_BUSINESS_DAYS = '5–7'
export const GRIEVANCE_REPLY_BUSINESS_DAYS = 5

/**
 * Whether the online (Razorpay) checkout button is offered. It stays off until
 * the Vercel API routes behind it (api/razorpay-*.ts) have their server-only
 * keys set; see docs/razorpay-setup.md. UPI payments confirmed by the organiser work
 * regardless of this flag.
 */
export const ONLINE_PAYMENTS = import.meta.env.VITE_ONLINE_PAYMENTS === 'true'

/**
 * The one public address of the site, used for canonical links and share cards.
 * Never read from window.location: the Android app serves this same build from
 * https://localhost, and a canonical pointing there would be wrong.
 */
export const SITE_URL = 'https://crewday.nirmaansolutions.in'
export const SITE_NAME = 'CrewDay'
export const DEFAULT_SHARE_IMAGE = `${SITE_URL}/og/crewday-share.png`
