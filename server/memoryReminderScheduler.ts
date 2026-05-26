// ─────────────────────────────────────────────────────────────────────────────
// Memory Calendar reminder scheduler
//
// Ticks once a minute. Pulls every memory_reminders row whose fireAt has
// passed and which has not yet been sent, then dispatches a push notification
// and/or email according to the parent event's channel preferences and the
// chosen reminder tone.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./db";
import { memoryReminders, memoryEvents, users } from "@shared/schema";
import { and, eq, lte, sql } from "drizzle-orm";
import { sendPushToUser } from "./push";
import { sendGenericEmail } from "./email";
import { storage } from "./storage";

const TONE_OPENERS: Record<string, (title: string) => string> = {
  professional:  (t) => `Reminder: ${t}`,
  motivational:  (t) => `You've got this — ${t}`,
  urgent:        (t) => `URGENT: ${t}`,
  friendly:      (t) => `Hey, just a heads-up about ${t}`,
  business:      (t) => `[Business] ${t}`,
};

// All events are stored in UTC. The admin is in Amsterdam (UTC+1/+2).
// Always render times in Europe/Amsterdam so the displayed time matches what
// the admin typed when creating the event.
const TZ = "Europe/Amsterdam";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("nl-NL", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: TZ,
    });
  } catch { return String(d); }
}

function buildBody(event: any, tone: string): string {
  const opener = TONE_OPENERS[tone] || TONE_OPENERS.professional;
  const lines: string[] = [];
  lines.push(opener(event.title));
  lines.push(`When: ${fmtDate(event.eventDate)}`);
  if (event.location)    lines.push(`Where: ${event.location}`);
  if (event.project)     lines.push(`Project: ${event.project}`);
  if (event.aiPreparation) lines.push(`Prep: ${event.aiPreparation}`);
  if (event.description) lines.push("");
  if (event.description) lines.push(event.description);
  return lines.join("\n");
}

function buildEmailHtml(event: any, tone: string): string {
  const accent =
    tone === "urgent"        ? "#dc2626" :
    tone === "motivational"  ? "#059669" :
    tone === "friendly"      ? "#0ea5e9" :
    tone === "business"      ? "#1e3a8a" : "#4338ca";
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:0;background:#f8fafc;">
    <div style="background:${accent};color:#fff;padding:24px 28px;border-radius:12px 12px 0 0;">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85;">Memory Calendar</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px;">${TONE_OPENERS[tone]?.(event.title) ?? event.title}</div>
    </div>
    <div style="background:#fff;padding:24px 28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
      <table style="width:100%;font-size:14px;color:#1f2937;border-collapse:collapse;">
        <tr><td style="color:#6b7280;padding:6px 0;width:120px;">When</td><td style="padding:6px 0;font-weight:600;">${fmtDate(event.eventDate)}</td></tr>
        ${event.location  ? `<tr><td style="color:#6b7280;padding:6px 0;">Where</td><td style="padding:6px 0;">${event.location}</td></tr>` : ""}
        ${event.project   ? `<tr><td style="color:#6b7280;padding:6px 0;">Project</td><td style="padding:6px 0;">${event.project}</td></tr>` : ""}
        ${event.priority  ? `<tr><td style="color:#6b7280;padding:6px 0;">Priority</td><td style="padding:6px 0;text-transform:uppercase;font-weight:700;color:${accent};">${event.priority}</td></tr>` : ""}
      </table>
      ${event.aiPreparation ? `<div style="margin-top:16px;padding:14px 16px;background:#f5f3ff;border-left:3px solid ${accent};border-radius:6px;font-size:13px;color:#4338ca;"><strong>AI prep:</strong> ${event.aiPreparation}</div>` : ""}
      ${event.description   ? `<div style="margin-top:16px;font-size:14px;color:#374151;line-height:1.55;white-space:pre-wrap;">${event.description}</div>` : ""}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
        Sent by Urban Culture Hub — Memory Calendar
      </div>
    </div>
  </div>`;
}

async function dispatchReminder(reminder: any, event: any, ownerEmail: string | null) {
  const tone = reminder.tone || event.reminderTone || "professional";
  const channel = reminder.channel || "push";

  const tasks: Promise<any>[] = [];

  if ((channel === "push" || channel === "both") && event.notifyPush !== false) {
    tasks.push(
      sendPushToUser(event.ownerUserId, {
        title: TONE_OPENERS[tone]?.(event.title) ?? event.title,
        body:  fmtDate(event.eventDate) + (event.location ? ` · ${event.location}` : ""),
        url:   "/admin/memory-calendar",
        data:  { eventId: String(event.id), tone, channel },
      }).catch((e) => { throw new Error(`push: ${e?.message || e}`); })
    );
  }

  if ((channel === "email" || channel === "both") && event.notifyEmail && ownerEmail) {
    tasks.push(
      sendGenericEmail({
        to:      ownerEmail,
        subject: TONE_OPENERS[tone]?.(event.title) ?? event.title,
        text:    buildBody(event, tone),
        html:    buildEmailHtml(event, tone),
      } as any).catch((e) => { throw new Error(`email: ${e?.message || e}`); })
    );
  }

  // Also write an in-app admin notification so the bell shows it
  tasks.push(
    storage.createUserNotification({
      userId:  event.ownerUserId,
      title:   TONE_OPENERS[tone]?.(event.title) ?? event.title,
      message: fmtDate(event.eventDate),
      type:    "system",
    } as any).catch(() => null)
  );

  const results = await Promise.allSettled(tasks);
  const errors = results.filter(r => r.status === "rejected").map(r => (r as any).reason?.message || String((r as any).reason));
  return errors.length ? errors.join("; ") : null;
}

let tickRunning = false;

async function tick() {
  if (tickRunning) return; // overlap guard — never run two ticks at once
  tickRunning = true;
  try {
    const now = new Date();

    // Atomically claim due reminders so concurrent ticks (or a future
    // multi-instance deployment) cannot dispatch the same row twice.
    const claimed: any[] = (await db.execute(sql`
      UPDATE memory_reminders
         SET sent = true, sent_at = NOW()
       WHERE id IN (
         SELECT id FROM memory_reminders
          WHERE sent = false AND fire_at <= ${now}
          ORDER BY fire_at ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
       )
       RETURNING id, event_id AS "eventId", channel, tone, fire_at AS "fireAt"
    `) as any).rows ?? [];

    if (!claimed.length) return;

    for (const reminder of claimed) {
      try {
        const [event] = await db.select().from(memoryEvents).where(eq(memoryEvents.id, reminder.eventId));
        if (!event) {
          await db.update(memoryReminders).set({ error: "event-missing" }).where(eq(memoryReminders.id, reminder.id));
          continue;
        }
        const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, event.ownerUserId));
        const error = await dispatchReminder(reminder, event, owner?.email || null);
        if (error) await db.update(memoryReminders).set({ error }).where(eq(memoryReminders.id, reminder.id));
      } catch (err: any) {
        console.error("[MemoryReminder] dispatch error:", err);
        await db.update(memoryReminders).set({ error: String(err?.message || err) }).where(eq(memoryReminders.id, reminder.id));
      }
    }
  } catch (err) {
    console.error("[MemoryReminder] tick error:", err);
  } finally {
    tickRunning = false;
  }
}

let started = false;
export function startMemoryReminderScheduler() {
  if (started) return;
  started = true;
  console.log("🧠 Memory Calendar reminder scheduler starting — checking every 60s");
  // First tick a few seconds after boot to give DB pool time to settle
  setTimeout(() => { tick().catch(() => {}); }, 5_000);
  setInterval(() => { tick().catch(() => {}); }, 60_000);
}

// Tiny diagnostic helper for the admin panel
export async function getMemoryReminderStats() {
  const result: any = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE sent = false)                      AS pending,
      COUNT(*) FILTER (WHERE sent = true  AND error IS NULL)    AS delivered,
      COUNT(*) FILTER (WHERE sent = true  AND error IS NOT NULL) AS failed
    FROM memory_reminders
  `);
  const row = result?.rows?.[0] ?? (Array.isArray(result) ? result[0] : undefined);
  return {
    pending: Number(row?.pending ?? 0),
    delivered: Number(row?.delivered ?? 0),
    failed: Number(row?.failed ?? 0),
  };
}
