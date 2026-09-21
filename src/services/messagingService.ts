import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore'
import { COLLECTIONS, db, firebaseApp } from '@/firebase/config'
import { isNativeApp } from '@/platform'

/**
 * Firebase Cloud Messaging.
 *
 * The whole module is lazy and defensive: FCM needs a service worker, a VAPID
 * key and notification permission, and is unsupported in several browsers
 * (notably iOS Safari unless the app is installed to the home screen). None of
 * that may ever break the rest of the product, so every failure degrades to
 * "push is off" while in-app notifications keep working.
 */

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

export function isPushSupported(): boolean {
  // The Android WebView exposes `serviceWorker` but has no PushManager, so web
  // push can never be delivered there; native FCM is a separate integration.
  if (isNativeApp) return false
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    Boolean(VAPID_KEY)
  )
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

async function getMessagingIfSupported() {
  if (!isPushSupported()) return null
  const { getMessaging, isSupported } = await import('firebase/messaging')
  return (await isSupported()) ? getMessaging(firebaseApp) : null
}

/**
 * A service worker cannot read `import.meta.env`, so the public Firebase
 * config travels to it as query parameters. Nothing secret is involved: these
 * are the same values already present in the client bundle.
 */
function serviceWorkerUrl(): string {
  const params = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  })
  return `/firebase-messaging-sw.js?${params.toString()}`
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    return await navigator.serviceWorker.register(serviceWorkerUrl(), { scope: '/' })
  } catch {
    return undefined
  }
}

/**
 * Ask for permission, mint a device token and store it on the user document so
 * a Cloud Function can target this device. Returns the token, or null when
 * push is unavailable or declined.
 */
export async function enablePush(uid: string): Promise<string | null> {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await registerServiceWorker()
  const { getToken } = await import('firebase/messaging')
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  }).catch(() => null)

  if (!token) return null

  await updateDoc(doc(db, COLLECTIONS.users, uid), {
    fcmTokens: arrayUnion(token),
    'notificationPrefs.push': true,
  })
  return token
}

export async function disablePush(uid: string): Promise<void> {
  const messaging = await getMessagingIfSupported()
  let token: string | null = null

  if (messaging) {
    const { getToken, deleteToken } = await import('firebase/messaging')
    token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null)
    if (token) await deleteToken(messaging).catch(() => undefined)
  }

  await updateDoc(doc(db, COLLECTIONS.users, uid), {
    'notificationPrefs.push': false,
    ...(token ? { fcmTokens: arrayRemove(token) } : {}),
  })
}

/** Foreground messages: the SW only fires when the tab is in the background. */
export async function onForegroundPush(
  handler: (payload: { title: string; body: string; eventId?: string }) => void,
): Promise<() => void> {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return () => undefined

  const { onMessage } = await import('firebase/messaging')
  return onMessage(messaging, (payload) => {
    handler({
      title: payload.notification?.title ?? 'CrewDay',
      body: payload.notification?.body ?? '',
      eventId: payload.data?.eventId,
    })
  })
}
