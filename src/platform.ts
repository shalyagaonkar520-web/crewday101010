import { Capacitor } from '@capacitor/core'

/**
 * Where the bundle is running.
 *
 * The same build serves the website and the Android app: Capacitor loads
 * `dist/` into a WebView from `https://localhost`. Most of the app does not
 * care, but a few browser features behave differently inside a WebView --
 * OAuth popups do not open, web push has no PushManager, the Web Share API
 * is absent -- and those call sites branch on this.
 */
export const isNativeApp: boolean = Capacitor.isNativePlatform()

/** 'android' | 'ios' | 'web' */
export const platform: string = Capacitor.getPlatform()
