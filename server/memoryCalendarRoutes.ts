// ─────────────────────────────────────────────────────────────────────────────
// Memory Calendar routes
//
// CRUD over memory_events plus AI helpers powered by the existing aiRouter
// (defaults to Claude Sonnet 4.6 via the `admin_assistant` role).
// All endpoints are admin-gated; user access is checked against memory_access
// for non-admins.
// ─────────────────────────────────────────────────────────────────────────────

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import {
  memoryEvents, memoryReminders, memoryAccess, memoryNotes, users,
  insertMemoryEventSchema, insertMemoryNoteSchema,
} from "@shared/schema";
import { and, eq, gte, lte, desc, asc, inArray, ilike, or, sql } from "drizzle-orm";
import { aiComplete } from "./aiRouter";
import { z } from "zod";
import { getMemoryReminderStats } from "./memoryReminderScheduler";
import { sendPushToUser } from "./push";
import { sendGenericEmail } from "./email";
import { pushTokens } from "@shared/schema";
import { getMessaging } from "firebase-admin/messaging";
import multer from "multer";
import OpenAI from "openai";

// In-memory multer for short voice clips (≤ 25 MB Whisper limit)
const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

let _whisperClient: OpenAI | null = null;
function whisperClient(): OpenAI {
  if (_whisperClient) return _whisperClient;
  _whisperClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "missing",
  });
  return _whisperClient;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getSessionUser(req: Request): { id: number; role: string } | null {
  const id = (req.session as any)?.userId;
  const role = (req.session as any)?.userRole;
  if (!id) return null;
  return { id, role: role || "user" };
}

async function userMayUseMemory(userId: number, role: string): Promise<boolean> {
  if (["admin", "super_admin", "moderator"].includes(role)) return true;
  const [row] = await db.select().from(memoryAccess).where(eq(memoryAccess.userId, userId));
  return !!row?.canUse;
}

// ── Quiet-hours helpers ─────────────────────────────────────────────────────
// Window is given as two "HH:MM" strings (24h, local time). It may cross
// midnight (start > end). If the supplied date falls inside the window, we
// push it forward to the window's end on the same (or next) calendar day.
function parseHHMM(s: string | null | undefined): { h: number; m: number } | null {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const min = Math.max(0, Math.min(59, Number(m[2])));
  return { h, m: min };
}

function isInsideQuietWindow(date: Date, qhStart: string | null, qhEnd: string | null): boolean {
  const s = parseHHMM(qhStart);
  const e = parseHHMM(qhEnd);
  if (!s || !e) return false;
  const cur = date.getHours() * 60 + date.getMinutes();
  const startM = s.h * 60 + s.m;
  const endM   = e.h * 60 + e.m;
  if (startM === endM) return false;
  if (startM < endM) return cur >= startM && cur < endM;            // same-day window
  return cur >= startM || cur < endM;                                // crosses midnight
}

function shiftOutOfQuietHours(date: Date, qhStart: string | null, qhEnd: string | null): Date {
  if (!isInsideQuietWindow(date, qhStart, qhEnd)) return date;
  const e = parseHHMM(qhEnd)!;
  const out = new Date(date);
  out.setHours(e.h, e.m, 0, 0);
  // If end is "earlier in the day" than current time, the window crossed midnight
  // and we must roll into the next day.
  if (out.getTime() <= date.getTime()) out.setDate(out.getDate() + 1);
  return out;
}

async function getOwnerQuietHours(ownerUserId: number): Promise<{ start: string | null; end: string | null }> {
  const [row] = await db.select().from(memoryAccess).where(eq(memoryAccess.userId, ownerUserId));
  return { start: (row as any)?.quietHoursStart ?? null, end: (row as any)?.quietHoursEnd ?? null };
}

// ── Recurrence ──────────────────────────────────────────────────────────────
function nextOccurrence(date: Date, rule: string | null | undefined): Date | null {
  if (!rule || rule === "none") return null;
  const d = new Date(date);
  switch (rule) {
    case "daily":   d.setDate(d.getDate() + 1); return d;
    case "weekly":  d.setDate(d.getDate() + 7); return d;
    case "monthly": d.setMonth(d.getMonth() + 1); return d;
    case "yearly":  d.setFullYear(d.getFullYear() + 1); return d;
    default: return null;
  }
}

async function regenerateRemindersForEvent(eventId: number) {
  const [event] = await db.select().from(memoryEvents).where(eq(memoryEvents.id, eventId));
  if (!event) return;

  // Wipe any pending (unsent) reminders for this event so user edits take effect
  await db.delete(memoryReminders).where(
    and(eq(memoryReminders.eventId, eventId), eq(memoryReminders.sent, false)),
  );

  const offsets = (event.reminderOffsets || []).filter((m) => Number.isFinite(m) && m >= 0);
  if (!offsets.length) return;

  const channel =
    event.notifyPush && event.notifyEmail ? "both" :
    event.notifyEmail                     ? "email" : "push";

  const tone   = event.reminderTone || "professional";
  const baseAt = new Date(event.eventDate).getTime();

  const { start: qhStart, end: qhEnd } = await getOwnerQuietHours(event.ownerUserId);

  const rows = offsets.map((minutes) => {
    const raw = new Date(baseAt - minutes * 60_000);
    const fireAt = shiftOutOfQuietHours(raw, qhStart, qhEnd);
    return { eventId, fireAt, channel, tone, sent: false };
  });

  if (rows.length) await db.insert(memoryReminders).values(rows as any);
}

function aiSystemPrompt() {
  return `You are the Memory Calendar assistant for Urban Culture Hub — a smart personal memory system.
Be concise, warm, and culturally aware. The owner runs Urban Culture Hub, Back to the Street,
Coffee & Dance, and Dance Healthy, plus subsidy work and partnerships. When you reply, return
short paragraphs or compact bullet lists. Never invent dates; if information is missing, say so.`;
}

// ── public registrar ─────────────────────────────────────────────────────────

export function registerMemoryCalendarRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => any,
) {

  // Any authenticated user may attempt access; we check memory_access inside.
  const requireMemoryAccess = async (req: Request, res: Response, next: NextFunction) => {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ message: "Not authenticated" });
    if (!(await userMayUseMemory(u.id, u.role))) {
      return res.status(403).json({ message: "Memory Calendar access not granted" });
    }
    (req as any).memoryUser = u;
    next();
  };

  // ── Events list ────────────────────────────────────────────────────────────
  app.get("/api/memory-calendar/events", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const { from, to, category, project, priority, includeShared } = req.query as Record<string, string>;

      const conds: any[] = [];
      // own events; if admin, can request shared too via includeShared=1
      if (includeShared === "1" && ["admin", "super_admin"].includes(u.role)) {
        // no owner filter
      } else {
        conds.push(eq(memoryEvents.ownerUserId, u.id));
      }
      if (from) conds.push(gte(memoryEvents.eventDate, new Date(from)));
      if (to)   conds.push(lte(memoryEvents.eventDate, new Date(to)));
      if (category) conds.push(eq(memoryEvents.category, category));
      if (project)  conds.push(eq(memoryEvents.project, project));
      if (priority) conds.push(eq(memoryEvents.priority, priority));

      const rows = await db.select().from(memoryEvents)
        .where(conds.length ? and(...conds) : undefined as any)
        .orderBy(asc(memoryEvents.eventDate));
      res.json(rows);
    } catch (err: any) {
      console.error("[MemoryCalendar] list error:", err);
      res.status(500).json({ message: err?.message || "Failed to load events" });
    }
  });

  // ── Single event ──────────────────────────────────────────────────────────
  app.get("/api/memory-calendar/events/:id", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const id = Number(req.params.id);
      const [row] = await db.select().from(memoryEvents).where(eq(memoryEvents.id, id));
      if (!row) return res.status(404).json({ message: "Not found" });
      if (row.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role) && !row.isShared) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const reminders = await db.select().from(memoryReminders).where(eq(memoryReminders.eventId, id));
      res.json({ ...row, reminders });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed" });
    }
  });

  // ── Create ────────────────────────────────────────────────────────────────
  app.post("/api/memory-calendar/events", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number };
      const body = { ...req.body, ownerUserId: u.id };

      // Coerce date strings → Date objects so drizzle accepts them
      if (typeof body.eventDate === "string") body.eventDate = new Date(body.eventDate);
      if (typeof body.endDate   === "string") body.endDate   = new Date(body.endDate);
      if (typeof body.repeatUntil === "string") body.repeatUntil = new Date(body.repeatUntil);

      const parsed = insertMemoryEventSchema.parse(body);
      const [row] = await db.insert(memoryEvents).values(parsed as any).returning();
      await regenerateRemindersForEvent(row.id);
      res.status(201).json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid event", errors: err.errors });
      console.error("[MemoryCalendar] create error:", err);
      res.status(500).json({ message: err?.message || "Failed to create event" });
    }
  });

  // ── Update ────────────────────────────────────────────────────────────────
  app.patch("/api/memory-calendar/events/:id", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const id = Number(req.params.id);
      const [existing] = await db.select().from(memoryEvents).where(eq(memoryEvents.id, id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const raw: any = { ...req.body };
      delete raw.id;
      delete raw.ownerUserId;
      delete raw.createdAt;
      if (typeof raw.eventDate === "string")   raw.eventDate   = new Date(raw.eventDate);
      if (typeof raw.endDate === "string")     raw.endDate     = new Date(raw.endDate);
      if (typeof raw.repeatUntil === "string") raw.repeatUntil = new Date(raw.repeatUntil);

      // Validate the update body using a partial of the insert schema
      const parsed = insertMemoryEventSchema.partial().parse(raw);
      const updates: any = { ...parsed, updatedAt: new Date() };

      const [row] = await db.update(memoryEvents).set(updates).where(eq(memoryEvents.id, id)).returning();
      await regenerateRemindersForEvent(id);
      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid update", errors: err.errors });
      console.error("[MemoryCalendar] update error:", err);
      res.status(500).json({ message: err?.message || "Failed to update" });
    }
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  app.delete("/api/memory-calendar/events/:id", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const id = Number(req.params.id);
      const [existing] = await db.select().from(memoryEvents).where(eq(memoryEvents.id, id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await db.delete(memoryEvents).where(eq(memoryEvents.id, id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to delete" });
    }
  });

  // ── Mark complete ─────────────────────────────────────────────────────────
  app.post("/api/memory-calendar/events/:id/complete", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const id = Number(req.params.id);
      const [existing] = await db.select().from(memoryEvents).where(eq(memoryEvents.id, id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Idempotent: if already completed, return the existing row without
      // spawning a duplicate next occurrence.
      if (existing.completedAt) {
        return res.json({ ...existing, nextEvent: null, alreadyCompleted: true });
      }

      const [row] = await db.update(memoryEvents)
        .set({ completedAt: new Date(), updatedAt: new Date() })
        .where(eq(memoryEvents.id, id))
        .returning();

      // ── Recurrence: spawn the next occurrence if this event repeats ───────
      let nextEvent: any = null;
      const rule = (existing as any).repeatRule;
      if (rule && rule !== "none") {
        const nextDate = nextOccurrence(new Date(existing.eventDate), rule);
        const repeatUntil = (existing as any).repeatUntil ? new Date((existing as any).repeatUntil) : null;
        if (nextDate && (!repeatUntil || nextDate.getTime() <= repeatUntil.getTime())) {
          let nextEnd: Date | null = null;
          if (existing.endDate) {
            const dur = new Date(existing.endDate).getTime() - new Date(existing.eventDate).getTime();
            nextEnd = new Date(nextDate.getTime() + dur);
          }
          const { id: _id, createdAt, updatedAt, completedAt, aiContext, aiPreparation, aiFollowUp, ...clone } = existing as any;
          const [created] = await db.insert(memoryEvents).values({
            ...clone,
            eventDate: nextDate,
            endDate: nextEnd,
            completedAt: null,
          } as any).returning();
          await regenerateRemindersForEvent(created.id);
          nextEvent = created;
        }
      }

      res.json({ ...row, nextEvent });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed" });
    }
  });

  // ── Settings (per-user quiet hours) ───────────────────────────────────────
  app.get("/api/memory-calendar/settings", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number };
      const [row] = await db.select().from(memoryAccess).where(eq(memoryAccess.userId, u.id));
      res.json({
        quietHoursStart: (row as any)?.quietHoursStart ?? null,
        quietHoursEnd:   (row as any)?.quietHoursEnd ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed" });
    }
  });

  app.put("/api/memory-calendar/settings", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number };
      const body = req.body || {};
      const startRaw = typeof body.quietHoursStart === "string" ? body.quietHoursStart.trim() : null;
      const endRaw   = typeof body.quietHoursEnd   === "string" ? body.quietHoursEnd.trim()   : null;
      const start = startRaw && /^\d{1,2}:\d{2}$/.test(startRaw) ? startRaw : null;
      const end   = endRaw   && /^\d{1,2}:\d{2}$/.test(endRaw)   ? endRaw   : null;

      const [existing] = await db.select().from(memoryAccess).where(eq(memoryAccess.userId, u.id));
      if (existing) {
        await db.update(memoryAccess)
          .set({ quietHoursStart: start, quietHoursEnd: end } as any)
          .where(eq(memoryAccess.userId, u.id));
      } else {
        await db.insert(memoryAccess).values({
          userId: u.id, canUse: true, canShare: false, grantedBy: u.id,
          quietHoursStart: start, quietHoursEnd: end,
        } as any);
      }

      // Regenerate reminders for all upcoming events so the new quiet window
      // takes effect immediately.
      const upcoming = await db.select({ id: memoryEvents.id })
        .from(memoryEvents)
        .where(and(eq(memoryEvents.ownerUserId, u.id), gte(memoryEvents.eventDate, new Date())));
      for (const e of upcoming) await regenerateRemindersForEvent(e.id);

      res.json({ quietHoursStart: start, quietHoursEnd: end, regenerated: upcoming.length });
    } catch (err: any) {
      console.error("[MemoryCalendar] settings put error:", err);
      res.status(500).json({ message: err?.message || "Failed" });
    }
  });

  // ── AI: summarize upcoming ────────────────────────────────────────────────
  app.post("/api/memory-calendar/ai/summarize", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number };
      const horizon = Number(req.body?.days) || 14;
      const now = new Date();
      const until = new Date(now.getTime() + horizon * 24 * 60 * 60 * 1000);
      const upcoming = await db.select().from(memoryEvents)
        .where(and(
          eq(memoryEvents.ownerUserId, u.id),
          gte(memoryEvents.eventDate, now),
          lte(memoryEvents.eventDate, until),
        ))
        .orderBy(asc(memoryEvents.eventDate))
        .limit(50);

      if (!upcoming.length) {
        return res.json({ summary: `Nothing scheduled in the next ${horizon} days. Good window to plan ahead.`, count: 0 });
      }

      const list = upcoming.map(e => `- ${new Date(e.eventDate).toLocaleString("nl-NL")} · [${e.priority}] ${e.title}${e.project ? ` (${e.project})` : ""}${e.location ? ` @ ${e.location}` : ""}${e.description ? ` — ${e.description.slice(0, 140)}` : ""}`).join("\n");

      const prompt = `Summarize the next ${horizon} days for me. Group by week, call out the top 3 priorities, flag any deadlines or follow-ups, and end with a 1-line plan-of-attack.\n\nUpcoming:\n${list}`;
      const summary = await aiComplete("admin_assistant", aiSystemPrompt(), prompt, { temperature: 0.5, maxTokens: 900 });
      res.json({ summary, count: upcoming.length });
    } catch (err: any) {
      console.error("[MemoryCalendar] summarize error:", err);
      res.status(500).json({ message: err?.message || "AI summarize failed" });
    }
  });

  // ── AI: prepare for one event ─────────────────────────────────────────────
  app.post("/api/memory-calendar/ai/prepare/:id", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const id = Number(req.params.id);
      const [event] = await db.select().from(memoryEvents).where(eq(memoryEvents.id, id));
      if (!event) return res.status(404).json({ message: "Not found" });
      if (event.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const prompt = `Help me prepare for this calendar entry.

Title: ${event.title}
When: ${new Date(event.eventDate).toLocaleString("nl-NL")}
Category: ${event.category}
Project: ${event.project || "—"}
Priority: ${event.priority}
Location: ${event.location || "—"}
Description: ${event.description || "—"}

Reply in three short sections:
**Why it matters** (1–2 lines).
**Preparation steps** (3–5 bullets, action verbs).
**Follow-up after** (2–3 bullets).
Keep it tight and practical.`;

      const reply = await aiComplete("admin_assistant", aiSystemPrompt(), prompt, { temperature: 0.6, maxTokens: 700 });

      // Persist a short prep summary back on the event for the next reminder fire
      const prepLine = reply.split(/\*\*Preparation steps\*\*/i)[1]?.split(/\*\*Follow-up/i)[0]?.replace(/[\s\S]*?:\s*/, "").trim().slice(0, 600) || null;
      const [updated] = await db.update(memoryEvents)
        .set({ aiContext: reply.slice(0, 2000), aiPreparation: prepLine, updatedAt: new Date() })
        .where(eq(memoryEvents.id, id))
        .returning();
      res.json({ reply, event: updated });
    } catch (err: any) {
      console.error("[MemoryCalendar] prepare error:", err);
      res.status(500).json({ message: err?.message || "AI prepare failed" });
    }
  });

  // ── AI: organize / suggest categorization for a batch ─────────────────────
  app.post("/api/memory-calendar/ai/organize", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number };
      const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
      const rows = ids.length
        ? await db.select().from(memoryEvents).where(and(eq(memoryEvents.ownerUserId, u.id), inArray(memoryEvents.id, ids)))
        : await db.select().from(memoryEvents).where(eq(memoryEvents.ownerUserId, u.id)).orderBy(desc(memoryEvents.createdAt)).limit(40);

      const list = rows.map(r => `${r.id}. ${r.title} (cat=${r.category}, prio=${r.priority}, project=${r.project || "—"})`).join("\n");
      const prompt = `Look at these calendar entries and propose better organization.
For each entry, suggest a tighter category, sensible priority, and project tag if obvious.
Reply with a compact JSON array: [{"id":number,"category":string,"priority":"low|normal|high|urgent","project":string|null,"reason":string}].

Entries:
${list}`;
      const reply = await aiComplete("admin_assistant", aiSystemPrompt(), prompt, { temperature: 0.3, maxTokens: 1200, jsonMode: true });
      let suggestions: any[] = [];
      try { suggestions = JSON.parse(reply); } catch { /* ignore */ }
      res.json({ suggestions, raw: reply });
    } catch (err: any) {
      console.error("[MemoryCalendar] organize error:", err);
      res.status(500).json({ message: err?.message || "AI organize failed" });
    }
  });

  // ── Voice transcription (Whisper, EN + NL) ────────────────────────────────
  app.post(
    "/api/memory-calendar/transcribe",
    requireMemoryAccess,
    voiceUpload.single("audio"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) return res.status(400).json({ message: "No audio file uploaded" });
        const lang = (req.body?.lang as string) || "en"; // "en" | "nl" | "auto"

        const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
        if (!apiKey || apiKey === "missing") {
          return res.status(503).json({ message: "Voice transcription unavailable — OPENAI_API_KEY not configured." });
        }

        // OpenAI SDK accepts a File-like object. We wrap the buffer.
        const audioFile = new File(
          [req.file.buffer],
          req.file.originalname || `voice.${(req.file.mimetype || "audio/webm").split("/")[1] || "webm"}`,
          { type: req.file.mimetype || "audio/webm" },
        );

        const result = await whisperClient().audio.transcriptions.create({
          file: audioFile as any,
          model: "whisper-1",
          language: lang === "auto" ? undefined : lang,
          response_format: "json",
        });

        res.json({ text: (result as any).text || "", lang });
      } catch (err: any) {
        console.error("[MemoryCalendar] transcribe error:", err);
        res.status(500).json({ message: err?.message || "Transcription failed" });
      }
    },
  );

  // ── AI: parse free-text → structured calendar entry ───────────────────────
  app.post("/api/memory-calendar/parse", requireMemoryAccess, async (req, res) => {
    try {
      const text = String(req.body?.text || "").trim();
      const lang = String(req.body?.lang || "en");
      if (!text) return res.status(400).json({ message: "text required" });

      const now = new Date();
      const tz = "Europe/Amsterdam";
      const sys = `You convert short notes (English or Dutch) into a calendar entry JSON.
Today is ${now.toISOString()} (${tz}). The user is in the Netherlands.
Reply with ONLY valid JSON matching this shape:
{
  "title": string (max 80 chars, action-style),
  "description": string | null,
  "category": "general"|"meeting"|"deadline"|"subsidy"|"event"|"follow_up"|"birthday"|"business"|"personal"|"task",
  "priority": "low"|"normal"|"high"|"urgent",
  "project": string | null,
  "location": string | null,
  "eventDate": ISO-8601 string in ${tz} (best guess; default to next sensible time, e.g. "tomorrow 10:00" → tomorrow 10:00 Europe/Amsterdam),
  "reminderOffsets": number[] (minutes before; sensible defaults like [60, 1440] unless user implies otherwise),
  "notes": string | null
}
Always pick a concrete eventDate even if vague (use 09:00 local for "morning", 14:00 for "afternoon", 19:00 for "evening", 10:00 if no time).`;

      const prompt = `Note (${lang}):\n"""${text}"""`;

      const reply = await aiComplete("admin_assistant", sys, prompt, {
        temperature: 0.2,
        maxTokens: 600,
        jsonMode: true,
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(reply);
      } catch {
        // Try to recover JSON from a fenced block
        const m = reply.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
      }

      res.json({ parsed, raw: reply });
    } catch (err: any) {
      console.error("[MemoryCalendar] parse error:", err);
      res.status(500).json({ message: err?.message || "AI parse failed" });
    }
  });

  // ── Stats / scheduler health ──────────────────────────────────────────────
  app.get("/api/memory-calendar/stats", requireMemoryAccess, async (_req, res) => {
    try {
      const stats = await getMemoryReminderStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed" });
    }
  });

  // ── Test reminder ─────────────────────────────────────────────────────────
  // Lets the admin verify that push + email actually arrive on their device,
  // BEFORE they rely on a real reminder firing on the day.
  app.post("/api/memory-calendar/test-reminder", requireMemoryAccess, async (req, res) => {
    try {
      const sessionUser = getSessionUser(req)!;
      const channel = (req.body?.channel as "push" | "email" | "both") || "both";

      const [owner] = await db
        .select({ id: users.id, email: users.email, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, sessionUser.id));

      if (!owner) return res.status(404).json({ message: "User not found" });

      const now = new Date();
      const when = now.toLocaleString("nl-NL", { dateStyle: "full", timeStyle: "short" });
      const title = "🧠 Test reminder — Memory Calendar";
      const body  = `If you can read this, reminders are working. Sent at ${when}.`;

      const results: Record<string, { ok: boolean; error?: string; detail?: any }> = {};

      if (channel === "push" || channel === "both") {
        // Honest diagnostic — bypass sendPushToUser (which swallows errors) and
        // dispatch FCM directly so we can report token counts and per-token errors.
        try {
          const tokens = await db
            .select({ token: pushTokens.token, platform: pushTokens.platform, id: pushTokens.id })
            .from(pushTokens)
            .where(eq(pushTokens.userId, owner.id));

          if (!tokens.length) {
            results.push = {
              ok: false,
              error: "No push devices registered for your account. Tap “Enable push on this device” below, allow notifications when prompted, then try again.",
              detail: { tokenCount: 0 },
            };
          } else {
            const messaging = getMessaging();
            const sendResults = await Promise.allSettled(
              tokens.map((t) =>
                messaging.send({
                  token: t.token,
                  notification: { title, body },
                  webpush: {
                    notification: { title, body, icon: "/logo.jpg", badge: "/logo.jpg", requireInteraction: false },
                    fcmOptions: { link: "/admin/memory-calendar" },
                    data: { test: "true", channel, url: "/admin/memory-calendar" },
                  },
                  apns: {
                    payload: { aps: { alert: { title, body }, badge: 1, sound: "default" } },
                  },
                })
              )
            );

            const perToken = sendResults.map((r, i) => {
              if (r.status === "fulfilled") {
                return { platform: tokens[i].platform, ok: true, messageId: r.value };
              }
              const err: any = r.reason;
              const code = err?.errorInfo?.code || err?.code || "unknown";
              const msg  = err?.message || String(err);
              // Auto-clean stale tokens so the next test gives a clean signal
              if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
                db.delete(pushTokens).where(eq(pushTokens.id, tokens[i].id)).catch(() => {});
              }
              return { platform: tokens[i].platform, ok: false, code, error: msg };
            });

            const okCount = perToken.filter(t => t.ok).length;
            if (okCount > 0) {
              results.push = {
                ok: true,
                detail: { sent: okCount, total: tokens.length, devices: perToken },
              };
            } else {
              const firstErr = perToken[0];
              results.push = {
                ok: false,
                error: `All ${tokens.length} registered device(s) rejected the push. ${firstErr?.code || ""} ${firstErr?.error || ""}`.trim(),
                detail: { devices: perToken },
              };
            }
          }
        } catch (e: any) {
          results.push = { ok: false, error: e?.message || String(e) };
        }
      }

      if ((channel === "email" || channel === "both") && owner.email) {
        try {
          await sendGenericEmail({
            to: owner.email,
            subject: title,
            text: body,
            html: `
              <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;background:#f8fafc;">
                <div style="background:linear-gradient(135deg,#4f46e5,#9333ea,#db2777);color:#fff;padding:24px 28px;border-radius:12px 12px 0 0;">
                  <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85;">Memory Calendar · Test</div>
                  <div style="font-size:22px;font-weight:700;margin-top:6px;">${title}</div>
                </div>
                <div style="background:#fff;padding:24px 28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#374151;line-height:1.55;">
                  <p style="margin:0 0 10px;">${body}</p>
                  <p style="margin:0;color:#6b7280;font-size:12px;">You can ignore this — it's a verification ping you triggered yourself.</p>
                </div>
              </div>`,
          } as any);
          results.email = { ok: true };
        } catch (e: any) {
          results.email = { ok: false, error: e?.message || String(e) };
        }
      } else if (channel === "email" || channel === "both") {
        results.email = { ok: false, error: "No email on file for this account" };
      }

      const anyOk = Object.values(results).some(r => r.ok);
      res.status(anyOk ? 200 : 500).json({ results, sentAt: now.toISOString() });
    } catch (err: any) {
      console.error("[MemoryCalendar] test-reminder error:", err);
      res.status(500).json({ message: err?.message || "Test reminder failed" });
    }
  });

  // ── Access control (admin only) ───────────────────────────────────────────
  app.get("/api/memory-calendar/access", requireAdmin, async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: memoryAccess.id,
          userId: memoryAccess.userId,
          canUse: memoryAccess.canUse,
          canShare: memoryAccess.canShare,
          grantedAt: memoryAccess.grantedAt,
          email: users.email,
          displayName: users.displayName,
        })
        .from(memoryAccess)
        .leftJoin(users, eq(users.id, memoryAccess.userId));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed" });
    }
  });

  app.post("/api/memory-calendar/access", requireAdmin, async (req, res) => {
    try {
      const admin = getSessionUser(req)!;
      const { userId, canUse = true, canShare = false } = req.body || {};
      if (!userId) return res.status(400).json({ message: "userId required" });

      const [existing] = await db.select().from(memoryAccess).where(eq(memoryAccess.userId, userId));
      if (existing) {
        const [row] = await db.update(memoryAccess)
          .set({ canUse, canShare, grantedBy: admin.id })
          .where(eq(memoryAccess.userId, userId))
          .returning();
        return res.json(row);
      }
      const [row] = await db.insert(memoryAccess).values({ userId, canUse, canShare, grantedBy: admin.id }).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed" });
    }
  });

  app.delete("/api/memory-calendar/access/:userId", requireAdmin, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      await db.delete(memoryAccess).where(eq(memoryAccess.userId, userId));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // MEMORY NOTES — multilingual smart notes with Claude AI analysis
  // ══════════════════════════════════════════════════════════════════════════

  function noteWordStats(content: string) {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    return {
      wordCount:       words,
      charCount:       content.length,
      readTimeMinutes: Math.max(1, Math.ceil(words / 200)),
    };
  }

  // GET /api/memory-calendar/notes
  app.get("/api/memory-calendar/notes", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const { q, category, language, priority, pinned, archived, sort } = req.query as Record<string, string>;

      const conds: any[] = [eq(memoryNotes.ownerUserId, u.id)];
      if (category && category !== "all") conds.push(eq(memoryNotes.category, category));
      if (language && language !== "all") conds.push(eq(memoryNotes.language, language));
      if (priority && priority !== "all") conds.push(eq(memoryNotes.priority, priority));
      if (pinned === "1") conds.push(eq(memoryNotes.isPinned, true));
      if (archived === "1") {
        conds.push(eq(memoryNotes.isArchived, true));
      } else {
        conds.push(eq(memoryNotes.isArchived, false));
      }
      if (q) {
        const like = `%${q}%`;
        conds.push(or(ilike(memoryNotes.title, like), ilike(memoryNotes.content, like)));
      }

      const orderCol = sort === "title" ? asc(memoryNotes.title)
        : sort === "updated"           ? desc(memoryNotes.updatedAt)
        : sort === "created"           ? desc(memoryNotes.createdAt)
        :                                desc(memoryNotes.updatedAt);

      const rows = await db.select().from(memoryNotes)
        .where(and(...conds))
        .orderBy(desc(memoryNotes.isPinned), orderCol);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to load notes" });
    }
  });

  // GET /api/memory-calendar/notes/stats — MUST be registered before /:id
  app.get("/api/memory-calendar/notes/stats", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number };
      const rows = await db.select({
        language:  memoryNotes.language,
        category:  memoryNotes.category,
        sentiment: memoryNotes.aiSentiment,
        wordCount: memoryNotes.wordCount,
        isPinned:  memoryNotes.isPinned,
      }).from(memoryNotes).where(and(eq(memoryNotes.ownerUserId, u.id), eq(memoryNotes.isArchived, false)));

      const total      = rows.length;
      const totalWords = rows.reduce((a, r) => a + (r.wordCount || 0), 0);
      const pinned     = rows.filter(r => r.isPinned).length;
      const byLang: Record<string, number> = {};
      const byCat:  Record<string, number> = {};
      const bySent: Record<string, number> = {};
      for (const r of rows) {
        byLang[r.language || "en"] = (byLang[r.language || "en"] || 0) + 1;
        byCat[r.category  || "general"] = (byCat[r.category || "general"] || 0) + 1;
        if (r.sentiment) bySent[r.sentiment] = (bySent[r.sentiment] || 0) + 1;
      }
      res.json({ total, totalWords, pinned, byLang, byCat, bySent });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Stats failed" });
    }
  });

  // GET /api/memory-calendar/notes/:id
  app.get("/api/memory-calendar/notes/:id", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const [row] = await db.select().from(memoryNotes).where(eq(memoryNotes.id, Number(req.params.id)));
      if (!row) return res.status(404).json({ message: "Not found" });
      if (row.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed" });
    }
  });

  // POST /api/memory-calendar/notes
  app.post("/api/memory-calendar/notes", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number };
      const stats = noteWordStats(req.body?.content || "");
      const body = { ...req.body, ownerUserId: u.id, ...stats };
      const parsed = insertMemoryNoteSchema.parse(body);
      const [row] = await db.insert(memoryNotes).values(parsed as any).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Validation failed" });
    }
  });

  // PATCH /api/memory-calendar/notes/:id
  app.patch("/api/memory-calendar/notes/:id", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const id = Number(req.params.id);
      const [existing] = await db.select().from(memoryNotes).where(eq(memoryNotes.id, id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const stats = req.body?.content !== undefined ? noteWordStats(req.body.content) : {};
      const [updated] = await db.update(memoryNotes)
        .set({ ...req.body, ...stats, updatedAt: new Date() })
        .where(eq(memoryNotes.id, id))
        .returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to update" });
    }
  });

  // DELETE /api/memory-calendar/notes/:id
  app.delete("/api/memory-calendar/notes/:id", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const id = Number(req.params.id);
      const [row] = await db.select().from(memoryNotes).where(eq(memoryNotes.id, id));
      if (!row) return res.status(404).json({ message: "Not found" });
      if (row.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await db.delete(memoryNotes).where(eq(memoryNotes.id, id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to delete" });
    }
  });

  // POST /api/memory-calendar/notes/:id/analyze — Claude AI deep analysis
  app.post("/api/memory-calendar/notes/:id/analyze", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const id = Number(req.params.id);
      const [note] = await db.select().from(memoryNotes).where(eq(memoryNotes.id, id));
      if (!note) return res.status(404).json({ message: "Not found" });
      if (note.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (!note.content.trim()) return res.status(400).json({ message: "Note has no content to analyze" });

      const langLabel = note.language === "ar" ? "Arabic" : note.language === "nl" ? "Dutch" : "English";
      const systemPrompt = `You are a professional note analyst for Urban Culture Hub, an urban culture platform in the Netherlands.
You analyze notes written in English, Arabic, or Dutch. Always respond in JSON only — no markdown fences, no extra text.
Be concise, practical, and culturally sensitive.`;

      const prompt = `Analyze the following note written in ${langLabel}:

TITLE: ${note.title}
CONTENT:
${note.content}

Return a JSON object with exactly these fields:
{
  "summary": "2-4 sentence summary in English",
  "keyPoints": ["point 1", "point 2", ...],
  "actionItems": ["action 1", "action 2", ...],
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "suggestedTags": ["tag1", "tag2", ...],
  "languageDetected": "en" | "ar" | "nl" | "mixed",
  "translationEn": "Full English translation of the note content (only if not already in English, else empty string)",
  "insight": "One sharp, practical insight or recommendation based on this note"
}`;

      const raw = await aiComplete("admin_assistant", systemPrompt, prompt, { temperature: 0.3, maxTokens: 1200 });

      let parsed: any = {};
      try {
        const match = raw.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(match ? match[0] : raw);
      } catch {
        return res.status(500).json({ message: "AI returned unexpected format", raw });
      }

      const [updated] = await db.update(memoryNotes).set({
        aiSummary:          (parsed.summary        || "").slice(0, 2000),
        aiKeyPoints:        Array.isArray(parsed.keyPoints)    ? parsed.keyPoints.slice(0, 10)    : [],
        aiActionItems:      Array.isArray(parsed.actionItems)  ? parsed.actionItems.slice(0, 10)  : [],
        aiSentiment:        parsed.sentiment        || "neutral",
        aiSuggestedTags:    Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags.slice(0, 8) : [],
        aiLanguageDetected: parsed.languageDetected || note.language || "en",
        aiTranslationEn:    (parsed.translationEn  || "").slice(0, 8000),
        aiInsight:          (parsed.insight        || "").slice(0, 1000),
        lastAnalyzedAt:     new Date(),
        updatedAt:          new Date(),
      }).where(eq(memoryNotes.id, id)).returning();
      res.json(updated);
    } catch (err: any) {
      console.error("[MemoryNotes] analyze error:", err);
      res.status(500).json({ message: err?.message || "AI analysis failed" });
    }
  });

  // POST /api/memory-calendar/notes/:id/translate — translate note to a target language
  app.post("/api/memory-calendar/notes/:id/translate", requireMemoryAccess, async (req, res) => {
    try {
      const u = (req as any).memoryUser as { id: number; role: string };
      const id = Number(req.params.id);
      const { targetLang = "en" } = req.body as { targetLang: string };
      const [note] = await db.select().from(memoryNotes).where(eq(memoryNotes.id, id));
      if (!note) return res.status(404).json({ message: "Not found" });
      if (note.ownerUserId !== u.id && !["admin", "super_admin"].includes(u.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const langNames: Record<string, string> = { en: "English", ar: "Arabic", nl: "Dutch" };
      const targetName = langNames[targetLang] || "English";
      const systemPrompt = `You are a professional translator. Translate the given text to ${targetName}.
Preserve meaning, tone and formatting. Return only the translated text — no explanations.`;
      const translation = await aiComplete("admin_assistant", systemPrompt,
        `Translate this to ${targetName}:\n\n${note.content}`,
        { temperature: 0.2, maxTokens: 3000 });
      res.json({ translation, targetLang });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Translation failed" });
    }
  });

  // ── end Memory Notes ──────────────────────────────────────────────────────

  console.log("🧠 Memory Calendar routes registered");
}
