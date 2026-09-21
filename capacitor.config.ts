import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor wraps the production web build (`dist/`) in a native shell. The
 * Android project lives in `android/` and opens directly in Android Studio.
 *
 * Workflow: `npm run android:sync` builds the web app and copies it into the
 * native project; `npm run android:open` launches Android Studio on it.
 */
const config: CapacitorConfig = {
  appId: 'app.crewday',
  appName: 'CrewDay',
  webDir: 'dist',
  server: {
    // Serve the WebView from https://localhost so secure-context APIs
    // (clipboard, camera, IndexedDB persistence) all work as on the website.
    androidScheme: 'https',
  },
  android: {
    // Firebase Auth and Firestore both need the WebView's own cookie/storage
    // jar; the defaults are right, this just pins them so an upgrade cannot
    // silently change them.
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    FirebaseAuthentication: {
      // The native layer only obtains a Google credential; the Firebase JS SDK
      // performs the actual sign-in so auth state stays in one place.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
}

export default config
