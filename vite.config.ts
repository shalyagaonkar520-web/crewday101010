import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // Keep the vendor weight out of the app chunk so a route change never
        // re-downloads React or the Firebase SDK.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\/]node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/.test(id))
            return 'react'
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase'))
            return 'firebase'
          if (id.includes('html5-qrcode')) return 'scanner'
          return undefined
        },
      },
    },
  },
})
