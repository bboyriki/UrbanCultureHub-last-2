/**
 * server/legalAssistantRoutes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only AI Legal Assistant (Dutch law).
 *
 * Hybrid AI flow:
 *   1. Primary call → Claude (admin_assistant role) generates a structured
 *      answer in JSON: rights / risks / next_steps / things_to_avoid /
 *      short_summary / sources.
 *   2. Validation call → second Claude pass critiques the answer for
 *      contradictions, missing risks, and confidence.
 *   3. Stored as a `legalMessages` row with both the answer + validation.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import {
  legalConversations,
  legalMessages,
  type LegalConversation,
  type LegalMessage,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { aiComplete } from "./aiRouter";

// ── session helper (mirrors memoryCalendarRoutes) ──────────────────────────
function getSessionUser(req: Request): { id: number; role: string } | null {
  const u: any = (req as any).user || (req.session as any)?.user;
  if (!u) return null;
  return { id: Number(u.id), role: String(u.role || "user") };
}

const isAdmin = (role: string) => ["admin", "super_admin"].includes(role);

// ── system prompts ─────────────────────────────────────────────────────────

const SYSTEM_PRIMARY = `
You are a Dutch-law legal assistant for the admin of Urban Culture Hub.
You speak plainly (no unnecessary jargon) and ground every answer in real
Dutch / EU law where possible (Burgerlijk Wetboek, Wetboek van Strafrecht,
Politiewet 2012, AVG/GDPR, BW boek 7 huur, Belastingdienst rules, etc.).

You ALWAYS reply with VALID JSON ONLY — no prose outside JSON, no markdown
fences. Schema:

{
  "rights":         "string — what the user is legally entitled to (plain language)",
  "risks":          "string — what can go wrong, fines, criminal/civil exposure",
  "next_steps":     "string — concrete numbered actions to take next",
  "things_to_avoid":"string — what NOT to do or say",
  "short_summary":  "string — one or two sentences",
  "sources":        ["string", "string"]   // e.g. ["Politiewet 2012 art. 7", "AVG art. 6"]
}

Rules:
• If you are not certain, say so inside the relevant fields. Do not invent
  article numbers. Prefer "verify with an official source" over a guess.
• If the user describes a LIVE situation, lead next_steps with the most
  urgent safety/legal action first.
• Keep each field readable: short paragraphs or bullet-style lines separated
  by "\\n• ". Never exceed ~150 words per field.
• You are not a lawyer; for complex disputes, recommend a real attorney in
  next_steps without being preachy.
`.trim();

const SYSTEM_VALIDATOR = `
You are a strict legal-fact validator. Given a Dutch-law question and a
proposed structured answer, you check:
  • internal contradictions
  • missing or understated risks
  • invented / unverifiable article numbers
  • whether the next steps are practical and lawful

Reply ONLY with valid JSON, schema:

{
  "confidence":      "high" | "medium" | "low",
  "flagged":         true | false,
  "validation_notes":"string — short critique. Empty string if all good.",
  "extra_sources":   ["string"]    // optional additional sources to add
}

Be terse. If the answer looks solid, return high/false/"".
`.trim();

// ── helpers ─────────────────────────────────────────────────────────────────

function safeParseJSON<T = any>(raw: string): T | null {
  if (!raw) return null;

  const normalize = (s: string) =>
    s
      // strip ```json or ``` fences
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      // smart quotes → straight quotes
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      // trailing commas before } or ]
      .replace(/,\s*([}\]])/g, "$1")
      .trim();

  const tryParse = (s: string): T | null => {
    try { return JSON.parse(s) as T; } catch { return null; }
  };

  // Balanced-brace extractor: returns the first complete top-level {...}
  // ignoring braces inside strings.
  const extractBalanced = (s: string): string | null => {
    const start = s.indexOf("{");
    if (start < 0) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc)        esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"')  inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    return null;
  };

  let s = normalize(raw);

  // 1) direct parse
  let parsed = tryParse(s);
  if (parsed) return parsed;

  // 2) if the whole thing is a JSON-encoded string, unwrap it once
  if (s.startsWith('"') && s.endsWith('"')) {
    const inner = tryParse(s);
    if (typeof inner === "string") {
      const re = tryParse(normalize(inner));
      if (re) return re as T;
    }
  }

  // 3) balanced-brace extraction
  const block = extractBalanced(s);
  if (block) {
    parsed = tryParse(block);
    if (parsed) return parsed;
  }

  return null;
}

async function generateTitle(firstQuestion: string): Promise<string> {
  try {
    const t = await aiComplete(
      "admin_assistant",
      "You write 3-6 word conversation titles. Reply with the title only, no quotes.",
      `Title for this legal question: ${firstQuestion}`,
      { temperature: 0.4, maxTokens: 30 }
    );
    return (t || "Legal consultation").replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 80);
  } catch {
    return "Legal consultation";
  }
}

// ── route registrar ─────────────────────────────────────────────────────────

export function registerLegalAssistantRoutes(
  app: Express,
  _requireAdmin: (req: Request, res: Response, next: NextFunction) => any,
) {
  // Lock everything to admins only.
  const requireLegalAdmin = (req: Request, res: Response, next: NextFunction) => {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ message: "Not authenticated" });
    if (!isAdmin(u.role)) return res.status(403).json({ message: "Admin only" });
    (req as any).legalUser = u;
    next();
  };

  // ── List conversations ──────────────────────────────────────────────────
  app.get("/api/legal-assistant/conversations", requireLegalAdmin, async (req, res) => {
    try {
      const u = (req as any).legalUser as { id: number };
      const rows = await db.select()
        .from(legalConversations)
        .where(eq(legalConversations.ownerUserId, u.id))
        .orderBy(desc(legalConversations.updatedAt));
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to load conversations" });
    }
  });

  // ── Get one conversation + its messages ─────────────────────────────────
  app.get("/api/legal-assistant/conversations/:id", requireLegalAdmin, async (req, res) => {
    try {
      const u = (req as any).legalUser as { id: number };
      const id = Number(req.params.id);
      const [conv] = await db.select().from(legalConversations).where(eq(legalConversations.id, id));
      if (!conv || conv.ownerUserId !== u.id) return res.status(404).json({ message: "Not found" });
      const msgs = await db.select().from(legalMessages)
        .where(eq(legalMessages.conversationId, id))
        .orderBy(legalMessages.createdAt);
      res.json({ conversation: conv, messages: msgs });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to load conversation" });
    }
  });

  // ── Create conversation (optional title; auto-generated if absent) ──────
  app.post("/api/legal-assistant/conversations", requireLegalAdmin, async (req, res) => {
    try {
      const u = (req as any).legalUser as { id: number };
      const { title, category, liveMode } = req.body || {};
      const [row] = await db.insert(legalConversations).values({
        ownerUserId: u.id,
        title: (title && String(title).slice(0, 200)) || "New consultation",
        category: category || "general",
        liveMode: !!liveMode,
      }).returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Failed to create conversation" });
    }
  });

  // ── Update conversation (rename, tag, important, archive) ───────────────
  app.patch("/api/legal-assistant/conversations/:id", requireLegalAdmin, async (req, res) => {
    try {
      const u = (req as any).legalUser as { id: number };
      const id = Number(req.params.id);
      const [existing] = await db.select().from(legalConversations).where(eq(legalConversations.id, id));
      if (!existing || existing.ownerUserId !== u.id) return res.status(404).json({ message: "Not found" });

      const patch: Partial<LegalConversation> = {};
      const allow = ["title", "category", "tags", "important", "liveMode", "archivedAt"] as const;
      for (const k of allow) {
        if (k in (req.body || {})) (patch as any)[k] = (req.body as any)[k];
      }
      patch.updatedAt = new Date();

      const [row] = await db.update(legalConversations)
        .set(patch as any)
        .where(eq(legalConversations.id, id))
        .returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Update failed" });
    }
  });

  // ── Delete conversation ─────────────────────────────────────────────────
  app.delete("/api/legal-assistant/conversations/:id", requireLegalAdmin, async (req, res) => {
    try {
      const u = (req as any).legalUser as { id: number };
      const id = Number(req.params.id);
      const [existing] = await db.select().from(legalConversations).where(eq(legalConversations.id, id));
      if (!existing || existing.ownerUserId !== u.id) return res.status(404).json({ message: "Not found" });
      await db.delete(legalConversations).where(eq(legalConversations.id, id));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Delete failed" });
    }
  });

  // ── Star / unstar a single message ──────────────────────────────────────
  app.patch("/api/legal-assistant/messages/:id", requireLegalAdmin, async (req, res) => {
    try {
      const u = (req as any).legalUser as { id: number };
      const id = Number(req.params.id);
      const [msg] = await db.select().from(legalMessages).where(eq(legalMessages.id, id));
      if (!msg) return res.status(404).json({ message: "Not found" });
      const [conv] = await db.select().from(legalConversations).where(eq(legalConversations.id, msg.conversationId));
      if (!conv || conv.ownerUserId !== u.id) return res.status(403).json({ message: "Forbidden" });

      const patch: Partial<LegalMessage> = {};
      if ("starred" in (req.body || {})) patch.starred = !!req.body.starred;

      const [row] = await db.update(legalMessages)
        .set(patch as any)
        .where(eq(legalMessages.id, id))
        .returning();
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Update failed" });
    }
  });

  // ── Ask: the heart of the system ────────────────────────────────────────
  // POST { conversationId?, content, voiceInput?, liveMode?, category? }
  app.post("/api/legal-assistant/ask", requireLegalAdmin, async (req, res) => {
    const startedAt = Date.now();
    try {
      const u = (req as any).legalUser as { id: number };
      const {
        conversationId,
        content,
        voiceInput = false,
        liveMode = false,
        category = "general",
      } = req.body || {};

      const question = String(content || "").trim();
      if (!question) return res.status(400).json({ message: "Question is required" });
      if (question.length > 4000) return res.status(400).json({ message: "Question too long (max 4000 chars)" });

      // Resolve / create conversation
      let conv: LegalConversation;
      if (conversationId) {
        const [found] = await db.select().from(legalConversations).where(eq(legalConversations.id, Number(conversationId)));
        if (!found || found.ownerUserId !== u.id) return res.status(404).json({ message: "Conversation not found" });
        conv = found;
      } else {
        const title = await generateTitle(question);
        const [created] = await db.insert(legalConversations).values({
          ownerUserId: u.id,
          title,
          category,
          liveMode: !!liveMode,
        }).returning();
        conv = created;
      }

      // Persist the user message immediately
      await db.insert(legalMessages).values({
        conversationId: conv.id,
        role: "user",
        content: question,
        voiceInput: !!voiceInput,
      });

      // Pull short prior context (last 8 turns) so the AI keeps memory
      const prior = await db.select().from(legalMessages)
        .where(eq(legalMessages.conversationId, conv.id))
        .orderBy(desc(legalMessages.createdAt))
        .limit(8);
      const contextLines = prior.reverse().slice(0, -1).map(m => {
        const tag = m.role === "user" ? "USER" : "ASSISTANT";
        const body = m.role === "assistant" && m.shortSummary
          ? m.shortSummary
          : m.content;
        return `${tag}: ${body}`.slice(0, 600);
      }).join("\n");

      const livePrefix = (conv.liveMode || liveMode)
        ? "⚠️ LIVE SITUATION — give the most urgent, direct steps first.\n\n"
        : "";

      const userPrompt = [
        contextLines && `Conversation so far:\n${contextLines}\n\n`,
        `${livePrefix}Question (category: ${conv.category || category}):\n${question}`,
      ].filter(Boolean).join("");

      // ── Primary call ─────────────────────────────────────────────────────
      let primaryRaw = "";
      try {
        primaryRaw = await aiComplete("admin_assistant", SYSTEM_PRIMARY, userPrompt, {
          temperature: 0.3,
          maxTokens: 1200,
          jsonMode: true,
        });
      } catch (e: any) {
        return res.status(502).json({ message: `AI primary call failed: ${e?.message || e}` });
      }

      const parsed = safeParseJSON<{
        rights?: string; risks?: string; next_steps?: string;
        things_to_avoid?: string; short_summary?: string;
        sources?: string[];
      }>(primaryRaw) || {};

      // ── Validation pass ─────────────────────────────────────────────────
      let validation: {
        confidence?: "high" | "medium" | "low";
        flagged?: boolean;
        validation_notes?: string;
        extra_sources?: string[];
      } = {};
      try {
        const validatorPrompt =
          `QUESTION:\n${question}\n\nPROPOSED ANSWER (JSON):\n${JSON.stringify(parsed, null, 2)}`;
        const validRaw = await aiComplete("admin_assistant", SYSTEM_VALIDATOR, validatorPrompt, {
          temperature: 0.1,
          maxTokens: 400,
          jsonMode: true,
        });
        validation = safeParseJSON(validRaw) || {};
      } catch {
        // Validation failure is non-fatal — keep going with low confidence.
        validation = { confidence: "low", flagged: true, validation_notes: "Validation pass unavailable." };
      }

      const mergedSources = Array.from(new Set([
        ...(parsed.sources || []),
        ...(validation.extra_sources || []),
      ])).filter(Boolean).slice(0, 12);

      // Compose a plain-text "content" so older UIs / exports still work
      const composed = [
        parsed.short_summary && `**Summary**\n${parsed.short_summary}`,
        parsed.rights && `**Your rights**\n${parsed.rights}`,
        parsed.risks && `**Risks**\n${parsed.risks}`,
        parsed.next_steps && `**Next steps**\n${parsed.next_steps}`,
        parsed.things_to_avoid && `**Avoid**\n${parsed.things_to_avoid}`,
      ].filter(Boolean).join("\n\n") || primaryRaw || "(No answer generated)";

      const [saved] = await db.insert(legalMessages).values({
        conversationId: conv.id,
        role: "assistant",
        content: composed,
        rights:        parsed.rights || null,
        risks:         parsed.risks  || null,
        nextSteps:     parsed.next_steps || null,
        thingsToAvoid: parsed.things_to_avoid || null,
        shortSummary:  parsed.short_summary || null,
        confidence:    validation.confidence || "medium",
        validationNotes: validation.validation_notes || null,
        flagged:       !!validation.flagged,
        sources:       mergedSources,
      }).returning();

      // Bump conversation updatedAt
      await db.update(legalConversations)
        .set({ updatedAt: new Date() })
        .where(eq(legalConversations.id, conv.id));

      res.json({
        conversation: conv,
        message: saved,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Ask failed" });
    }
  });

  // ── Export conversation as plain text ───────────────────────────────────
  app.get("/api/legal-assistant/conversations/:id/export", requireLegalAdmin, async (req, res) => {
    try {
      const u = (req as any).legalUser as { id: number };
      const id = Number(req.params.id);
      const [conv] = await db.select().from(legalConversations).where(eq(legalConversations.id, id));
      if (!conv || conv.ownerUserId !== u.id) return res.status(404).json({ message: "Not found" });
      const msgs = await db.select().from(legalMessages)
        .where(eq(legalMessages.conversationId, id))
        .orderBy(legalMessages.createdAt);

      const lines: string[] = [];
      lines.push(`AI Legal Assistant — ${conv.title}`);
      lines.push(`Category: ${conv.category}    Created: ${conv.createdAt.toISOString()}`);
      lines.push("─".repeat(60));
      for (const m of msgs) {
        lines.push("");
        lines.push(`[${m.role.toUpperCase()}] ${m.createdAt.toISOString()}`);
        lines.push(m.content);
        if (m.sources && m.sources.length) lines.push(`Sources: ${m.sources.join("; ")}`);
        if (m.confidence) lines.push(`Confidence: ${m.confidence}${m.flagged ? " (flagged)" : ""}`);
        if (m.validationNotes) lines.push(`Validator: ${m.validationNotes}`);
      }
      const txt = lines.join("\n");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="legal-${id}.txt"`);
      res.send(txt);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Export failed" });
    }
  });

  console.log("⚖️  Legal Assistant routes registered");
}
