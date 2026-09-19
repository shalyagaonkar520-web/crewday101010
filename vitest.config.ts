import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Two suites, deliberately separated:
 *
 *  - `tests/*.rules.test.ts` runs against the Firestore emulator in Node and
 *    proves the security rules behave as documented.
 *  - `tests/*.dom.test.tsx` renders the real app in jsdom to prove the routing,
 *    providers and lazy chunks actually mount.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'rules',
          include: ['tests/**/*.rules.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['tests/**/*.dom.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/setup.dom.ts'],
          // Plausible-looking config so the Firebase SDK initialises; the
          // suite never performs a network call.
          env: {
            VITE_FIREBASE_API_KEY: 'test-api-key',
            VITE_FIREBASE_AUTH_DOMAIN: 'crewday-test.firebaseapp.com',
            VITE_FIREBASE_PROJECT_ID: 'crewday-test',
            VITE_FIREBASE_STORAGE_BUCKET: 'crewday-test.firebasestorage.app',
            VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
            VITE_FIREBASE_APP_ID: '1:1234567890:web:abcdef',
          },
        },
      },
    ],
  },
})
