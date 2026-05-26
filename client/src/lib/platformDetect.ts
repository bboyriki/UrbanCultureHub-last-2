/**
 * Platform detection utilities for WebToNative iOS app context.
 *
 * Apple App Store Guideline 5.1.2 requires ATT consent before tracking.
 * Apple App Store Guideline 4.8 requires Sign in with Apple when third-party
 * social login is offered.
 *
 * When running inside the WebToNative iOS wrapper, we:
 *  - Hide the cookie consent banner (no tracking without ATT)
 *  - Hide Google Sign In (no equivalent Apple Sign In option)
 */

/** Returns true when running inside the WebToNative iOS native app wrapper. */
export function isWebToNativeIOS(): boolean {
  if (typeof window === "undefined") return false;

  // WebToNative injects window.WebToNative into the webview
  if ((window as any).WebToNative) return true;

  // User agent check — WebToNative adds "WebToNative" to the UA string
  const ua = navigator.userAgent || "";
  if (/WebToNative/i.test(ua) || /wtnative/i.test(ua)) return true;

  return false;
}

/** Returns true when running as any native-wrapped iOS WebView (broader check). */
export function isIOSNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  if (isWebToNativeIOS()) return true;

  // Generic iOS WebView: iPhone/iPad but no "Safari" in UA
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua);
}
