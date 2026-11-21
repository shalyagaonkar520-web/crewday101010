import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isNativeApp } from '@/platform'
import { ADSENSE_CLIENT } from '@/utils/constants'

/**
 * Loads Google AdSense (Auto ads) on the website's public pages only.
 *
 * Never inside the Android app: AdSense does not allow ads in a WebView app,
 * and the Play listing declares no ads and no advertising ID. Never on account,
 * ticket, checkout or admin pages either; the script is only injected the first
 * time a visitor lands on one of the pages below. Because Auto ads keeps running
 * after a client-side navigation, the private paths are also excluded in the
 * AdSense dashboard (Ads → By site → URL exclusions).
 */
const AD_PAGES = [/^\/$/, /^\/explore\/?$/, /^\/events\/[^/]+\/?$/, /^\/about\/?$/, /^\/plan\/?$/]

let injected = false

export function AdSenseLoader() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (injected || isNativeApp || !ADSENSE_CLIENT) return
    if (!AD_PAGES.some((page) => page.test(pathname))) return
    injected = true
    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
    document.head.appendChild(script)
  }, [pathname])

  return null
}
