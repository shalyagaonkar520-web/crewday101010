import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

/**
 * All values here are the public Firebase *client* config. They identify the
 * project; they do not grant privileges. Every privileged operation is gated by
 * Firestore/Storage Security Rules and Cloud Functions. A service-account key
 * must never appear in this bundle.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const

export const missingFirebaseConfig = REQUIRED_KEYS.filter((key) => !firebaseConfig[key])

/** True when the app has enough config to talk to Firebase at all. */
export const isFirebaseConfigured = missingFirebaseConfig.length === 0

/**
 * When the deployment has no `VITE_*` variables (a fresh Vercel project, say),
 * `getAuth()` throws `auth/invalid-api-key` synchronously during module load.
 * That happens before React mounts, so the user gets a blank page under a
 * splash that never goes away — not the friendly "still being set up" banner
 * that exists precisely for this case. Feeding the SDK a placeholder config
 * lets initialisation succeed; `isFirebaseConfigured` stays false, the auth
 * store reports the error, and every sign-in button is disabled.
 */
const effectiveConfig = isFirebaseConfigured
  ? firebaseConfig
  : {
      ...firebaseConfig,
      apiKey: firebaseConfig.apiKey || 'unconfigured',
      authDomain: firebaseConfig.authDomain || 'unconfigured.firebaseapp.com',
      projectId: firebaseConfig.projectId || 'unconfigured',
      appId: firebaseConfig.appId || '1:0:web:unconfigured',
    }

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(effectiveConfig)

export const firebaseApp = app

export const auth = getAuth(app)

/**
 * `initializeFirestore` (rather than `getFirestore`) lets us force long polling
 * detection, which keeps the SDK working behind corporate proxies and on some
 * mobile networks where the streaming transport silently stalls.
 */
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true,
  // Every query measured 300–600 ms round-trip. With the IndexedDB cache the
  // second visit to any screen paints from disk immediately and the network
  // result reconciles behind it — and the app keeps working offline. The
  // multi-tab manager stops two open tabs fighting over the same cache.
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})


export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

/** True when the local emulator suite should be used instead of production. */
export const useEmulators =
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && isFirebaseConfigured

/* ------------------------------ Emulators -------------------------------- */

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

/* ------------------------------ Collections ------------------------------ */

/** Single source of truth for collection names used across services. */
export const COLLECTIONS = {
  users: 'users',
  interests: 'interests',
  events: 'events',
  eventRequests: 'eventRequests',
  registrations: 'registrations',
  notifications: 'notifications',
  waitlists: 'waitlists',
  reports: 'reports',
  feedback: 'feedback',
  settings: 'settings',
  analytics: 'analytics',
} as const
