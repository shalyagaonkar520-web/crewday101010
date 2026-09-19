import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
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
