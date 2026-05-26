/**
 * Captures UTM parameters when a user lands on the site from an ad campaign,
 * persists them per-session, and reports the landing + signup conversion to
 * the Ads Hub backend so admins can see cost-per-signup per channel.
 */

const SESSION_KEY = "ad_session_id";
const UTM_KEY = "ad_utm";
const REPORTED_KEY = "ad_landing_reported";

function uuid() {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getOrCreateAdSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const s = uuid();
    localStorage.setItem(SESSION_KEY, s);
    return s;
  } catch { return uuid(); }
}

export function captureLanding() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const utm = {
      source: url.searchParams.get("utm_source") || undefined,
      medium: url.searchParams.get("utm_medium") || undefined,
      campaign: url.searchParams.get("utm_campaign") || undefined,
      content: url.searchParams.get("utm_content") || undefined,
      term: url.searchParams.get("utm_term") || undefined,
    };
    if (!utm.source && !utm.campaign) return;

    const sessionId = getOrCreateAdSessionId();
    localStorage.setItem(UTM_KEY, JSON.stringify(utm));

    const reported = localStorage.getItem(REPORTED_KEY);
    if (reported === utm.campaign) return;

    fetch("/api/track/landing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sessionId, utm,
        referrer: document.referrer || null,
        landingPath: url.pathname,
      }),
    }).then(() => localStorage.setItem(REPORTED_KEY, utm.campaign || "")).catch(() => {});
  } catch {}
}

export function reportConversion(userId?: number, conversionType = "signup") {
  if (typeof window === "undefined") return;
  try {
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return;
    fetch("/api/track/conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId, userId, conversionType }),
    }).catch(() => {});

    // Also fire Google Ads conversion event (gtag is loaded in index.html).
    // To capture cost-per-signup in Google Ads, create a Conversion Action there
    // and set VITE_GADS_SIGNUP_CONVERSION_LABEL = "AW-18115227469/AbC123XyZ".
    const w = window as any;
    const label = (import.meta as any).env?.VITE_GADS_SIGNUP_CONVERSION_LABEL;
    if (typeof w.gtag === "function" && conversionType === "signup" && label) {
      w.gtag("event", "conversion", { send_to: label, value: 1.0, currency: "EUR" });
    }
  } catch {}
}

// ── Google Ads Purchase Conversion ──────────────────────────────────────────
// Fires the configured Google Ads "Purchase" conversion event. Idempotent per
// transactionId within a session — calling it twice on the same purchase (e.g.
// page reload of a success page) only reports once. Falls back to a UUID key
// when no transactionId is supplied so manual reloads of generic success pages
// don't double-count either.
const PURCHASE_CONVERSION_LABEL =
  ((import.meta as any).env?.VITE_GADS_PURCHASE_CONVERSION_LABEL as string | undefined) ||
  "AW-18115227469/g4sACJeVgqUcEM3egb5D";

const REPORTED_PURCHASES_KEY = "ad_reported_purchases";

function alreadyReported(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(REPORTED_PURCHASES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list.includes(key);
  } catch { return false; }
}

function markReported(key: string): void {
  try {
    const raw = sessionStorage.getItem(REPORTED_PURCHASES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(key)) list.push(key);
    // Cap size so the list can't grow unbounded across long sessions.
    if (list.length > 50) list.splice(0, list.length - 50);
    sessionStorage.setItem(REPORTED_PURCHASES_KEY, JSON.stringify(list));
  } catch {}
}

export function reportPurchase(opts: {
  value?: number;
  currency?: string;
  transactionId?: string;
  /** Optional human label for our own backend tracking (e.g. "ai_premium", "ticket"). */
  conversionType?: string;
  userId?: number;
} = {}) {
  if (typeof window === "undefined") return;
  try {
    const value = typeof opts.value === "number" && opts.value >= 0 ? opts.value : 1.0;
    const currency = opts.currency || "EUR";
    const transactionId = opts.transactionId || "";
    // When the caller supplies a transactionId, use it (best — survives reloads
    // because we persist to sessionStorage). Otherwise fall back to a stable key
    // composed of the current URL path + conversion type, so that reloading the
    // same success page doesn't double-fire within a session.
    const fallbackKey = `${opts.conversionType || "purchase"}@${typeof window !== "undefined" ? window.location.pathname : ""}`;
    const dedupKey = transactionId || fallbackKey;
    if (alreadyReported(dedupKey)) return;

    const w = window as any;
    if (typeof w.gtag === "function" && PURCHASE_CONVERSION_LABEL) {
      w.gtag("event", "conversion", {
        send_to: PURCHASE_CONVERSION_LABEL,
        value,
        currency,
        transaction_id: transactionId,
      });
    }
    markReported(dedupKey);

    // Also report to our internal Ads Hub backend so per-channel revenue shows up there.
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId) {
      fetch("/api/track/conversion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId,
          userId: opts.userId,
          conversionType: opts.conversionType || "purchase",
          value,
          currency,
          transactionId,
        }),
      }).catch(() => {});
    }
  } catch {}
}
