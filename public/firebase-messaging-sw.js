/* eslint-env serviceworker */
/* global firebase, importScripts */

/**
 * CrewDay — Firebase Cloud Messaging service worker.
 *
 * A service worker cannot read Vite's `import.meta.env`, so the (public)
 * Firebase config is handed over as query parameters when the app registers
 * this file — see `enablePush()` in `src/services/messagingService.ts`. No
 * secret ever reaches this file.
 *
 * This worker only handles messages that arrive while the tab is closed or in
 * the background; foreground messages are handled in the app itself.
 */

const FIREBASE_SDK_VERSION = '12.0.0'

importScripts(
  `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`,
)
importScripts(
  `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`,
)

const params = new URL(self.location.href).searchParams

const config = {
  apiKey: params.get('apiKey') ?? '',
  authDomain: params.get('authDomain') ?? '',
  projectId: params.get('projectId') ?? '',
  storageBucket: params.get('storageBucket') ?? '',
  messagingSenderId: params.get('messagingSenderId') ?? '',
  appId: params.get('appId') ?? '',
}

if (config.projectId && config.appId) {
  firebase.initializeApp(config)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'CrewDay'
    self.registration.showNotification(title, {
      body: payload.notification?.body ?? '',
      icon: '/crewday-mark.svg',
      badge: '/crewday-mark.svg',
      tag: payload.data?.eventId || 'crewday',
      data: { url: payload.data?.url || '/notifications' },
    })
  })
}

// Focus an open CrewDay tab instead of opening a duplicate one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/notifications'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate?.(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
