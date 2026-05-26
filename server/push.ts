import { getMessaging } from 'firebase-admin/messaging';
import { db } from './db';
import { pushTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Resolve absolute URL for FCM — FCM requires full https:// URLs for icons/images
const APP_BASE_URL =
  process.env.REPLIT_DEPLOYMENT === "1"
    ? "https://urbanculturehub.nl"
    : `https://${(process.env.REPLIT_DOMAINS || "").split(",")[0] || "localhost:5000"}`;

function toAbsoluteUrl(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("https://") || path.startsWith("http://")) return path;
  return `${APP_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, string>;
  conversationId?: number;
  url?: string;
  /** Keep notification visible until user explicitly dismisses it (e.g. for calls) */
  requireInteraction?: boolean;
  /** Web-push TTL in seconds (default 86400 / 24 h; use 0 for ephemeral like calls) */
  ttl?: number;
}

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  try {
    const tokens = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));

    if (!tokens.length) return;

    const messaging = getMessaging();

    // Always use absolute URLs — FCM rejects relative paths
    const iconUrl  = toAbsoluteUrl(payload.icon  || "/logo.jpg");
    const badgeUrl = toAbsoluteUrl(payload.badge || "/logo.jpg");
    const actionUrl = payload.url || "/";

    const results = await Promise.allSettled(
      tokens.map(({ token }) =>
        messaging.send({
          token,
          notification: {
            title: payload.title,
            body:  payload.body,
          },
          webpush: {
            headers: {
              // TTL: 0 = ephemeral (ideal for calls), >0 for normal messages
              TTL: String(payload.ttl !== undefined ? payload.ttl : 86400),
              Urgency: payload.requireInteraction ? "high" : "normal",
            },
            notification: {
              title: payload.title,
              body:  payload.body,
              icon:  iconUrl,
              badge: badgeUrl,
              requireInteraction: payload.requireInteraction ?? false,
              silent: false,
            },
            fcmOptions: {
              link: actionUrl,
            },
            data: {
              ...(payload.data || {}),
              ...(payload.conversationId != null
                ? { conversationId: String(payload.conversationId) }
                : {}),
              url: actionUrl,
            },
          },
          apns: {
            headers: {
              // High-priority APNS push — wakes the device for calls
              "apns-priority": payload.requireInteraction ? "10" : "5",
              // TTL: 0 = don't store if device is offline (ideal for calls)
              "apns-expiration": payload.requireInteraction
                ? "0"
                : String(Math.floor(Date.now() / 1000) + 86400),
            },
            payload: {
              aps: {
                alert: {
                  title: payload.title,
                  body:  payload.body,
                },
                badge: 1,
                sound: "default",
                // Content-available: 1 wakes the app in background (VoIP-style)
                "content-available": payload.requireInteraction ? 1 : undefined,
              },
              // Pass call data through APNS so the wrapper app / WKWebView
              // can extract it natively and inject it before the WebView loads
              ...(payload.data || {}),
            },
            // Only set imageUrl if it's a valid absolute https URL
            ...(iconUrl?.startsWith("https://") ? {
              fcmOptions: { imageUrl: iconUrl },
            } : {}),
          },
        })
      )
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        const err = result.reason as any;
        const code = err?.errorInfo?.code || err?.code || "";
        console.error(`[Push] FCM send failed for token[${i}]: code=${code} message=${err?.message || err}`);
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          await db
            .delete(pushTokens)
            .where(eq(pushTokens.token, tokens[i].token));
          console.warn(`[Push] Removed stale token[${i}]`);
        }
      } else {
        console.log(`[Push] FCM send succeeded for token[${i}]: messageId=${result.value}`);
      }
    }
  } catch (err) {
    console.error("[Push] Error sending push notification:", err);
  }
}
