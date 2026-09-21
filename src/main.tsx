import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { isNativeApp } from '@/platform'
import '@/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * Retire the pre-React splash once the app has painted.
 *
 * Two frames, not zero: the first lets React commit, the second lets the
 * browser paint it — removing the splash any earlier flashes white between
 * the two.
 */
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('splash')
    if (!splash) return
    splash.classList.add('is-done')
    splash.addEventListener('transitionend', () => splash.remove(), { once: true })
    // Belt and braces if the transition never fires (reduced motion, hidden tab).
    window.setTimeout(() => splash.remove(), 800)
  })
})

/**
 * Android hardware back button.
 *
 * Inside the native shell there is no browser chrome, so the system back
 * button is the only way to go back. Walk the router history while there is
 * any; at the root, send the app to the background rather than killing it,
 * which is what people expect from an installed app and keeps the WebView
 * (and the Firestore cache in it) warm for the next open.
 */
if (isNativeApp) {
  void import('@capacitor/app').then(({ App: CapacitorApp }) => {
    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else void CapacitorApp.minimizeApp()
    })
  })
}
