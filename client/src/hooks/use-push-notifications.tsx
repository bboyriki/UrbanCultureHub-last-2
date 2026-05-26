import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

const registeredForUserId = new Set<number>();

declare global {
  interface Window {
    WTN?: {
      Firebase?: {
        Messaging?: {
          requestPermission?: (opts: { callback: (data: Record<string, unknown>) => void }) => void;
          getFCMToken: (opts: { callback: (data: Record<string, unknown>) => void }) => void;
          subscribe:   (opts: { toTopic: string }) => void;
          unsubscribe: (opts: { fromTopic: string }) => void;
        };
      };
      Notifications?: {
        requestPermission?: (opts: { callback: (data: Record<string, unknown>) => void }) => void;
      };
    };
  }
}

export function isWebToNative(): boolean {
  try { return typeof window !== "undefined" && !!window.WTN?.Firebase?.Messaging; }
  catch { return false; }
}

function extractToken(data: Record<string, unknown>): string | null {
  const candidates = ["token", "fcmToken", "fcm_token", "value", "registrationToken", "deviceToken", "fcm"];
  for (const key of candidates) {
    if (typeof data[key] === "string" && (data[key] as string).length > 20) {
      return data[key] as string;
    }
  }
  for (const v of Object.values(data)) {
    if (typeof v === "string" && v.length > 20 && !v.includes(" ")) return v;
  }
  return null;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const retryRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef2 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef3 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (registeredForUserId.has(user.id)) return;

    retryRef.current = setTimeout(() => attemptRegistration(user.id, false), 1500);

    return () => {
      if (retryRef.current)  clearTimeout(retryRef.current);
      if (retryRef2.current) clearTimeout(retryRef2.current);
      if (retryRef3.current) clearTimeout(retryRef3.current);
    };
  }, [user?.id]);

  async function attemptRegistration(userId: number, isFallback: boolean) {
    if (registeredForUserId.has(userId)) return;

    if (isWebToNative()) {
      await registerPushWTN(userId, isFallback);
    } else {
      const registered = await registerPushWeb(userId);
      if (!registered && !isFallback) {
        retryRef2.current = setTimeout(() => attemptRegistration(userId, true), 5000);
      }
    }
  }

  async function registerPushWTN(userId: number, isFallback: boolean) {
    const messaging = window.WTN?.Firebase?.Messaging;
    if (!messaging) return;

    const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios"
      : /Android/.test(navigator.userAgent) ? "android" : "web";

    const doGetToken = () => {
      try {
        messaging.getFCMToken({
          callback: async (data: Record<string, unknown>) => {
            console.log("[Push][WTN] getFCMToken raw:", JSON.stringify(data));

            const token = extractToken(data);
            if (!token) {
              const errMsg = (data.error as string) || (data.message as string) || "empty callback";
              console.warn("[Push][WTN] No token found. Error:", errMsg, "Full data:", data);
              if (!isFallback) {
                retryRef3.current = setTimeout(() => registerPushWTN(userId, true), 12000);
              }
              return;
            }

            try {
              await apiRequest("/api/push/register", "POST", { token, platform });
              registeredForUserId.add(userId);
              console.log("[Push][WTN] Token registered user", userId, platform);
            } catch (err) {
              console.warn("[Push][WTN] Server save failed:", err);
            }
          },
        });
      } catch (err) {
        console.warn("[Push][WTN] getFCMToken threw:", err);
      }
    };

    if (typeof messaging.requestPermission === "function") {
      try {
        messaging.requestPermission({
          callback: (data) => {
            console.log("[Push][WTN] requestPermission result:", JSON.stringify(data));
            doGetToken();
          },
        });
      } catch {
        doGetToken();
      }
    } else if (typeof window.WTN?.Notifications?.requestPermission === "function") {
      try {
        window.WTN!.Notifications!.requestPermission!({
          callback: (data) => {
            console.log("[Push][WTN][Notifications] requestPermission result:", JSON.stringify(data));
            doGetToken();
          },
        });
      } catch {
        doGetToken();
      }
    } else {
      doGetToken();
    }
  }

  async function registerPushWeb(userId: number): Promise<boolean> {
    try {
      if (!("Notification" in window))       return false;
      if (!("serviceWorker" in navigator))   return false;
      if (Notification.permission !== "granted") return false;

      const { initializeApp, getApps, getApp } = await import("firebase/app");
      const { getMessaging, getToken, onMessage }  = await import("firebase/messaging");

      const firebaseConfig = {
        apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId:             import.meta.env.VITE_FIREBASE_APP_ID,
      };

      const fbApp     = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const messaging = getMessaging(fbApp);
      const swReg     = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (!token) { console.warn("[Push][Web] No FCM token returned"); return true; }

      const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios"
        : /Android/.test(navigator.userAgent) ? "android" : "web";

      await apiRequest("/api/push/register", "POST", { token, platform });
      registeredForUserId.add(userId);
      console.log("[Push][Web] Registered for user", userId);

      onMessage(messaging, (payload) => {
        const { title, body } = payload.notification || {};
        const data = (payload.data || {}) as Record<string, string>;
        if (!title || Notification.permission !== "granted") return;
        const n = new Notification(title, { body, icon: "/logo.jpg", badge: "/logo.jpg", data });
        n.onclick = () => {
          window.focus();
          const url = data.url || (data.conversationId ? `/chat?conversation=${data.conversationId}` : null);
          if (url) window.location.href = url;
        };
      });

      return true;
    } catch (err) {
      console.warn("[Push][Web] Registration failed:", err);
      return false;
    }
  }
}

// ─── Standalone manual trigger for an "Enable push on this device" button ───
// Asks for browser permission, registers the FCM token with the server, and
// returns a structured result the UI can render as a toast.
//
// IMPORTANT: every step logs to the console with the [EnablePush] tag so we can
// debug from browser logs when something silently fails.
export async function enablePushOnThisDevice(): Promise<
  { ok: true; token?: string; platform?: string }
  | { ok: false; reason: string }
> {
  const log = (...a: unknown[]) => console.log("[EnablePush]", ...a);
  log("clicked. UA:", navigator.userAgent);

  try {
    if (typeof window === "undefined") return { ok: false, reason: "Not in browser" };

    // ── Web-to-Native (mobile shell) path ────────────────────────────────────
    // Only attempt this if we're ACTUALLY in the iOS/Android native shell.
    // Replit's canvas iframe (and some other host pages) may inject a WTN stub
    // on desktop browsers; that stub never resolves and would just time out.
    const ua = navigator.userAgent;
    const isMobileUA = /iPhone|iPad|iPod|Android/.test(ua);
    const wtn = (window as any).WTN?.Firebase?.Messaging;
    const wtnIsReal = !!wtn && isMobileUA && !/HeadlessChrome/.test(ua);
    log("env detection:", { isMobileUA, wtnPresent: !!wtn, wtnIsReal });

    if (wtnIsReal) {
      log("WTN bridge detected on mobile — using native getFCMToken");
      const platform = /iPhone|iPad|iPod/.test(ua) ? "ios" : "android";
      const wtnResult = await new Promise<{ ok: true; token: string; platform: string } | { ok: false; reason: string; timedOut?: boolean }>((resolve) => {
        const timeout = setTimeout(() => {
          log("WTN getFCMToken TIMED OUT after 10s");
          resolve({ ok: false, reason: "App push bridge timed out", timedOut: true });
        }, 10000);
        try {
          wtn.getFCMToken({
            callback: async (data: Record<string, unknown>) => {
              clearTimeout(timeout);
              log("WTN callback data:", data);
              const token =
                (data.token as string) ||
                (data.fcmToken as string) ||
                (data.fcm_token as string) ||
                (data.registrationToken as string);
              if (!token) {
                resolve({ ok: false, reason: (data.error as string) || "App didn't return a push token (check APNs key in Firebase)" });
                return;
              }
              try {
                const { apiRequest } = await import("@/lib/queryClient");
                const res = await apiRequest("/api/push/register", "POST", { token, platform });
                if (!res.ok) {
                  const txt = await res.text();
                  resolve({ ok: false, reason: `Server rejected token (${res.status}): ${txt}` });
                  return;
                }
                log("WTN token registered ✓");
                resolve({ ok: true, token, platform });
              } catch (e: any) {
                resolve({ ok: false, reason: e?.message || "Server call failed" });
              }
            },
          });
        } catch (e: any) {
          clearTimeout(timeout);
          resolve({ ok: false, reason: e?.message || "WTN bridge threw" });
        }
      });

      if (wtnResult.ok) return wtnResult;
      // If the native bridge timed out, the app shell is broken — but we may
      // still be able to register via the standard web path on the same device.
      if (!wtnResult.timedOut) return { ok: false, reason: wtnResult.reason };
      log("WTN failed, falling through to web path");
    }

    // ── Web/browser path ─────────────────────────────────────────────────────
    if (!("Notification" in window))     return { ok: false, reason: "This browser doesn't support web notifications" };
    if (!("serviceWorker" in navigator)) return { ok: false, reason: "Service workers not available (try Chrome/Edge/Safari latest)" };
    if (!window.isSecureContext)         return { ok: false, reason: "Notifications need HTTPS — open the published URL, not a preview proxy" };

    log("permission BEFORE prompt:", Notification.permission);
    if (Notification.permission === "denied") {
      return { ok: false, reason: "Notifications are BLOCKED for this site. Click the lock icon in the address bar → Site settings → set Notifications to Allow, then reload and try again." };
    }
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      log("permission AFTER prompt:", perm);
      if (perm !== "granted") return { ok: false, reason: "You did not allow notifications when the browser asked" };
    }

    log("dynamic-importing firebase…");
    const { initializeApp, getApps, getApp } = await import("firebase/app");
    const { getMessaging, getToken } = await import("firebase/messaging");
    log("firebase imported");

    const firebaseConfig = {
      apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    };
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      return { ok: false, reason: "Firebase config missing in the build (VITE_FIREBASE_* env vars)" };
    }
    if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) {
      return { ok: false, reason: "VITE_FIREBASE_VAPID_KEY is missing in the build" };
    }

    const fbApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    log("firebase app ready");

    log("registering service worker /firebase-messaging-sw.js");
    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    log("service worker ready, scope:", swReg.scope);

    const messaging = getMessaging(fbApp);
    log("requesting FCM token…");
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!token) {
      return { ok: false, reason: "Firebase returned an empty token. Most common cause: the VAPID key in env doesn't match the one in the Firebase console (Project Settings → Cloud Messaging → Web Push certificates)." };
    }
    log("got token, length:", token.length);

    const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios"
      : /Android/.test(navigator.userAgent) ? "android" : "web";

    const { apiRequest } = await import("@/lib/queryClient");
    log("POSTing to /api/push/register…");
    const res = await apiRequest("/api/push/register", "POST", { token, platform });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, reason: `Server rejected the token (${res.status}): ${txt}` };
    }
    log("registered ✓");
    return { ok: true, token, platform };
  } catch (err: any) {
    console.error("[EnablePush] threw:", err);
    return { ok: false, reason: err?.message || "Unexpected error enabling push" };
  }
}
