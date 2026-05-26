/**
 * Shared tracking configuration state.
 * Kept in its own file to avoid circular imports between
 * tracking.ts (which imports CookieConsent) and CookieConsent.tsx.
 */

let _iosTrackingEnabled = false;

/** Set by the app after fetching the admin toggle from the server. */
export function setIOSTrackingEnabled(enabled: boolean): void {
  _iosTrackingEnabled = enabled;
}

/** Whether tracking is permitted on iOS (admin toggle is ON). */
export function getIOSTrackingEnabled(): boolean {
  return _iosTrackingEnabled;
}

/** Returns true when iOS tracking should be blocked (default safe state). */
export function isIOSTrackingBlocked(isIOSDevice: boolean): boolean {
  return isIOSDevice && !_iosTrackingEnabled;
}
