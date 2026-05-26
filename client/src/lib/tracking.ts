import { getConsentPreferences, hasConsented, getTrackingVisitorId } from '@/components/CookieConsent';
import { isIOSNativeApp } from '@/lib/platformDetect';
import { isIOSTrackingBlocked } from '@/lib/trackingConfig';

export { setIOSTrackingEnabled } from '@/lib/trackingConfig';

function isIOSBlocked(): boolean {
  return isIOSTrackingBlocked(isIOSNativeApp());
}

const SESSION_COOKIE_NAME = 'ucc_session_id';

function generateSessionId(): string {
  return 's_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
}

function getCookie(name: string): string | null {
  const safeName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp('(^| )' + safeName + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, hours: number = 1): void {
  // Never write tracking cookies on iOS unless admin has explicitly enabled it
  if (isIOSBlocked()) return;
  const expires = new Date();
  expires.setTime(expires.getTime() + hours * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getSessionId(): string {
  let sessionId = getCookie(SESSION_COOKIE_NAME);
  if (!sessionId) {
    sessionId = generateSessionId();
    setCookie(SESSION_COOKIE_NAME, sessionId, 1);
  }
  return sessionId;
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Other';
}

function getOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Other';
}

function getUTMParams(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(key => {
    const value = params.get(key);
    if (value) utm[key] = value;
  });
  return utm;
}

interface TrackingData {
  visitorId: string;
  sessionId: string;
  userId?: number;
  [key: string]: any;
}

async function sendTrackingEvent(endpoint: string, data: TrackingData): Promise<void> {
  // Never track on iOS native app unless admin has explicitly enabled it
  if (isIOSBlocked()) return;
  if (!hasConsented()) return;
  
  const consent = getConsentPreferences();
  if (!consent.analytics && !consent.marketing) return;
  
  try {
    await fetch(`/api/tracking/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error(`Tracking error (${endpoint}):`, error);
  }
}

let sessionStarted = false;
let lastPagePath = '';

export async function startSession(): Promise<void> {
  if (sessionStarted) return;
  
  const consent = getConsentPreferences();
  if (!consent.analytics && !consent.marketing) return;
  
  const visitorId = getTrackingVisitorId();
  const sessionId = getSessionId();
  const utm = getUTMParams();
  
  await sendTrackingEvent('session/start', {
    visitorId,
    sessionId,
    referrer: document.referrer || null,
    utmSource: utm.utm_source,
    utmMedium: utm.utm_medium,
    utmCampaign: utm.utm_campaign,
    utmContent: utm.utm_content,
    deviceType: getDeviceType(),
    browser: getBrowser(),
    os: getOS(),
  });
  
  sessionStarted = true;
}

export async function trackPageView(path?: string, title?: string): Promise<void> {
  const consent = getConsentPreferences();
  if (!consent.analytics) return;
  
  const pagePath = path || window.location.pathname;
  if (pagePath === lastPagePath) return;
  
  lastPagePath = pagePath;
  
  await startSession();
  
  await sendTrackingEvent('pageview', {
    visitorId: getTrackingVisitorId(),
    sessionId: getSessionId(),
    path: pagePath,
    title: title || document.title,
    referrer: document.referrer || null,
  });
}

export async function trackEvent(
  eventName: string,
  eventType: string = 'click',
  eventCategory?: string,
  properties?: Record<string, any>
): Promise<void> {
  const consent = getConsentPreferences();
  if (!consent.analytics) return;
  
  await sendTrackingEvent('event', {
    visitorId: getTrackingVisitorId(),
    sessionId: getSessionId(),
    eventType,
    eventName,
    eventCategory,
    pagePath: window.location.pathname,
    properties,
  });
}

export async function trackConversion(
  conversionType: string,
  conversionValue?: number,
  metadata?: Record<string, any>
): Promise<void> {
  const consent = getConsentPreferences();
  if (!consent.marketing && !consent.analytics) return;
  
  const utm = getUTMParams();
  
  await sendTrackingEvent('conversion', {
    visitorId: getTrackingVisitorId(),
    sessionId: getSessionId(),
    conversionType,
    conversionValue,
    utmSource: utm.utm_source,
    utmMedium: utm.utm_medium,
    utmCampaign: utm.utm_campaign,
    metadata,
  });
}

export async function endSession(): Promise<void> {
  if (!sessionStarted) return;
  
  const sessionId = getSessionId();
  
  await sendTrackingEvent('session/end', {
    visitorId: getTrackingVisitorId(),
    sessionId,
  });
}

let trackingInitialized = false;

export function initTracking(): void {
  if (typeof window === 'undefined') return;
  // On iOS native app tracking is blocked unless admin has explicitly enabled it
  if (isIOSBlocked()) return;
  if (trackingInitialized) return;
  
  trackingInitialized = true;
  
  // Initial tracking attempt
  trackPageView();
  
  window.addEventListener('beforeunload', () => {
    endSession();
  });
  
  const originalPushState = history.pushState;
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(() => trackPageView(), 100);
  };
  
  window.addEventListener('popstate', () => {
    setTimeout(() => trackPageView(), 100);
  });
  
  // Listen for consent updates
  window.addEventListener('consentUpdated', () => {
    console.log('Consent updated, starting tracking...');
    sessionStarted = false; // Reset so we can start a new session
    trackPageView();
  });
}

// Force start tracking after consent is given
export function forceStartTracking(): void {
  console.log('Force starting tracking after consent...');
  sessionStarted = false; // Reset session state
  trackPageView();
  
  // Dispatch event for any other listeners
  window.dispatchEvent(new Event('consentUpdated'));
}
