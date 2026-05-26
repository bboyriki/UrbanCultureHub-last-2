/**
 * server/googleSyncRoutes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gmail + Google Calendar → Memory Calendar auto-import.
 *
 * OAuth flow:
 *   GET  /api/google-sync/auth-url          → returns an OAuth consent URL
 *   GET  /api/google-sync/callback          → exchanges code, stores tokens
 *
 * Connection management:
 *   GET  /api/google-sync/connections       → list this admin's connections
 *   PATCH /api/google-sync/connections/:id  → toggle syncGmail/syncCalendar
 *   DELETE /api/google-sync/connections/:id → disconnect
 *
 * Sync:
 *   POST /api/google-sync/sync/:id              → quick sync (7 days)
 *   POST /api/google-sync/deep-scan/:id         → full historical scan (background)
 *   GET  /api/google-sync/deep-scan-status      → get all scan progress
 *
 * Inbox:
 *   GET  /api/google-sync/inbox/:id             → browse Gmail inbox in-app
 *   GET  /api/google-sync/email/:connId/:msgId  → get full email content
 *   POST /api/google-sync/email/:connId/:msgId/detect → manually run AI on email
 *
 * Pending items (AI-detected appointments):
 *   GET  /api/google-sync/pending           → list pending items (newest first)
 *   POST /api/google-sync/pending/:id/approve → approve → creates memory event
 *   POST /api/google-sync/pending/:id/reject  → mark rejected
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import {
  googleSyncConnections,
  googleSyncPendingItems,
  memoryEvents,
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { aiChat } from "./aiRouter";

// ── helpers ───────────────────────────────────────────────────────────────

function getSessionUser(req: Request): { id: number; role: string } | null {
  const sessionUserId   = (req.session as any)?.userId;
  const sessionUserRole = (req.session as any)?.userRole;
  if (sessionUserId) return { id: Number(sessionUserId), role: String(sessionUserRole || "user") };
  const u: any = (req as any).user;
  if (u?.id) return { id: Number(u.id), role: String(u.role || "user") };
  return null;
}

const ADMIN_ROLES = ["admin", "super_admin"];

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const u = getSessionUser(req);
  if (!u) return res.status(401).json({ error: "Not authenticated" });
  if (!ADMIN_ROLES.includes(u.role)) return res.status(403).json({ error: "Admin only" });
  (req as any).syncUser = u;
  next();
}

const GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GMAIL_API           = "https://gmail.googleapis.com/gmail/v1";
const CALENDAR_API        = "https://www.googleapis.com/calendar/v3";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",      // read + trash/label (no send/delete)
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function getBaseUrl(): string {
  return (
    process.env.WEBHOOK_BASE_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000")
  );
}

function getCallbackUrlFromReq(req: any): string {
  const host  = req.headers["x-forwarded-host"] || req.headers.host || "";
  const proto = req.headers["x-forwarded-proto"] || "https";
  if (host && host !== "localhost:5000") return `${proto}://${host}/api/google-sync/callback`;
  return `${getBaseUrl()}/api/google-sync/callback`;
}

function getCallbackUrl(): string { return `${getBaseUrl()}/api/google-sync/callback`; }
function getClientId(): string    { return process.env.GOOGLE_OAUTH_CLIENT_ID || ""; }
function getClientSecret(): string { return process.env.GOOGLE_OAUTH_CLIENT_SECRET || ""; }

// ── token management ─────────────────────────────────────────────────────

export async function refreshGoogleToken(conn: any): Promise<string> {
  if (conn.accessToken && conn.accessTokenExpiresAt &&
      new Date(conn.accessTokenExpiresAt).getTime() - Date.now() > 90_000) {
    return conn.accessToken;
  }
  const body = new URLSearchParams({
    client_id:     getClientId(),
    client_secret: getClientSecret(),
    refresh_token: conn.refreshToken,
    grant_type:    "refresh_token",
  });
  const r    = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const json: any = await r.json();
  if (!r.ok) throw new Error(`Token refresh failed: ${json.error_description || json.error || r.statusText}`);
  const expiresAt = new Date(Date.now() + (json.expires_in - 90) * 1000);
  await db.update(googleSyncConnections)
    .set({ accessToken: json.access_token, accessTokenExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(googleSyncConnections.id, conn.id));
  return json.access_token;
}

// ── Gmail helpers ─────────────────────────────────────────────────────────

// Quick sync query — appointment-keyword filtered, last 7 days
const GMAIL_QUICK_QUERY =
  "(subject:appointment OR subject:meeting OR subject:afspraak OR subject:vergadering OR " +
  "subject:uitnodiging OR subject:invitation OR subject:schedule OR subject:booking OR " +
  "subject:reservation OR subject:reservering OR subject:confirmatie OR subject:confirmation OR " +
  "subject:reminder OR subject:herinnering OR subject:interview OR subject:call OR " +
  "subject:event OR subject:evenement) newer_than:7d";

// Deep scan query — broader keywords, no date limit, scans all inbox history
const GMAIL_DEEP_QUERY =
  "appointment OR meeting OR afspraak OR vergadering OR uitnodiging OR invitation OR " +
  "schedule OR booking OR reservation OR reservering OR confirmatie OR confirmation OR " +
  "reminder OR herinnering OR interview OR event OR evenement OR afspreken OR boeking OR " +
  "ticketing OR registratie OR inschrijving OR aanmelding";

async function listGmailMessages(
  accessToken: string,
  options: { query?: string; maxResults?: number; pageToken?: string } = {}
): Promise<{ messages: any[]; nextPageToken?: string }> {
  const max = options.maxResults ?? 20;
  // Only include q param when there's an actual query — empty q= returns nothing from Gmail API
  const query = options.query != null ? options.query : GMAIL_QUICK_QUERY;
  let url = `${GMAIL_API}/users/me/messages?maxResults=${max}`;
  if (query) url += `&q=${encodeURIComponent(query)}`;
  if (options.pageToken) url += `&pageToken=${encodeURIComponent(options.pageToken)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Gmail list error ${r.status}: ${t.slice(0, 200)}`);
  }
  const data: any = await r.json();
  return { messages: data.messages || [], nextPageToken: data.nextPageToken };
}

// Metadata-only (fast, for quick scan)
async function getGmailMessageMeta(accessToken: string, id: string): Promise<any> {
  const url = `${GMAIL_API}/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=From&metadataHeaders=To`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`Gmail get error ${r.status}`);
  return r.json();
}

// Full message with body (for deep scan + inbox viewer)
async function getGmailMessageFull(accessToken: string, id: string): Promise<any> {
  const url = `${GMAIL_API}/users/me/messages/${id}?format=full`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`Gmail get error ${r.status}`);
  return r.json();
}

function extractHeader(msg: any, name: string): string {
  const headers: any[] = msg?.payload?.headers || [];
  return headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

// Decode base64url-encoded Gmail body parts recursively
function decodeGmailBody(payload: any): string {
  if (!payload) return "";
  // If it's a text/plain part with data
  if (payload.body?.data && (payload.mimeType === "text/plain" || payload.mimeType === "text/html")) {
    try {
      const buf = Buffer.from(payload.body.data, "base64");
      let text = buf.toString("utf8");
      if (payload.mimeType === "text/html") {
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                   .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                   .replace(/<[^>]+>/g, " ")
                   .replace(/&nbsp;/g, " ")
                   .replace(/&amp;/g, "&")
                   .replace(/&lt;/g, "<")
                   .replace(/&gt;/g, ">")
                   .replace(/\s{3,}/g, "\n\n")
                   .trim();
      }
      return text;
    } catch { return ""; }
  }
  // Recurse into parts — prefer text/plain first
  if (payload.parts?.length) {
    const plain = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (plain) { const t = decodeGmailBody(plain); if (t) return t; }
    const html  = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (html)  { const t = decodeGmailBody(html);  if (t) return t; }
    // multipart — recurse all
    for (const part of payload.parts) {
      const t = decodeGmailBody(part);
      if (t) return t;
    }
  }
  return "";
}

// ── AI appointment detection ──────────────────────────────────────────────

// ── Timezone helpers ──────────────────────────────────────────────────────

/** Returns the current UTC offset for Europe/Amsterdam as "+02:00" or "+01:00". */
function getAmsterdamOffset(date: Date = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Amsterdam",
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(date);
    const tz = parts.find(p => p.type === "timeZoneName")?.value ?? "GMT+1";
    // tz is like "GMT+2" or "GMT+1"
    const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!m) return "+01:00";
    const sign = m[1];
    const h    = m[2].padStart(2, "0");
    const min  = (m[3] ?? "00").padStart(2, "0");
    return `${sign}${h}:${min}`;
  } catch {
    return "+01:00";
  }
}

/**
 * Parse an AI-returned date string correctly.
 * - If the string already contains a timezone offset or Z, parse as-is.
 * - Otherwise treat as Europe/Amsterdam local time (append the current offset).
 */
function parseAIDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // Already timezone-aware?
  if (/[Zz]$/.test(dateStr) || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  // Naive string — interpret as Amsterdam local time
  const approx  = new Date(dateStr);
  const offset   = getAmsterdamOffset(isNaN(approx.getTime()) ? new Date() : approx);
  const d = new Date(`${dateStr}${offset}`);
  return isNaN(d.getTime()) ? null : d;
}

const DETECT_SYSTEM = `
You are a strict appointment-detection assistant for a Dutch urban culture professional.
Your job: detect ONLY real, personal, confirmed appointments that involve the recipient directly.

Reply VALID JSON ONLY (no markdown):
{
  "isAppointment": true | false,
  "title":         "string — short event title (max 80 chars)",
  "date":          "ISO-8601 with Europe/Amsterdam timezone offset, e.g. 2026-05-01T14:30:00+02:00 (summer) or 2026-01-10T09:00:00+01:00 (winter). Use null if the exact date/time is unknown.",
  "location":      "string or null",
  "description":   "string — one sentence summary in the language of the email"
}

✅ IS an appointment (isAppointment: true):
• Doctor/dentist/specialist visit confirmation
• Business meeting or call with a specific named person (e.g. "your meeting with Jan on Tuesday")
• Restaurant/venue reservation confirmation (with date + time)
• Hotel/flight/transport booking confirmation
• Job interview scheduled
• Government/municipality appointment (gemeente, belastingdienst, etc.)
• Court/legal/notary appointment
• Personal service appointment (kapper, tandarts, fysiotherapeut, etc.)
• Calendar invite from a real person requesting a specific time
• Workshop/training that was booked/registered (with confirmation number or date)

❌ NOT an appointment (isAppointment: false) — STRICTLY reject:
• Any marketing or promotional email ("sale", "korting", "aanbieding", "% off")
• Newsletters, digests, blog posts, weekly updates
• Social media notifications (LinkedIn, Instagram, Facebook, TikTok)
• App notifications, push notification emails
• System emails (password reset, account updates, security alerts)
• Event announcements the user has NOT booked ("join us", "you're invited to browse")
• Ticketing platform emails where no actual booking/purchase was made
• Order confirmations for physical products (not a time-based appointment)
• Shipping/delivery notifications
• Emails from generic no-reply addresses with no specific time/date for the user
• Anything that looks like bulk/mass-sent email (unsubscribe link = NOT appointment)

Rules:
• Past appointments (past date) are still valid — include them.
• If there is NO specific date+time for the user, set "date" to null but still flag if appointment.
• If you see "unsubscribe" anywhere → almost certainly not a real appointment.
• Dutch and English are both valid. Also Moroccan/Arabic context is valid.
• When in doubt, return isAppointment: false. Be conservative.
`.trim();

// ── AI email categorization (batch) ──────────────────────────────────────

const CATEGORIZE_SYSTEM = `
You categorize emails into one of these categories:
- marketing: promotional, sales, discount, offers, ads, sponsored
- newsletter: weekly/monthly digest, blog posts, news updates, "unsubscribe" at bottom
- notification: automated system alerts, app notifications, account updates, security
- receipt: purchase confirmations, invoices, payment receipts, shipping updates
- social: LinkedIn, Instagram, Facebook, Twitter/X, TikTok, WhatsApp, dating apps
- appointment: confirmed meeting/booking with a specific date/time for the recipient
- personal: written by a real person directly to the recipient (not mass-sent)
- work: professional/work email, not appointment or personal
- spam: unsolicited junk, phishing, scam
- other: anything that doesn't fit above

You receive a JSON array of emails. Reply with a JSON array (same order) of category objects.
No markdown. Pure JSON array only.
Example input: [{"id":"1","from":"news@co.com","subject":"Weekly digest"},...]
Example reply: [{"id":"1","category":"newsletter","confidence":"high"},...]
`.trim();

interface OrganizerResult {
  status: "idle" | "running" | "done" | "error";
  scanned: number;
  total: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  emails: CategorizedEmail[];
  error?: string;
}
interface CategorizedEmail {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  category: string;
  confidence: string;
}
const organizerCache = new Map<number, OrganizerResult>();

function getOrganizerResult(connId: number): OrganizerResult {
  return organizerCache.get(connId) ?? {
    status: "idle", scanned: 0, total: 0,
    startedAt: null, finishedAt: null, emails: [],
  };
}

type OrganizerProvider = "openai" | "anthropic";

async function categorizeBatch(
  emails: any[],
  provider: OrganizerProvider = "openai"
): Promise<{ id: string; category: string; confidence: string }[]> {
  if (!emails.length) return [];
  const input = emails.map(e => ({
    id:      e.id,
    from:    (e.from    || "").slice(0, 80),
    subject: (e.subject || "").slice(0, 100),
    snippet: (e.snippet || "").slice(0, 150),
  }));
  const userContent = JSON.stringify(input);

  try {
    let text = "";

    if (provider === "openai") {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
        ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
      });
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CATEGORIZE_SYSTEM + "\nReturn JSON: { \"results\": [...] }" },
          { role: "user",   content: userContent },
        ],
      });
      const raw = res.choices[0]?.message?.content || "{}";
      const obj = JSON.parse(raw);
      // support both { results: [...] } and plain array
      text = JSON.stringify(Array.isArray(obj) ? obj : (obj.results || []));
    } else {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
        ...(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL } : {}),
      });
      const res = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        temperature: 0.1,
        system: CATEGORIZE_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      });
      text = (res.content[0] as any)?.text || "[]";
    }

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    const parsed  = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e: any) {
    console.error("[Organizer] categorizeBatch error:", e?.message);
    return [];
  }
}

const ORGANIZER_BATCH_SIZE = 25;   // emails per AI call
const ORGANIZER_CONCURRENCY = 4;   // parallel AI calls at once
const ORGANIZER_MAX_EMAILS  = 300; // total emails to scan

async function runOrganizerScan(
  connId: number,
  provider: OrganizerProvider = "openai"
): Promise<void> {
  const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, connId)).limit(1);
  if (!conn) return;

  organizerCache.set(connId, {
    status: "running", scanned: 0, total: 0,
    startedAt: new Date(), finishedAt: null, emails: [],
  });

  try {
    const accessToken = await refreshGoogleToken(conn);

    // ── 1. Collect all message IDs (up to ORGANIZER_MAX_EMAILS) ────────────
    const allMsgIds: string[] = [];
    let pageToken: string | undefined;
    do {
      const { messages, nextPageToken } = await listGmailMessages(accessToken, {
        query: "", maxResults: 50, pageToken,
      });
      if (!messages?.length) break;
      for (const m of messages) allMsgIds.push(m.id);
      pageToken = nextPageToken;
      if (allMsgIds.length >= ORGANIZER_MAX_EMAILS) break;
    } while (pageToken);

    const msgIds = allMsgIds.slice(0, ORGANIZER_MAX_EMAILS);
    organizerCache.set(connId, { ...getOrganizerResult(connId), total: msgIds.length });
    console.log(`[Organizer] conn=${connId} provider=${provider} fetching metadata for ${msgIds.length} emails…`);

    // ── 2. Fetch metadata for all messages in parallel ─────────────────────
    const metaResults = await Promise.allSettled(
      msgIds.map(id => getGmailMessageMeta(accessToken, id))
    );
    const rawEmails: any[] = metaResults
      .map((r, i) => {
        if (r.status === "rejected") return null;
        const msg = r.value;
        return {
          id:      msgIds[i],
          from:    extractHeader(msg, "from"),
          subject: extractHeader(msg, "subject") || "(no subject)",
          date:    extractHeader(msg, "date"),
          snippet: (msg.snippet || "").slice(0, 150),
        };
      })
      .filter(Boolean);

    // ── 3. Split into batches ───────────────────────────────────────────────
    const batches: any[][] = [];
    for (let i = 0; i < rawEmails.length; i += ORGANIZER_BATCH_SIZE) {
      batches.push(rawEmails.slice(i, i + ORGANIZER_BATCH_SIZE));
    }

    // ── 4. Run AI in parallel pools of ORGANIZER_CONCURRENCY ───────────────
    const allCategorized: CategorizedEmail[] = [];
    let scanned = 0;

    for (let i = 0; i < batches.length; i += ORGANIZER_CONCURRENCY) {
      const pool = batches.slice(i, i + ORGANIZER_CONCURRENCY);
      const poolResults = await Promise.all(
        pool.map(batch => categorizeBatch(batch, provider))
      );
      for (let j = 0; j < pool.length; j++) {
        const batch   = pool[j];
        const cats    = poolResults[j];
        const catMap  = new Map(cats.map(c => [c.id, c]));
        for (const em of batch) {
          const cat = catMap.get(em.id);
          allCategorized.push({
            id:         em.id,
            from:       em.from,
            subject:    em.subject,
            date:       em.date,
            snippet:    em.snippet,
            category:   cat?.category   || "other",
            confidence: cat?.confidence || "low",
          });
        }
        scanned += batch.length;
      }
      organizerCache.set(connId, {
        ...getOrganizerResult(connId),
        status: "running", scanned, total: rawEmails.length,
        emails: [...allCategorized],
      });
    }

    organizerCache.set(connId, {
      status: "done", scanned, total: scanned,
      startedAt: getOrganizerResult(connId).startedAt, finishedAt: new Date(),
      emails: allCategorized,
    });
    console.log(`[Organizer] conn=${connId} done: ${scanned} emails via ${provider}`);
  } catch (e: any) {
    organizerCache.set(connId, {
      ...getOrganizerResult(connId),
      status: "error", error: e.message, finishedAt: new Date(),
    });
    console.error(`[Organizer] conn=${connId} error:`, e.message);
  }
}

async function detectAppointment(
  subject: string,
  from: string,
  emailDate: string,
  snippet: string,
  fullBody?: string
): Promise<{ isAppointment: boolean; title: string; date: string | null; location: string | null; description: string } | null> {
  const bodySection = fullBody
    ? `\nBody (first 1200 chars):\n${fullBody.slice(0, 1200)}`
    : "";
  const prompt = `Subject: ${subject}\nFrom: ${from}\nDate: ${emailDate}\nSnippet: ${snippet.slice(0, 400)}${bodySection}`;
  try {
    const r = await aiChat({
      role: "finder",
      system: DETECT_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 350,
    });
    const text   = r.text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed.isAppointment !== "boolean") return null;
    return parsed;
  } catch { return null; }
}

// ── Google Calendar helpers ───────────────────────────────────────────────

async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  options: { syncToken?: string | null; includePast?: boolean } = {}
): Promise<{ events: any[]; nextSyncToken: string | null }> {
  let url: string;
  if (options.syncToken) {
    url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?syncToken=${encodeURIComponent(options.syncToken)}&singleEvents=true`;
  } else {
    // Go 1 year back + 1 year forward so past appointments are included
    const from = options.includePast
      ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()  // 1 year ago
      : new Date().toISOString();
    const to   = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year ahead
    url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}&singleEvents=true&orderBy=startTime&maxResults=500`;
  }
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) {
    if (r.status === 410) return { events: [], nextSyncToken: null }; // full sync needed
    const t = await r.text();
    throw new Error(`Calendar list error ${r.status}: ${t.slice(0, 200)}`);
  }
  const data: any = await r.json();
  return { events: data.items || [], nextSyncToken: data.nextSyncToken || null };
}

// ── Deep scan progress tracking (in-memory) ───────────────────────────────

interface ScanProgress {
  status: "idle" | "running" | "done" | "error";
  scanned: number;
  found: number;
  total: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  error?: string;
}
const deepScanProgress = new Map<number, ScanProgress>();

function getScanProgress(connId: number): ScanProgress {
  return deepScanProgress.get(connId) ?? {
    status: "idle", scanned: 0, found: 0, total: 0,
    startedAt: null, finishedAt: null,
  };
}

// ── Core sync function (quick — 7 days) ──────────────────────────────────

export async function syncConnection(connId: number): Promise<{ gmailNew: number; calendarNew: number; errors: string[] }> {
  const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, connId)).limit(1);
  if (!conn) throw new Error("Connection not found");

  const errors: string[] = [];
  let gmailNew    = 0;
  let calendarNew = 0;

  const accessToken = await refreshGoogleToken(conn);

  // ── Gmail quick scan ──
  if (conn.syncGmail) {
    try {
      const { messages } = await listGmailMessages(accessToken, { query: GMAIL_QUICK_QUERY, maxResults: 30 });

      const existingRows = await db.select({ externalId: googleSyncPendingItems.externalId })
        .from(googleSyncPendingItems)
        .where(and(eq(googleSyncPendingItems.connectionId, connId), eq(googleSyncPendingItems.source, "gmail")));
      const existingIds = new Set(existingRows.map(r => r.externalId));

      for (const msg of messages) {
        if (existingIds.has(msg.id)) continue;
        try {
          const full      = await getGmailMessageMeta(accessToken, msg.id);
          const subject   = extractHeader(full, "subject")  || "(no subject)";
          const from      = extractHeader(full, "from")     || "";
          const emailDate = extractHeader(full, "date")     || "";
          const snippet   = full.snippet || "";

          const detected = await detectAppointment(subject, from, emailDate, snippet);
          if (!detected?.isAppointment) continue;

          await db.insert(googleSyncPendingItems).values({
            connectionId:  connId,
            ownerUserId:   conn.ownerUserId,
            source:        "gmail",
            externalId:    msg.id,
            title:         detected.title || subject,
            suggestedDate: parseAIDate(detected.date),
            location:      detected.location || null,
            description:   detected.description || snippet.slice(0, 500),
            rawSnippet:    `From: ${from}\nSubject: ${subject}\n\n${snippet}`.slice(0, 1000),
            status:        "pending",
          }).onConflictDoNothing();
          gmailNew++;
        } catch (e: any) { errors.push(`gmail:${msg.id}: ${e.message}`); }
      }

      await db.update(googleSyncConnections)
        .set({ lastGmailSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(googleSyncConnections.id, connId));
    } catch (e: any) { errors.push(`gmail-scan: ${e.message}`); }
  }

  // ── Google Calendar (include past 1 year + next 1 year) ──
  if (conn.syncCalendar) {
    try {
      const { events } = await listCalendarEvents(accessToken, conn.calendarId || "primary", { includePast: true });

      const existingRows = await db.select({ externalId: googleSyncPendingItems.externalId })
        .from(googleSyncPendingItems)
        .where(and(eq(googleSyncPendingItems.connectionId, connId), eq(googleSyncPendingItems.source, "calendar")));
      const existingIds = new Set(existingRows.map(r => r.externalId));

      for (const ev of events) {
        if (!ev.id || ev.status === "cancelled") continue;
        if (existingIds.has(ev.id)) continue;

        const startRaw      = ev.start?.dateTime || ev.start?.date;
        const suggestedDate = startRaw ? new Date(startRaw) : null;
        const title         = ev.summary || "(no title)";
        const location      = ev.location || null;
        const description   = ev.description ? ev.description.replace(/<[^>]+>/g, "").slice(0, 500) : null;
        const isPast        = suggestedDate ? suggestedDate < new Date() : false;

        await db.insert(googleSyncPendingItems).values({
          connectionId:    connId,
          ownerUserId:     conn.ownerUserId,
          source:          "calendar",
          externalId:      ev.id,
          title,
          suggestedDate,
          location,
          description:     `${isPast ? "[Past event] " : ""}${description || ""}`.trim(),
          rawSnippet:      `Organizer: ${ev.organizer?.email || "—"}\nAttendees: ${(ev.attendees || []).map((a: any) => a.email).join(", ") || "—"}`,
          calendarEventId: ev.id,
          status:          "pending",
        }).onConflictDoNothing();
        calendarNew++;
      }

      await db.update(googleSyncConnections)
        .set({ lastCalendarSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(googleSyncConnections.id, connId));
    } catch (e: any) { errors.push(`calendar-scan: ${e.message}`); }
  }

  return { gmailNew, calendarNew, errors };
}

// ── Deep scan (historical — all email, full body, background) ─────────────

async function runDeepScan(connId: number): Promise<void> {
  const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, connId)).limit(1);
  if (!conn) return;

  deepScanProgress.set(connId, { status: "running", scanned: 0, found: 0, total: 0, startedAt: new Date(), finishedAt: null });

  try {
    const accessToken = await refreshGoogleToken(conn);

    // Load all existing gmail external IDs for this connection so we don't re-process
    const existingRows = await db.select({ externalId: googleSyncPendingItems.externalId })
      .from(googleSyncPendingItems)
      .where(and(eq(googleSyncPendingItems.connectionId, connId), eq(googleSyncPendingItems.source, "gmail")));
    const existingIds = new Set(existingRows.map(r => r.externalId));

    let pageToken: string | undefined;
    let totalScanned = 0;
    let totalFound   = 0;
    const MAX_EMAILS = 600; // Safety cap — covers ~2 years for typical inbox

    do {
      const { messages, nextPageToken } = await listGmailMessages(accessToken, {
        query:      GMAIL_DEEP_QUERY,
        maxResults: 50,
        pageToken,
      });

      // Update total estimate
      deepScanProgress.set(connId, {
        ...getScanProgress(connId),
        status:  "running",
        scanned: totalScanned,
        found:   totalFound,
        total:   totalScanned + messages.length,
      });

      for (const msg of messages) {
        if (existingIds.has(msg.id)) {
          totalScanned++;
          continue;
        }
        try {
          // Full body read for better AI accuracy
          const full      = await getGmailMessageFull(accessToken, msg.id);
          const subject   = extractHeader(full, "subject")  || "(no subject)";
          const from      = extractHeader(full, "from")     || "";
          const emailDate = extractHeader(full, "date")     || "";
          const snippet   = full.snippet || "";
          const body      = decodeGmailBody(full.payload);

          const detected = await detectAppointment(subject, from, emailDate, snippet, body);
          if (detected?.isAppointment) {
            await db.insert(googleSyncPendingItems).values({
              connectionId:  connId,
              ownerUserId:   conn.ownerUserId,
              source:        "gmail",
              externalId:    msg.id,
              title:         detected.title || subject,
              suggestedDate: parseAIDate(detected.date),
              location:      detected.location || null,
              description:   detected.description || snippet.slice(0, 500),
              rawSnippet:    `From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 800) || snippet}`.slice(0, 1000),
              status:        "pending",
            }).onConflictDoNothing();
            existingIds.add(msg.id);
            totalFound++;
          }
        } catch { /* skip individual failures */ }

        totalScanned++;

        // Small delay every 10 emails to avoid rate limits
        if (totalScanned % 10 === 0) {
          await new Promise(r => setTimeout(r, 500));
          deepScanProgress.set(connId, {
            ...getScanProgress(connId),
            scanned: totalScanned,
            found:   totalFound,
          });
        }
      }

      pageToken = nextPageToken;
      if (totalScanned >= MAX_EMAILS) break;
    } while (pageToken);

    await db.update(googleSyncConnections)
      .set({ lastGmailSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(googleSyncConnections.id, connId));

    deepScanProgress.set(connId, {
      status: "done", scanned: totalScanned, found: totalFound,
      total: totalScanned, startedAt: getScanProgress(connId).startedAt, finishedAt: new Date(),
    });

    console.log(`[GoogleSync] Deep scan conn=${connId} complete: scanned=${totalScanned} found=${totalFound}`);
  } catch (e: any) {
    deepScanProgress.set(connId, {
      ...getScanProgress(connId),
      status: "error", error: e.message, finishedAt: new Date(),
    });
    console.error(`[GoogleSync] Deep scan conn=${connId} error:`, e.message);
  }
}

// ── Register routes ───────────────────────────────────────────────────────

export function registerGoogleSyncRoutes(app: Express) {

  // ── OAuth: auth URL ──
  app.get("/api/google-sync/auth-url", requireAdmin, (req, res) => {
    const clientId = getClientId();
    if (!clientId) return res.status(503).json({ error: "GOOGLE_OAUTH_CLIENT_ID not configured" });

    const u     = (req as any).syncUser;
    const state = Buffer.from(JSON.stringify({ userId: u.id, ts: Date.now() })).toString("base64url");

    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  getCallbackUrlFromReq(req),
      response_type: "code",
      scope:         SCOPES.join(" "),
      access_type:   "offline",
      prompt:        "consent select_account",
      state,
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  });

  // ── OAuth: callback ──
  app.get("/api/google-sync/callback", async (req, res) => {
    const code  = String(req.query.code  || "");
    const state = String(req.query.state || "");
    const errQ  = String(req.query.error || "");

    if (errQ) return res.redirect(`/admin/memory-calendar?google_error=${encodeURIComponent(errQ)}`);
    if (!code) return res.redirect("/admin/memory-calendar?google_error=no_code");

    let userId: number;
    try {
      const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
      userId = Number(parsed.userId);
      if (!userId) throw new Error("bad state");
    } catch { return res.redirect("/admin/memory-calendar?google_error=invalid_state"); }

    try {
      const tokenBody = new URLSearchParams({
        client_id:     getClientId(),
        client_secret: getClientSecret(),
        code,
        redirect_uri:  getCallbackUrlFromReq(req),
        grant_type:    "authorization_code",
      });
      const tr = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tokenBody });
      const tokens: any = await tr.json();
      if (!tr.ok) throw new Error(tokens.error_description || tokens.error || "Token exchange failed");

      const ur = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const userInfo: any = await ur.json();
      const email = userInfo.email || `user-${userId}@google`;

      const expiresAt = new Date(Date.now() + (tokens.expires_in - 90) * 1000);
      await db.insert(googleSyncConnections).values({
        ownerUserId:          userId,
        email,
        refreshToken:         tokens.refresh_token,
        accessToken:          tokens.access_token,
        accessTokenExpiresAt: expiresAt,
        scopes:               SCOPES,
        syncGmail:            true,
        syncCalendar:         true,
      }).onConflictDoUpdate({
        target: [googleSyncConnections.ownerUserId, googleSyncConnections.email],
        set: {
          refreshToken:         tokens.refresh_token || sql`EXCLUDED.refresh_token`,
          accessToken:          tokens.access_token,
          accessTokenExpiresAt: expiresAt,
          scopes:               SCOPES,
          updatedAt:            new Date(),
        },
      });

      res.redirect("/admin/memory-calendar?tab=google&google_connected=1");
    } catch (e: any) {
      console.error("[GoogleSync] callback error:", e);
      res.redirect(`/admin/memory-calendar?tab=google&google_error=${encodeURIComponent(e.message || "Unknown error")}`);
    }
  });

  // ── List connections ──
  app.get("/api/google-sync/connections", requireAdmin, async (req, res) => {
    const u = (req as any).syncUser;
    const rows = await db.select().from(googleSyncConnections)
      .where(eq(googleSyncConnections.ownerUserId, u.id))
      .orderBy(desc(googleSyncConnections.createdAt));
    res.json(rows.map(r => ({ ...r, refreshToken: undefined })));
  });

  // ── Toggle settings ──
  app.patch("/api/google-sync/connections/:id", requireAdmin, async (req, res) => {
    const u  = (req as any).syncUser;
    const id = Number(req.params.id);
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, id)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    const allowed = ["syncGmail", "syncCalendar", "calendarId"] as const;
    const patch: any = { updatedAt: new Date() };
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    const [updated] = await db.update(googleSyncConnections).set(patch).where(eq(googleSyncConnections.id, id)).returning();
    res.json({ ...updated, refreshToken: undefined });
  });

  // ── Disconnect ──
  app.delete("/api/google-sync/connections/:id", requireAdmin, async (req, res) => {
    const u  = (req as any).syncUser;
    const id = Number(req.params.id);
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, id)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    await db.delete(googleSyncConnections).where(eq(googleSyncConnections.id, id));
    deepScanProgress.delete(id);
    res.json({ ok: true });
  });

  // ── Quick manual sync (7 days) ──
  app.post("/api/google-sync/sync/:id", requireAdmin, async (req, res) => {
    const u  = (req as any).syncUser;
    const id = Number(req.params.id);
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, id)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    try {
      const result = await syncConnection(id);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Deep scan — starts in background, returns immediately ──
  app.post("/api/google-sync/deep-scan/:id", requireAdmin, async (req, res) => {
    const u  = (req as any).syncUser;
    const id = Number(req.params.id);
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, id)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    const prog = getScanProgress(id);
    if (prog.status === "running") return res.json({ ok: true, message: "Already running", progress: prog });
    // Fire and forget
    runDeepScan(id).catch(() => {});
    res.json({ ok: true, message: "Deep scan started" });
  });

  // ── Deep scan status ──
  app.get("/api/google-sync/deep-scan-status", requireAdmin, async (req, res) => {
    const u = (req as any).syncUser;
    const conns = await db.select({ id: googleSyncConnections.id })
      .from(googleSyncConnections)
      .where(eq(googleSyncConnections.ownerUserId, u.id));
    const result: Record<number, ScanProgress> = {};
    for (const c of conns) result[c.id] = getScanProgress(c.id);
    res.json(result);
  });

  // ── Inbox browser — list emails for viewing ──
  app.get("/api/google-sync/inbox/:id", requireAdmin, async (req, res) => {
    const u      = (req as any).syncUser;
    const id     = Number(req.params.id);
    const page   = Number(req.query.page  || 1);
    const filter = String(req.query.filter || "all"); // "all" | "appointments"
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, id)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });

    try {
      const accessToken = await refreshGoogleToken(conn);

      // Build query based on filter — empty string means list all messages (no q param)
      const query = filter === "appointments" ? GMAIL_DEEP_QUERY : "";
      console.log(`[Inbox] conn=${id} filter="${filter}" query="${query.slice(0, 60) || "(all)"}"`);

      const { messages, nextPageToken } = await listGmailMessages(accessToken, {
        query,
        maxResults: 25,
        pageToken:  req.query.pageToken as string | undefined,
      });

      console.log(`[Inbox] Gmail returned ${messages.length} messages`);

      if (!messages.length) {
        // Do a raw test call to see what Gmail returns directly
        const testUrl = `https://gmail.googleapis.com/gmail/v1/users/me/profile`;
        const testR = await fetch(testUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        const testData: any = await testR.json();
        console.log(`[Inbox] Gmail profile test: status=${testR.status} emailAddress=${testData.emailAddress} messagesTotal=${testData.messagesTotal}`);
        return res.json({ emails: [], nextPageToken: null, debug: { profileStatus: testR.status, profileData: testData } });
      }

      // Get existing detection statuses for these message IDs
      const msgIds = messages.map((m: any) => m.id);
      const detected = await db.select({
        externalId: googleSyncPendingItems.externalId,
        status:     googleSyncPendingItems.status,
        title:      googleSyncPendingItems.title,
      }).from(googleSyncPendingItems)
        .where(and(
          eq(googleSyncPendingItems.connectionId, id),
          eq(googleSyncPendingItems.source, "gmail"),
          inArray(googleSyncPendingItems.externalId, msgIds),
        ));
      const detectedMap = new Map(detected.map(d => [d.externalId, d]));

      // Fetch metadata for each message in parallel (capped at 25)
      const emailDetails = await Promise.allSettled(
        messages.map((msg: any) => getGmailMessageMeta(accessToken, msg.id))
      );

      const emails = emailDetails.map((r, i) => {
        const msgId = messages[i].id;
        if (r.status === "rejected") return { id: msgId, error: true };
        const msg = r.value;
        const det = detectedMap.get(msgId);
        return {
          id:        msgId,
          subject:   extractHeader(msg, "subject")  || "(no subject)",
          from:      extractHeader(msg, "from")      || "",
          date:      extractHeader(msg, "date")      || "",
          snippet:   (msg.snippet || "").slice(0, 200),
          detectionStatus: det?.status || null,
          detectedTitle:   det?.title  || null,
        };
      });

      res.json({ emails, nextPageToken: nextPageToken || null });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Get full email content ──
  app.get("/api/google-sync/email/:connId/:msgId", requireAdmin, async (req, res) => {
    const u      = (req as any).syncUser;
    const connId = Number(req.params.connId);
    const msgId  = req.params.msgId;
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, connId)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    try {
      const accessToken = await refreshGoogleToken(conn);
      const full        = await getGmailMessageFull(accessToken, msgId);
      const body        = decodeGmailBody(full.payload);
      res.json({
        id:      msgId,
        subject: extractHeader(full, "subject"),
        from:    extractHeader(full, "from"),
        to:      extractHeader(full, "to"),
        date:    extractHeader(full, "date"),
        snippet: full.snippet || "",
        body:    body.slice(0, 8000),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Manually run AI detection on a specific email ──
  app.post("/api/google-sync/email/:connId/:msgId/detect", requireAdmin, async (req, res) => {
    const u      = (req as any).syncUser;
    const connId = Number(req.params.connId);
    const msgId  = req.params.msgId;
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, connId)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });

    try {
      const accessToken = await refreshGoogleToken(conn);
      const full        = await getGmailMessageFull(accessToken, msgId);
      const subject     = extractHeader(full, "subject") || "(no subject)";
      const from        = extractHeader(full, "from")    || "";
      const emailDate   = extractHeader(full, "date")    || "";
      const snippet     = full.snippet || "";
      const body        = decodeGmailBody(full.payload);

      const detected = await detectAppointment(subject, from, emailDate, snippet, body);
      if (!detected) return res.json({ isAppointment: false });

      if (detected.isAppointment) {
        await db.insert(googleSyncPendingItems).values({
          connectionId:  connId,
          ownerUserId:   u.id,
          source:        "gmail",
          externalId:    msgId,
          title:         detected.title || subject,
          suggestedDate: parseAIDate(detected.date),
          location:      detected.location || null,
          description:   detected.description || snippet.slice(0, 500),
          rawSnippet:    `From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 800) || snippet}`.slice(0, 1000),
          status:        "pending",
        }).onConflictDoNothing();
      }

      res.json(detected);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Trash a single email ──
  app.post("/api/google-sync/email/:connId/:msgId/trash", requireAdmin, async (req, res) => {
    const u      = (req as any).syncUser;
    const connId = Number(req.params.connId);
    const msgId  = req.params.msgId;
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, connId)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    try {
      const accessToken = await refreshGoogleToken(conn);
      const r = await fetch(`${GMAIL_API}/users/me/messages/${msgId}/trash`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) {
        const t = await r.text();
        if (r.status === 403) return res.status(403).json({ error: "Permission denied — please reconnect your Gmail account to grant trash access.", needsReconnect: true });
        return res.status(r.status).json({ error: t.slice(0, 200) });
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Batch-trash emails ──
  app.post("/api/google-sync/inbox/:connId/batch-trash", requireAdmin, async (req, res) => {
    const u      = (req as any).syncUser;
    const connId = Number(req.params.connId);
    const ids: string[] = req.body?.ids || [];
    if (!ids.length) return res.status(400).json({ error: "No message IDs provided" });
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, connId)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    try {
      const accessToken = await refreshGoogleToken(conn);
      let trashed = 0;
      const errors: string[] = [];
      for (const msgId of ids) {
        try {
          const r = await fetch(`${GMAIL_API}/users/me/messages/${msgId}/trash`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (r.ok) trashed++;
          else {
            const t = await r.text();
            if (r.status === 403) return res.status(403).json({ error: "Permission denied — please reconnect your Gmail account.", needsReconnect: true });
            errors.push(`${msgId}: ${r.status}`);
          }
        } catch (e: any) { errors.push(`${msgId}: ${e.message}`); }
      }
      res.json({ ok: true, trashed, errors });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Gmail Organizer — get cached results ──
  app.get("/api/google-sync/organize/:connId", requireAdmin, async (req, res) => {
    const u      = (req as any).syncUser;
    const connId = Number(req.params.connId);
    const [conn] = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, connId)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    res.json(getOrganizerResult(connId));
  });

  // ── Gmail Organizer — start scan ──
  app.post("/api/google-sync/organize/:connId/scan", requireAdmin, async (req, res) => {
    const u        = (req as any).syncUser;
    const connId   = Number(req.params.connId);
    const provider: OrganizerProvider = req.body?.provider === "anthropic" ? "anthropic" : "openai";
    const [conn]   = await db.select().from(googleSyncConnections).where(eq(googleSyncConnections.id, connId)).limit(1);
    if (!conn || conn.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    const cur = getOrganizerResult(connId);
    if (cur.status === "running") return res.json({ ok: true, message: "Already running" });
    runOrganizerScan(connId, provider).catch(() => {});
    res.json({ ok: true, message: "Organizer scan started", provider });
  });

  // ── Pending items list ──
  app.get("/api/google-sync/pending", requireAdmin, async (req, res) => {
    const u      = (req as any).syncUser;
    const status = String(req.query.status || "pending");
    const rows   = await db.select().from(googleSyncPendingItems)
      .where(and(eq(googleSyncPendingItems.ownerUserId, u.id), eq(googleSyncPendingItems.status, status)))
      .orderBy(desc(googleSyncPendingItems.createdAt))
      .limit(100);
    res.json(rows);
  });

  // ── Approve → create Memory Calendar event ──
  app.post("/api/google-sync/pending/:id/approve", requireAdmin, async (req, res) => {
    const u   = (req as any).syncUser;
    const id  = Number(req.params.id);
    const [item] = await db.select().from(googleSyncPendingItems).where(eq(googleSyncPendingItems.id, id)).limit(1);
    if (!item || item.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    if (item.status !== "pending") return res.status(400).json({ error: "Already processed" });

    try {
      const title       = String(req.body?.title || item.title);
      const eventDate   = req.body?.eventDate ? new Date(req.body.eventDate) : (item.suggestedDate || new Date());
      const location    = req.body?.location    || item.location    || null;
      const description = req.body?.description || item.description || null;

      const [created] = await db.insert(memoryEvents).values({
        ownerUserId:  u.id,
        title,
        eventDate,
        location,
        description,
        category:     "general",
        priority:     "medium",
        reminderTone: "professional",
        notifyEmail:  true,
        notifyPush:   true,
        reminders:    JSON.stringify([{ minutesBefore: 60, channel: "both" }]),
      }).returning();

      await db.update(googleSyncPendingItems)
        .set({ status: "approved", calendarEventId: String(created.id) })
        .where(eq(googleSyncPendingItems.id, id));

      const { storage } = await import("./storage");
      if (typeof (storage as any).generateRemindersForEvent === "function") {
        await (storage as any).generateRemindersForEvent(created.id, created as any);
      }

      res.json({ ok: true, eventId: created.id });
    } catch (e: any) {
      console.error("[GoogleSync] approve error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Reject ──
  app.post("/api/google-sync/pending/:id/reject", requireAdmin, async (req, res) => {
    const u  = (req as any).syncUser;
    const id = Number(req.params.id);
    const [item] = await db.select().from(googleSyncPendingItems).where(eq(googleSyncPendingItems.id, id)).limit(1);
    if (!item || item.ownerUserId !== u.id) return res.status(404).json({ error: "Not found" });
    await db.update(googleSyncPendingItems).set({ status: "rejected" }).where(eq(googleSyncPendingItems.id, id));
    res.json({ ok: true });
  });

  // ── Status badge ──
  app.get("/api/google-sync/status", requireAdmin, async (req, res) => {
    const u = (req as any).syncUser;
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(googleSyncPendingItems)
      .where(and(eq(googleSyncPendingItems.ownerUserId, u.id), eq(googleSyncPendingItems.status, "pending")));
    const conns = await db
      .select({ id: googleSyncConnections.id, email: googleSyncConnections.email })
      .from(googleSyncConnections)
      .where(eq(googleSyncConnections.ownerUserId, u.id));
    res.json({ pendingCount: n, connections: conns.length, configured: !!(getClientId()) });
  });

  console.log("🔄 Google Sync routes registered");
}
