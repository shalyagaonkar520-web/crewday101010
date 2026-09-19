import type { Timestamp } from 'firebase/firestore'

/* -------------------------------------------------------------------------- */
/*                                   Shared                                   */
/* -------------------------------------------------------------------------- */

/**
 * Firestore timestamps arrive as `Timestamp`, but are `null` for a moment while
 * a `serverTimestamp()` write is still in flight against the local cache.
 */
export type FireDate = Timestamp | null

export type ParticipationType = 'participant' | 'audience'

/** What an event accepts. `both` means the attendee chooses at registration. */
export type EventAudienceType = ParticipationType | 'both'

export type UserRole = 'user' | 'admin'

export type UserStatus = 'active' | 'suspended' | 'deleted'

/* -------------------------------------------------------------------------- */
/*                                    User                                    */
/* -------------------------------------------------------------------------- */

export interface NotificationPreferences {
  newEvents: boolean
  reminders: boolean
  registrationUpdates: boolean
  push: boolean
}

export interface PrivacyPreferences {
  /** Show this profile in public crew lists / attendee previews. */
  showProfileInCrew: boolean
  showInterests: boolean
}

export interface UserProfile {
  uid: string
  name: string
  email: string
  phone: string
  photoURL: string
  city: string
  area: string
  interests: string[]
  participationType: ParticipationType
  role: UserRole
  status: UserStatus
  onboardingCompleted: boolean
  notificationPrefs: NotificationPreferences
  privacyPrefs: PrivacyPreferences
  fcmTokens: string[]
  eventsRegistered: number
  eventsAttended: number
  createdAt: FireDate
  updatedAt: FireDate
  lastActiveAt: FireDate
  suspendedReason?: string
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  newEvents: true,
  reminders: true,
  registrationUpdates: true,
  push: false,
}

export const DEFAULT_PRIVACY_PREFS: PrivacyPreferences = {
  showProfileInCrew: true,
  showInterests: true,
}

/* -------------------------------------------------------------------------- */
/*                                  Interests                                 */
/* -------------------------------------------------------------------------- */

export interface Interest {
  id: string
  name: string
  emoji: string
  /** Parent grouping, e.g. `Music` for `Guitar`. Empty string means top level. */
  category: string
  enabled: boolean
  /** Interests created by users via "add your own" are flagged for curation. */
  custom: boolean
  usageCount: number
  createdAt: FireDate
  createdBy: string
}

/* -------------------------------------------------------------------------- */
/*                                   Events                                   */
/* -------------------------------------------------------------------------- */

export type EventStatus = 'draft' | 'open' | 'closed' | 'cancelled' | 'completed'

export interface CrewEvent {
  id: string
  title: string
  description: string
  imageURL: string
  imagePath: string
  category: string
  /** ISO calendar date, YYYY-MM-DD, in the venue local timezone. */
  date: string
  /** HH:mm, 24 hour. */
  startTime: string
  endTime: string
  /** Materialised date + startTime so Firestore can range-query and sort. */
  startsAt: FireDate
  /**
   * Derived, denormalised fields. Firestore cannot compute these in a query,
   * so `eventService` recalculates them on every write.
   */
  /** 0 = Sunday … 6 = Saturday. Powers the "this Sunday" filter server side. */
  weekday: number
  isFree: boolean
  /** Lowercased tokens from title, venue, category and tags for search. */
  searchTokens: string[]
  venue: string
  address: string
  city: string
  area: string
  mapsURL: string
  capacity: number
  price: number
  currency: string
  eventTypes: EventAudienceType[]
  status: EventStatus
  featured: boolean
  waitlistEnabled: boolean
  tags: string[]
  /** Denormalised counters kept in sync by registration transactions. */
  registeredCount: number
  participantCount: number
  audienceCount: number
  checkedInCount: number
  waitlistCount: number
  cancelledReason?: string
  createdBy: string
  createdAt: FireDate
  updatedAt: FireDate
}

/** Everything an admin can set on the event form. */
export type EventDraft = Omit<
  CrewEvent,
  | 'id'
  | 'startsAt'
  | 'weekday'
  | 'isFree'
  | 'searchTokens'
  | 'registeredCount'
  | 'participantCount'
  | 'audienceCount'
  | 'checkedInCount'
  | 'waitlistCount'
  | 'createdBy'
  | 'createdAt'
  | 'updatedAt'
>

/* -------------------------------------------------------------------------- */
/*                                Registrations                               */
/* -------------------------------------------------------------------------- */

export type RegistrationStatus = 'confirmed' | 'pending_payment' | 'cancelled' | 'waitlisted'

export type PaymentStatus = 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded'

export type AttendanceStatus = 'not_checked_in' | 'checked_in' | 'no_show'

export interface Registration {
  id: string
  /** Human readable ticket code shown to the attendee, e.g. CD-2026-8F4A92. */
  registrationCode: string
  eventId: string
  /** Denormalised so My Events and admin tables avoid N+1 reads. */
  eventTitle: string
  eventDate: string
  eventStartTime: string
  eventVenue: string
  eventImageURL: string
  userId: string
  name: string
  email: string
  phone: string
  participationType: ParticipationType
  price: number
  currency: string
  paymentStatus: PaymentStatus
  registrationStatus: RegistrationStatus
  /** Secret, high entropy value encoded in the QR. Never displayed as text. */
  qrToken: string
  attendanceStatus: AttendanceStatus
  registeredAt: FireDate
  checkInTime: FireDate
  checkedInBy: string
  cancelledAt: FireDate
  cancelledReason?: string
  updatedAt: FireDate
}

export interface WaitlistEntry {
  id: string
  eventId: string
  userId: string
  name: string
  email: string
  phone: string
  participationType: ParticipationType
  position: number
  status: 'waiting' | 'promoted' | 'expired' | 'left'
  createdAt: FireDate
  promotedAt: FireDate
}

/* -------------------------------------------------------------------------- */
/*                              Event requests                                */
/* -------------------------------------------------------------------------- */

export type EventRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

/**
 * A member's proposal for an event.
 *
 * Deliberately a separate collection from `events` rather than an event with
 * a `pending` status: members must never hold write access to the collection
 * that discovery, pricing and capacity are read from. An approved request is
 * *copied* into a real event by an organiser.
 */
export interface EventRequest {
  id: string
  title: string
  description: string
  category: string
  date: string
  startTime: string
  endTime: string
  venue: string
  address: string
  city: string
  area: string
  capacity: number
  price: number
  currency: string
  eventTypes: EventAudienceType[]
  requestedBy: string
  requesterName: string
  requesterEmail: string
  requesterPhone: string
  status: EventRequestStatus
  /** Organiser's note back to the requester on reject, or internal on approve. */
  reviewNote: string
  reviewedBy: string
  reviewedAt: FireDate
  /** Set once approved, so the queue can link through to the live event. */
  createdEventId: string
  createdAt: FireDate
  updatedAt: FireDate
}

/** What the member actually fills in. */
export type EventRequestDraft = Pick<
  EventRequest,
  | 'title'
  | 'description'
  | 'category'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'venue'
  | 'address'
  | 'area'
  | 'capacity'
  | 'price'
  | 'eventTypes'
  | 'requesterPhone'
>

/* -------------------------------------------------------------------------- */
/*                               Notifications                                */
/* -------------------------------------------------------------------------- */

export type NotificationType =
  | 'new_event'
  | 'registration_confirmed'
  | 'event_reminder'
  | 'event_cancelled'
  | 'event_updated'
  | 'waitlist_promoted'
  | 'request_approved'
  | 'request_rejected'
  | 'system'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  eventId: string
  read: boolean
  createdAt: FireDate
}

/* -------------------------------------------------------------------------- */
/*                            Reports and feedback                            */
/* -------------------------------------------------------------------------- */

export interface ProblemReport {
  id: string
  userId: string
  email: string
  subject: string
  message: string
  status: 'open' | 'resolved'
  createdAt: FireDate
}

export interface EventFeedback {
  id: string
  eventId: string
  userId: string
  rating: number
  comment: string
  createdAt: FireDate
}

/* -------------------------------------------------------------------------- */
/*                                  Filtering                                 */
/* -------------------------------------------------------------------------- */

export type DateFilter = 'any' | 'today' | 'tomorrow' | 'weekend' | 'sunday' | 'custom'
export type PriceFilter = 'any' | 'free' | 'paid' | 'custom'

export interface EventFilters {
  search: string
  dateFilter: DateFilter
  customDateFrom: string
  customDateTo: string
  category: string
  priceFilter: PriceFilter
  priceMin: number
  priceMax: number
  role: EventAudienceType | 'any'
  city: string
  area: string
}

export const EMPTY_FILTERS: EventFilters = {
  search: '',
  dateFilter: 'any',
  customDateFrom: '',
  customDateTo: '',
  category: '',
  priceFilter: 'any',
  priceMin: 0,
  priceMax: 100000,
  role: 'any',
  city: '',
  area: '',
}
