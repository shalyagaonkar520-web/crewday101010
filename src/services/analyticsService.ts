import type { Analytics } from 'firebase/analytics'
import { firebaseApp, isFirebaseConfigured } from '@/firebase/config'

/**
 * Thin wrapper over Google Analytics for Firebase.
 *
 * Loaded lazily so the analytics bundle never blocks first paint, and silently
 * disabled when the project has no measurement id. Only product events are
 * tracked — never names, emails, phone numbers or ticket tokens.
 */

export type AnalyticsEvent =
  | 'app_open'
  | 'signup_started'
  | 'signup_completed'
  | 'login_completed'
  | 'profile_completed'
  | 'interest_selected'
  | 'event_viewed'
  | 'event_search'
  | 'registration_started'
  | 'registration_completed'
  | 'registration_cancelled'
  | 'waitlist_joined'
  | 'ticket_viewed'
  | 'event_attended'
  | 'event_cancelled'
  | 'event_published'
  | 'feedback_submitted'

let analyticsPromise: Promise<Analytics | null> | null = null

function getAnalyticsInstance(): Promise<Analytics | null> {
  if (!isFirebaseConfigured || !import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
    return Promise.resolve(null)
  }
  analyticsPromise ??= import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) =>
      (await isSupported()) ? getAnalytics(firebaseApp) : null,
    )
    .catch(() => null)
  return analyticsPromise
}

export async function track(
  event: AnalyticsEvent,
  params: Record<string, string | number | boolean> = {},
): Promise<void> {
  try {
    const analytics = await getAnalyticsInstance()
    if (!analytics) return
    const { logEvent } = await import('firebase/analytics')
    logEvent(analytics, event, params)
  } catch {
    // Analytics must never break a user flow.
  }
}

/** Fire-and-forget helper for call sites that are not async. */
export function trackSync(
  event: AnalyticsEvent,
  params: Record<string, string | number | boolean> = {},
): void {
  void track(event, params)
}
