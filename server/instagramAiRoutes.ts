import { type Express, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import {
  instagramAiPersona, instagramAutomationRules, instagramAiActions,
  instagramConnections,
} from "@shared/schema";
import { eq, and, desc, gte, lte, ilike, or, sql } from "drizzle-orm";
import axios from "axios";

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "missing",
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

const IG_GRAPH = "https://graph.instagram.com";

async function getActiveConnection(adminUserId: number) {
  const active = await db.select().from(instagramConnections)
    .where(and(eq(instagramConnections.adminUserId, adminUserId), eq(instagramConnections.isActive, true)))
    .limit(1);
  return active[0] || null;
}

export function buildPersonaSystemPrompt(persona: any): string {
  if (!persona) return "";

  const lines: string[] = [
    "You are an AI assistant acting on behalf of an Instagram creator/brand. Always respond authentically in their voice, tone, and style.",
    "",
  ];

  // ── Analyzed user preferences (from learning history) ──
  const profile = persona.analyzedProfile as any;
  if (profile && Object.keys(profile).length > 0) {
    lines.push("## User Preferences (Learned)");
    if (profile.howToAddressMe) lines.push(`How to address them: ${profile.howToAddressMe}`);
    if (profile.communicationTone) lines.push(`Preferred tone: ${profile.communicationTone}`);
    if (profile.languagePreference) lines.push(`Language preference: ${profile.languagePreference}`);
    if (Array.isArray(profile.myPreferences) && profile.myPreferences.length > 0)
      lines.push(`What they like: ${profile.myPreferences.join(", ")}`);
    if (Array.isArray(profile.avoidances) && profile.avoidances.length > 0)
      lines.push(`What to avoid: ${profile.avoidances.join(", ")}`);
    if (profile.otherNotes) lines.push(`Additional notes: ${profile.otherNotes}`);
    lines.push("");
  }

  if (persona.toneAndVoice?.trim()) {
    lines.push(`## Tone & Voice`);
    lines.push(persona.toneAndVoice.trim());
    lines.push("");
  }

  if (persona.communicationStyle?.trim()) {
    lines.push(`## Communication Style`);
    lines.push(persona.communicationStyle.trim());
    lines.push("");
  }

  if (persona.businessDirection?.trim()) {
    lines.push(`## Brand & Business Direction`);
    lines.push(persona.businessDirection.trim());
    lines.push("");
  }

  if (persona.topicsToAvoid?.trim()) {
    lines.push(`## Topics to Avoid`);
    lines.push(persona.topicsToAvoid.trim());
    lines.push("");
  }

  const examples = Array.isArray(persona.exampleInteractions) ? persona.exampleInteractions : [];
  if (examples.length > 0) {
    lines.push(`## Example Interactions`);
    examples.forEach((ex: any, i: number) => {
      if (ex.question && ex.answer) {
        lines.push(`Example ${i + 1}:`);
        lines.push(`Q: ${ex.question}`);
        lines.push(`A: ${ex.answer}`);
        lines.push("");
      }
    });
  }

  // ── New: training content samples ──
  const samples = Array.isArray(persona.contentSamples) ? persona.contentSamples : [];
  if (samples.length > 0) {
    lines.push(`## My Writing Style — Real Content Examples`);
    lines.push("These are real captions/posts written by the creator. Use them to deeply understand and mirror their voice:");
    samples.slice(0, 8).forEach((s: any, i: number) => {
      const text = typeof s === "string" ? s : s?.text;
      if (text?.trim()) {
        lines.push(`Example ${i + 1}: "${text.trim()}"`);
      }
    });
    lines.push("");
  }

  // ── New: custom vocabulary ──
  const vocab = Array.isArray(persona.customVocabulary) ? persona.customVocabulary : [];
  if (vocab.length > 0) {
    lines.push(`## Brand Vocabulary & Signature Words`);
    lines.push("Always incorporate these naturally when relevant:");
    const hashtags = vocab.filter((v: any) => v.type === "hashtag").map((v: any) => v.value);
    const phrases  = vocab.filter((v: any) => v.type === "phrase").map((v: any) => v.value);
    const slang    = vocab.filter((v: any) => v.type === "slang").map((v: any) => v.value);
    if (hashtags.length) lines.push(`Signature hashtags: ${hashtags.join(", ")}`);
    if (phrases.length)  lines.push(`Signature phrases: ${phrases.join(" | ")}`);
    if (slang.length)    lines.push(`Slang/terminology: ${slang.join(", ")}`);
    lines.push("");
  }

  // ── New: brand facts ──
  const facts = Array.isArray(persona.brandFacts) ? persona.brandFacts : [];
  if (facts.length > 0) {
    lines.push(`## Always-Remember Brand Facts`);
    facts.forEach((f: any) => {
      const text = typeof f === "string" ? f : f?.text;
      if (text?.trim()) lines.push(`• ${text.trim()}`);
    });
    lines.push("");
  }

  lines.push("Keep replies concise, authentic, and engaging. Match the creator's exact voice.");
  lines.push("Never reveal you are AI unless directly asked. Stay in character at all times.");

  return lines.join("\n");
}

function detectCommentLanguage(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return "Arabic";
  const dutchWords = ["de", "het", "een", "is", "dit", "dat", "je", "jij", "wat", "hoe", "mooi", "super", "top", "goed", "leuk", "gaaf", "vet", "dank", "bedankt", "ook", "maar", "wel", "niet"];
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,.!?]+/);
  const dutchCount = dutchWords.filter(w => words.includes(w)).length;
  return dutchCount >= 2 ? "Dutch" : "English";
}

async function generateDraftReply(
  sourceText: string,
  personaPrompt: string,
  context?: { postCaption?: string; username?: string; extraInstructions?: string },
): Promise<string> {
  const language = detectCommentLanguage(sourceText);
  const contextBlock = context?.postCaption
    ? `\nPost context: "${context.postCaption.slice(0, 300)}"\n`
    : "";
  const commenter = context?.username ? `@${context.username}` : "someone";
  const extraBlock = context?.extraInstructions?.trim()
    ? `\nSpecial instructions for this reply: ${context.extraInstructions}\n`
    : "";

  const userPrompt = `${contextBlock}${extraBlock}
Comment from ${commenter}: "${sourceText}"

Write ONE natural Instagram reply. Strict rules:
- Language: reply in ${language} (match the commenter's language exactly)
- Sound completely human — NOT like customer service, a bot, or AI
- Be direct, warm, and genuine — make it clear you actually read the comment
- NEVER open with: "Thanks for", "Thank you for", "Great comment", "Absolutely!", "Certainly!", "Of course!", "That's amazing!"
- Use 1-2 emojis naturally only if they match the creator's style
- If it's a question → give a real, direct answer
- If it's a compliment → respond naturally, not fake-enthusiastic
- If it's critical → stay calm, address it genuinely
- Max 150 characters ideally — short is powerful on Instagram
- ONLY output the reply text — no quotes, no labels, no explanation`;

  const { aiChat } = await import("./aiRouter");
  const msg = await aiChat({
    role: "instagram",
    maxTokens: 250,
    temperature: 0.85,
    system: personaPrompt || "You are an authentic Instagram creator who writes genuine, engaging replies that sound completely human. You care about your community.",
    messages: [{ role: "user", content: userPrompt }],
  });
  return msg.text.trim().replace(/^["']|["']$/g, "");
}

async function sendInstagramReply(
  commentId: string | null | undefined,
  mediaId: string | null | undefined,
  text: string,
  accessToken: string
): Promise<void> {
  if (commentId) {
    await axios.post(`${IG_GRAPH}/${commentId}/replies`, null, {
      params: { message: text, access_token: accessToken },
    });
  } else if (mediaId) {
    await axios.post(`${IG_GRAPH}/${mediaId}/comments`, null, {
      params: { message: text, access_token: accessToken },
    });
  }
}

export function registerInstagramAiRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: Function) => void,
) {
  /* ── GET /api/instagram/ai/persona ──────────────────────────────────────── */
  app.get("/api/instagram/ai/persona", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const connectionId = req.query.connectionId ? Number(req.query.connectionId) : null;
    const conds: any[] = [eq(instagramAiPersona.adminUserId, adminUserId)];
    if (connectionId) conds.push(eq(instagramAiPersona.instagramConnectionId, connectionId));

    const rows = await db.select().from(instagramAiPersona)
      .where(and(...conds))
      .limit(1);

    if (rows.length === 0) {
      return res.json({
        id: null, adminUserId, instagramConnectionId: connectionId,
        toneAndVoice: "", communicationStyle: "", businessDirection: "",
        topicsToAvoid: "", exampleInteractions: [], updatedAt: null,
      });
    }
    res.json(rows[0]);
  });

  /* ── PUT /api/instagram/ai/persona ──────────────────────────────────────── */
  app.put("/api/instagram/ai/persona", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const {
      connectionId: rawConnId,
      toneAndVoice = "", communicationStyle = "", businessDirection = "",
      topicsToAvoid = "", exampleInteractions = [],
      contentSamples = [], customVocabulary = [], brandFacts = [],
      learningHistory = [], analyzedProfile = null,
    } = req.body;

    const connectionId = rawConnId ? Number(rawConnId) : null;
    const conds: any[] = [eq(instagramAiPersona.adminUserId, adminUserId)];
    if (connectionId) conds.push(eq(instagramAiPersona.instagramConnectionId, connectionId));

    const existing = await db.select().from(instagramAiPersona)
      .where(and(...conds)).limit(1);

    const data = {
      toneAndVoice: String(toneAndVoice),
      communicationStyle: String(communicationStyle),
      businessDirection: String(businessDirection),
      topicsToAvoid: String(topicsToAvoid),
      exampleInteractions: Array.isArray(exampleInteractions) ? exampleInteractions : [],
      contentSamples: Array.isArray(contentSamples) ? contentSamples : [],
      customVocabulary: Array.isArray(customVocabulary) ? customVocabulary : [],
      brandFacts: Array.isArray(brandFacts) ? brandFacts : [],
      learningHistory: Array.isArray(learningHistory) ? learningHistory : [],
      analyzedProfile: analyzedProfile && typeof analyzedProfile === "object" ? analyzedProfile : null,
      updatedAt: new Date(),
    };

    if (existing.length === 0) {
      const [created] = await db.insert(instagramAiPersona).values({
        adminUserId,
        instagramConnectionId: connectionId,
        ...data,
      }).returning();
      return res.json(created);
    } else {
      const [updated] = await db.update(instagramAiPersona).set(data)
        .where(and(...conds)).returning();
      return res.json(updated);
    }
  });

  /* ── POST /api/instagram/ai/draft-reply ─────────────────────────────────── */
  app.post("/api/instagram/ai/draft-reply", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { sourceText, context = "", mediaId, commentId, triggerType = "manual" } = req.body;
    if (!sourceText?.trim()) return res.status(400).json({ error: "sourceText required" });

    const personaRows = await db.select().from(instagramAiPersona)
      .where(eq(instagramAiPersona.adminUserId, adminUserId)).limit(1);
    const persona = personaRows[0] || null;
    const systemPrompt = buildPersonaSystemPrompt(persona);

    try {
      const draft = await generateDraftReply(sourceText, systemPrompt);

      const [action] = await db.insert(instagramAiActions).values({
        adminUserId,
        triggerType,
        triggerData: { mediaId, commentId, sourceText, context },
        rawAiOutput: draft,
        status: "pending",
        mediaId: mediaId || null,
        commentId: commentId || null,
        sourceText: sourceText || null,
      }).returning();

      res.json({ ok: true, draft, actionId: action.id });
    } catch (err: any) {
      console.error("[IG AI Draft]", err.message);
      res.status(500).json({ error: "AI draft generation failed" });
    }
  });

  /* ── POST /api/instagram/ai/draft-all ───────────────────────────────────── */
  app.post("/api/instagram/ai/draft-all", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { comments = [] } = req.body;
    if (!Array.isArray(comments) || comments.length === 0) {
      return res.status(400).json({ error: "comments array required" });
    }

    const personaRows = await db.select().from(instagramAiPersona)
      .where(eq(instagramAiPersona.adminUserId, adminUserId)).limit(1);
    const persona = personaRows[0] || null;
    const systemPrompt = buildPersonaSystemPrompt(persona);

    const results: any[] = [];

    for (const comment of comments.slice(0, 20)) {
      try {
        const draft = await generateDraftReply(comment.text || "", systemPrompt);

        const [action] = await db.insert(instagramAiActions).values({
          adminUserId,
          triggerType: "bulk_draft",
          triggerData: { commentId: comment.id, mediaId: comment.mediaId },
          rawAiOutput: draft,
          status: "pending",
          mediaId: comment.mediaId || null,
          commentId: comment.id || null,
          sourceText: comment.text || null,
        }).returning();

        results.push({ commentId: comment.id, draft, actionId: action.id });
      } catch (err: any) {
        results.push({ commentId: comment.id, error: err.message });
      }
    }

    res.json({ ok: true, results });
  });

  /* ── POST /api/instagram/ai/send-reply ──────────────────────────────────── */
  app.post("/api/instagram/ai/send-reply", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { actionId, text, commentId, mediaId, sourceText } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });

    const conn = await getActiveConnection(adminUserId);
    if (!conn) return res.status(400).json({ error: "No connected Instagram account" });

    let resolvedActionId: number | null = actionId || null;

    try {
      await sendInstagramReply(commentId, mediaId, text, conn.accessToken);

      if (resolvedActionId) {
        // Update existing action log
        await db.update(instagramAiActions).set({
          status: "sent",
          finalSentText: text,
          updatedAt: new Date(),
        }).where(and(
          eq(instagramAiActions.id, resolvedActionId),
          eq(instagramAiActions.adminUserId, adminUserId),
        ));
      } else {
        // No prior draft action — create a new audit log entry for direct sends
        const [newAction] = await db.insert(instagramAiActions).values({
          adminUserId,
          triggerType: "manual",
          triggerData: { commentId, mediaId, directSend: true },
          rawAiOutput: text,
          status: "sent",
          finalSentText: text,
          mediaId: mediaId || null,
          commentId: commentId || null,
          sourceText: sourceText || null,
        }).returning();
        resolvedActionId = newAction.id;
      }

      res.json({ ok: true, actionId: resolvedActionId });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message;
      console.error("[IG AI Send]", msg);

      if (resolvedActionId) {
        // SECURITY: always scope update by adminUserId
        await db.update(instagramAiActions).set({
          status: "error",
          updatedAt: new Date(),
        }).where(and(
          eq(instagramAiActions.id, resolvedActionId),
          eq(instagramAiActions.adminUserId, adminUserId),
        ));
      } else {
        // Log failed direct send
        await db.insert(instagramAiActions).values({
          adminUserId,
          triggerType: "manual",
          triggerData: { commentId, mediaId, directSend: true, error: msg },
          rawAiOutput: text,
          status: "error",
          mediaId: mediaId || null,
          commentId: commentId || null,
          sourceText: sourceText || null,
        });
      }

      res.status(502).json({ error: msg });
    }
  });

  /* ── GET /api/instagram/ai/actions ──────────────────────────────────────── */
  app.get("/api/instagram/ai/actions", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { status, limit = "100", search, dateFrom, dateTo } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit) || 100, 500);

    const conditions: any[] = [eq(instagramAiActions.adminUserId, adminUserId)];

    if (status && status !== "all") {
      conditions.push(eq(instagramAiActions.status, status));
    }
    if (dateFrom) {
      conditions.push(gte(instagramAiActions.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      const dateTo_ = new Date(dateTo);
      dateTo_.setHours(23, 59, 59, 999);
      conditions.push(lte(instagramAiActions.createdAt, dateTo_));
    }
    if (search) {
      conditions.push(
        or(
          ilike(instagramAiActions.sourceText, `%${search}%`),
          ilike(instagramAiActions.rawAiOutput, `%${search}%`),
        )
      );
    }

    const rows = await db.select().from(instagramAiActions)
      .where(and(...conditions))
      .orderBy(desc(instagramAiActions.createdAt))
      .limit(lim);

    res.json(rows);
  });

  /* ── PATCH /api/instagram/ai/actions/:id ────────────────────────────────── */
  app.patch("/api/instagram/ai/actions/:id", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const { status, finalSentText } = req.body;
    const allowed = ["approved", "rejected", "pending", "sent", "error"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const [updated] = await db.update(instagramAiActions).set({
      status,
      ...(finalSentText !== undefined ? { finalSentText } : {}),
      updatedAt: new Date(),
    }).where(and(
      eq(instagramAiActions.id, id),
      eq(instagramAiActions.adminUserId, adminUserId),
    )).returning();

    if (!updated) return res.status(404).json({ error: "Action not found" });
    res.json(updated);
  });

  /* ── GET /api/instagram/pending-replies ─────────────────────────────────── */
  // Returns all pending comment reply actions waiting for admin approval
  app.get("/api/instagram/pending-replies", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const rows = await db.select().from(instagramAiActions)
      .where(and(
        eq(instagramAiActions.adminUserId, adminUserId),
        eq(instagramAiActions.status, "pending"),
      ))
      .orderBy(desc(instagramAiActions.createdAt))
      .limit(50);

    res.json(rows);
  });

  /* ── POST /api/instagram/ai/actions/:id/approve ─────────────────────────── */
  // Approve a pending draft reply and send it to Instagram
  app.post("/api/instagram/ai/actions/:id/approve", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    // Optional edited text from body — if not provided, use the AI draft
    const { text: editedText } = req.body;

    // Load the action
    const actions = await db.select().from(instagramAiActions)
      .where(and(
        eq(instagramAiActions.id, id),
        eq(instagramAiActions.adminUserId, adminUserId),
      )).limit(1);
    const action = actions[0];
    if (!action) return res.status(404).json({ error: "Action not found" });
    if (action.status !== "pending") return res.status(400).json({ error: "Action is no longer pending" });

    const replyText = (editedText || action.rawAiOutput || "").trim();
    if (!replyText) return res.status(400).json({ error: "No reply text available" });

    const conn = await getActiveConnection(adminUserId);
    if (!conn) return res.status(400).json({ error: "No connected Instagram account" });

    try {
      await sendInstagramReply(action.commentId, action.mediaId, replyText, conn.accessToken);

      await db.update(instagramAiActions).set({
        status: "sent",
        finalSentText: replyText,
        updatedAt: new Date(),
      }).where(and(
        eq(instagramAiActions.id, id),
        eq(instagramAiActions.adminUserId, adminUserId),
      ));

      res.json({ ok: true, actionId: id, sentText: replyText });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message;
      await db.update(instagramAiActions).set({ status: "error", updatedAt: new Date() })
        .where(and(eq(instagramAiActions.id, id), eq(instagramAiActions.adminUserId, adminUserId)));
      res.status(502).json({ error: msg });
    }
  });

  /* ── POST /api/instagram/ai/actions/:id/skip ────────────────────────────── */
  // Skip / dismiss a pending reply — it will no longer show in the queue
  app.post("/api/instagram/ai/actions/:id/skip", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const [updated] = await db.update(instagramAiActions).set({
      status: "skipped",
      updatedAt: new Date(),
    }).where(and(
      eq(instagramAiActions.id, id),
      eq(instagramAiActions.adminUserId, adminUserId),
    )).returning();

    if (!updated) return res.status(404).json({ error: "Action not found" });
    res.json({ ok: true, actionId: id });
  });

  /* ── GET /api/instagram/pending-dms ─────────────────────────────────────── */
  // Returns pending send_dm actions waiting for manager approval
  app.get("/api/instagram/pending-dms", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const rows = await db
      .select({
        id: instagramAiActions.id,
        adminUserId: instagramAiActions.adminUserId,
        triggerType: instagramAiActions.triggerType,
        triggerData: instagramAiActions.triggerData,
        rawAiOutput: instagramAiActions.rawAiOutput,
        finalSentText: instagramAiActions.finalSentText,
        status: instagramAiActions.status,
        ruleId: instagramAiActions.ruleId,
        mediaId: instagramAiActions.mediaId,
        commentId: instagramAiActions.commentId,
        sourceText: instagramAiActions.sourceText,
        createdAt: instagramAiActions.createdAt,
        updatedAt: instagramAiActions.updatedAt,
        ruleName: instagramAutomationRules.name,
      })
      .from(instagramAiActions)
      .leftJoin(instagramAutomationRules, eq(instagramAiActions.ruleId, instagramAutomationRules.id))
      .where(and(
        eq(instagramAiActions.adminUserId, adminUserId),
        eq(instagramAiActions.status, "pending"),
        eq(instagramAutomationRules.actionType, "send_dm"),
      ))
      .orderBy(desc(instagramAiActions.createdAt))
      .limit(50);

    res.json(rows);
  });

  /* ── GET /api/instagram/pending-dms/count ───────────────────────────────── */
  app.get("/api/instagram/pending-dms/count", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const rows = await db
      .select({ id: instagramAiActions.id })
      .from(instagramAiActions)
      .leftJoin(instagramAutomationRules, eq(instagramAiActions.ruleId, instagramAutomationRules.id))
      .where(and(
        eq(instagramAiActions.adminUserId, adminUserId),
        eq(instagramAiActions.status, "pending"),
        eq(instagramAutomationRules.actionType, "send_dm"),
      ));

    res.json({ count: rows.length });
  });

  /* ── GET /api/instagram/dm-actions ──────────────────────────────────────── */
  // Returns all DM actions (any status) joined with rules to confirm actionType = 'send_dm'
  app.get("/api/instagram/dm-actions", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { limit = "30" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit) || 30, 100);

    const rows = await db
      .select({
        id: instagramAiActions.id,
        adminUserId: instagramAiActions.adminUserId,
        triggerType: instagramAiActions.triggerType,
        triggerData: instagramAiActions.triggerData,
        rawAiOutput: instagramAiActions.rawAiOutput,
        finalSentText: instagramAiActions.finalSentText,
        status: instagramAiActions.status,
        ruleId: instagramAiActions.ruleId,
        mediaId: instagramAiActions.mediaId,
        commentId: instagramAiActions.commentId,
        sourceText: instagramAiActions.sourceText,
        createdAt: instagramAiActions.createdAt,
        updatedAt: instagramAiActions.updatedAt,
        ruleName: instagramAutomationRules.name,
      })
      .from(instagramAiActions)
      .leftJoin(instagramAutomationRules, eq(instagramAiActions.ruleId, instagramAutomationRules.id))
      .where(and(
        eq(instagramAiActions.adminUserId, adminUserId),
        eq(instagramAutomationRules.actionType, "send_dm"),
      ))
      .orderBy(desc(instagramAiActions.createdAt))
      .limit(lim);

    res.json(rows);
  });

  /* ── POST /api/instagram/ai/actions/:id/reject-dm ───────────────────────── */
  // Reject a pending DM — marks it as skipped/dismissed
  app.post("/api/instagram/ai/actions/:id/reject-dm", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    // Verify the action exists, belongs to this admin, is pending, and is a send_dm action
    const candidateRows = await db
      .select({
        id: instagramAiActions.id,
        status: instagramAiActions.status,
        actionType: instagramAutomationRules.actionType,
      })
      .from(instagramAiActions)
      .leftJoin(instagramAutomationRules, eq(instagramAiActions.ruleId, instagramAutomationRules.id))
      .where(and(
        eq(instagramAiActions.id, id),
        eq(instagramAiActions.adminUserId, adminUserId),
      ))
      .limit(1);

    const candidate = candidateRows[0];
    if (!candidate) return res.status(404).json({ error: "Action not found" });
    if (candidate.status !== "pending") return res.status(400).json({ error: "Action is no longer pending" });
    if (candidate.actionType !== "send_dm") return res.status(400).json({ error: "Action is not a DM action" });

    const [updated] = await db.update(instagramAiActions).set({
      status: "skipped",
      updatedAt: new Date(),
    }).where(and(
      eq(instagramAiActions.id, id),
      eq(instagramAiActions.adminUserId, adminUserId),
    )).returning();

    if (!updated) return res.status(404).json({ error: "Action not found" });
    res.json({ ok: true, actionId: id });
  });

  /* ── GET /api/instagram/automation/rules ────────────────────────────────── */
  app.get("/api/instagram/automation/rules", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const connectionId = req.query.connectionId ? Number(req.query.connectionId) : null;
    const conds: any[] = [eq(instagramAutomationRules.adminUserId, adminUserId)];
    if (connectionId) conds.push(eq(instagramAutomationRules.instagramConnectionId, connectionId));

    const rules = await db.select().from(instagramAutomationRules)
      .where(and(...conds))
      .orderBy(desc(instagramAutomationRules.createdAt));

    res.json(rules);
  });

  /* ── POST /api/instagram/automation/rules ───────────────────────────────── */
  app.post("/api/instagram/automation/rules", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const {
      connectionId: rawConnId,
      name, triggerType, conditionKeyword, conditionKeywordExclude,
      engagementThreshold, replyTemplate, actionType, autoSend = false
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name required" });
    if (!triggerType?.trim()) return res.status(400).json({ error: "triggerType required" });
    if (!actionType?.trim()) return res.status(400).json({ error: "actionType required" });

    const VALID_TRIGGERS = [
      "comment_received", "comment_contains_keyword", "comment_sentiment_negative",
      "new_follower_dm", "post_engagement_spike", "new_post_published",
    ];
    const VALID_ACTIONS = [
      "draft_reply", "send_dm", "notify_admin", "like_comment", "hide_comment", "tag_for_review",
    ];

    if (!VALID_TRIGGERS.includes(triggerType)) return res.status(400).json({ error: "Invalid triggerType" });
    if (!VALID_ACTIONS.includes(actionType)) return res.status(400).json({ error: "Invalid actionType" });

    const connectionId = rawConnId ? Number(rawConnId) : null;

    const [rule] = await db.insert(instagramAutomationRules).values({
      adminUserId,
      instagramConnectionId: connectionId,
      name: String(name),
      triggerType: String(triggerType),
      conditionKeyword: conditionKeyword ? String(conditionKeyword) : null,
      conditionKeywordExclude: conditionKeywordExclude ? String(conditionKeywordExclude) : null,
      engagementThreshold: engagementThreshold ? Number(engagementThreshold) : 100,
      replyTemplate: replyTemplate ? String(replyTemplate) : null,
      actionType: String(actionType),
      autoSend: Boolean(autoSend),
      isActive: true,
    }).returning();

    res.json(rule);
  });

  /* ── PATCH /api/instagram/automation/rules/:id ──────────────────────────── */
  app.patch("/api/instagram/automation/rules/:id", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const VALID_TRIGGERS = [
      "comment_received", "comment_contains_keyword", "comment_sentiment_negative",
      "new_follower_dm", "post_engagement_spike", "new_post_published",
    ];
    const VALID_ACTIONS = [
      "draft_reply", "send_dm", "notify_admin", "like_comment", "hide_comment", "tag_for_review",
    ];

    const {
      name, triggerType, conditionKeyword, conditionKeywordExclude,
      engagementThreshold, replyTemplate, actionType, autoSend, isActive
    } = req.body;

    if (triggerType !== undefined && !VALID_TRIGGERS.includes(triggerType)) {
      return res.status(400).json({ error: `Invalid triggerType` });
    }
    if (actionType !== undefined && !VALID_ACTIONS.includes(actionType)) {
      return res.status(400).json({ error: `Invalid actionType` });
    }

    const patch: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) patch.name = String(name);
    if (triggerType !== undefined) patch.triggerType = String(triggerType);
    if (conditionKeyword !== undefined) patch.conditionKeyword = conditionKeyword ? String(conditionKeyword) : null;
    if (conditionKeywordExclude !== undefined) patch.conditionKeywordExclude = conditionKeywordExclude ? String(conditionKeywordExclude) : null;
    if (engagementThreshold !== undefined) patch.engagementThreshold = Number(engagementThreshold);
    if (replyTemplate !== undefined) patch.replyTemplate = replyTemplate ? String(replyTemplate) : null;
    if (actionType !== undefined) patch.actionType = String(actionType);
    if (autoSend !== undefined) patch.autoSend = Boolean(autoSend);
    if (isActive !== undefined) patch.isActive = Boolean(isActive);

    const [updated] = await db.update(instagramAutomationRules).set(patch)
      .where(and(
        eq(instagramAutomationRules.id, id),
        eq(instagramAutomationRules.adminUserId, adminUserId),
      )).returning();

    if (!updated) return res.status(404).json({ error: "Rule not found" });
    res.json(updated);
  });

  /* ── GET /api/instagram/automation/stats ────────────────────────────────── */
  app.get("/api/instagram/automation/stats", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const rules = await db.select().from(instagramAutomationRules)
      .where(eq(instagramAutomationRules.adminUserId, adminUserId));

    const totalRules = rules.length;
    const activeRules = rules.filter(r => r.isActive).length;
    const totalFires = rules.reduce((s, r) => s + (r.triggerCount || 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayActions } = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(instagramAiActions)
      .where(and(
        eq(instagramAiActions.adminUserId, adminUserId),
        gte(instagramAiActions.createdAt, today),
      ))
      .then(r => r[0]);

    res.json({ totalRules, activeRules, totalFires, todayActions });
  });

  /* ── POST /api/instagram/automation/rules/:id/test ──────────────────────── */
  app.post("/api/instagram/automation/rules/:id/test", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const [rule] = await db.select().from(instagramAutomationRules)
      .where(and(eq(instagramAutomationRules.id, id), eq(instagramAutomationRules.adminUserId, adminUserId)));
    if (!rule) return res.status(404).json({ error: "Rule not found" });

    const sampleTexts: Record<string, string> = {
      comment_received: "Wauw dit is zo mooi! Hoe doe je dit?",
      comment_contains_keyword: rule.conditionKeyword ? `Kan ik meer ${rule.conditionKeyword} info krijgen?` : "Wat is de prijs?",
      comment_sentiment_negative: "Dit is echt slecht en teleurstellend...",
      new_follower_dm: "Hoi! Ik volg je nu 👋",
      post_engagement_spike: `Post heeft ${rule.engagementThreshold || 100}+ engagements bereikt`,
      new_post_published: "Nieuwe post gepubliceerd op je account",
    };

    const sampleText = sampleTexts[rule.triggerType] || "Test trigger tekst";
    const personaRows = await db.select().from(instagramAiPersona)
      .where(eq(instagramAiPersona.adminUserId, adminUserId)).limit(1);
    const systemPrompt = buildPersonaSystemPrompt(personaRows[0] || null);

    let preview = "";
    if (rule.replyTemplate) {
      preview = rule.replyTemplate;
    } else if (["draft_reply", "send_dm"].includes(rule.actionType)) {
      preview = await generateDraftReply(sampleText, systemPrompt);
    } else if (rule.actionType === "notify_admin") {
      preview = `[Melding] Regel "${rule.name}" getriggerd door: "${sampleText.slice(0, 80)}"`;
    } else if (rule.actionType === "like_comment") {
      preview = `[Like] Comment zou automatisch geliked worden`;
    } else if (rule.actionType === "hide_comment") {
      preview = `[Verbergen] Comment zou verborgen worden voor andere gebruikers`;
    } else if (rule.actionType === "tag_for_review") {
      preview = `[Review] Comment wordt gemarkeerd voor handmatige review`;
    }

    res.json({
      rule: { id: rule.id, name: rule.name, triggerType: rule.triggerType, actionType: rule.actionType },
      sampleInput: sampleText,
      preview,
      note: "Dit is een droogtest — er is geen actie uitgevoerd op Instagram",
    });
  });

  /* ── POST /api/instagram/automation/run-now ─────────────────────────────── */
  app.post("/api/instagram/automation/run-now", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { runInstagramAutomation } = await import("./instagramAutomationScheduler");
      await runInstagramAutomation();
      res.json({ ok: true, message: "Automatisering handmatig uitgevoerd" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ── DELETE /api/instagram/automation/rules/:id ─────────────────────────── */
  app.delete("/api/instagram/automation/rules/:id", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    await db.delete(instagramAutomationRules)
      .where(and(
        eq(instagramAutomationRules.id, id),
        eq(instagramAutomationRules.adminUserId, adminUserId),
      ));

    res.json({ ok: true });
  });

  /* ── POST /api/instagram/automation/evaluate ────────────────────────────── */
  app.post("/api/instagram/automation/evaluate", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { comments = [], newFollowers = [], mediaInsights = [] } = req.body;

    const rules = await db.select().from(instagramAutomationRules)
      .where(and(
        eq(instagramAutomationRules.adminUserId, adminUserId),
        eq(instagramAutomationRules.isActive, true),
      ));

    if (rules.length === 0) return res.json({ queued: [] });

    const personaRows = await db.select().from(instagramAiPersona)
      .where(eq(instagramAiPersona.adminUserId, adminUserId)).limit(1);
    const persona = personaRows[0] || null;
    const systemPrompt = buildPersonaSystemPrompt(persona);

    const conn = await getActiveConnection(adminUserId);
    const queued: any[] = [];

    async function executeAction(rule: any, triggerData: any, sourceText: string | null, mediaId?: string, commentId?: string) {
      if (rule.actionType === "draft_reply") {
        const draft = sourceText ? await generateDraftReply(sourceText, systemPrompt) : "";
        const status = rule.autoSend ? "sent" : "pending";

        const [action] = await db.insert(instagramAiActions).values({
          adminUserId,
          triggerType: rule.triggerType,
          triggerData,
          rawAiOutput: draft,
          status,
          finalSentText: rule.autoSend ? draft : null,
          ruleId: rule.id,
          mediaId: mediaId || null,
          commentId: commentId || null,
          sourceText: sourceText || null,
        }).returning();

        if (rule.autoSend && conn && draft) {
          try {
            await sendInstagramReply(commentId, mediaId, draft, conn.accessToken);
          } catch (sendErr: any) {
            console.error("[IG Automation AutoSend]", sendErr.message);
            await db.update(instagramAiActions).set({ status: "error", updatedAt: new Date() })
              .where(and(eq(instagramAiActions.id, action.id), eq(instagramAiActions.adminUserId, adminUserId)));
          }
        }

        queued.push({ ruleId: rule.id, actionId: action.id, draft, autoSent: rule.autoSend });

      } else if (rule.actionType === "notify_admin") {
        const notifText = sourceText ? `Rule "${rule.name}" triggered. Source: "${sourceText.slice(0, 100)}"` : `Rule "${rule.name}" triggered.`;
        const [action] = await db.insert(instagramAiActions).values({
          adminUserId,
          triggerType: rule.triggerType,
          triggerData,
          rawAiOutput: notifText,
          status: "sent",
          finalSentText: notifText,
          ruleId: rule.id,
          mediaId: mediaId || null,
          commentId: commentId || null,
          sourceText: sourceText || null,
        }).returning();
        queued.push({ ruleId: rule.id, actionId: action.id, type: "notification" });

      } else if (rule.actionType === "send_dm") {
        // Instagram DM API has strict limitations for business accounts.
        // We queue the draft for admin review rather than auto-sending.
        const draft = sourceText ? await generateDraftReply(sourceText, systemPrompt) : "";
        const [action] = await db.insert(instagramAiActions).values({
          adminUserId,
          triggerType: rule.triggerType,
          triggerData,
          rawAiOutput: draft,
          status: "pending",
          ruleId: rule.id,
          mediaId: mediaId || null,
          commentId: commentId || null,
          sourceText: sourceText || null,
        }).returning();
        queued.push({ ruleId: rule.id, actionId: action.id, draft, note: "DM queued for manual review (API limitation)" });
      }
    }

    // Process comment-based triggers
    for (const comment of (comments as any[]).slice(0, 50)) {
      for (const rule of rules) {
        let matches = false;

        if (rule.triggerType === "comment_received") {
          matches = true;
        } else if (rule.triggerType === "comment_contains_keyword" && rule.conditionKeyword) {
          const kw = rule.conditionKeyword.toLowerCase();
          matches = (comment.text || "").toLowerCase().includes(kw);
        }

        if (!matches) continue;

        try {
          await executeAction(rule, { commentId: comment.id, mediaId: comment.mediaId }, comment.text, comment.mediaId, comment.id);
        } catch (err: any) {
          console.error("[IG Automation Evaluate - comment]", err.message);
        }
        break; // Apply first matching rule per comment
      }
    }

    // Process new_follower_dm triggers
    const followerRules = rules.filter(r => r.triggerType === "new_follower_dm");
    for (const follower of (newFollowers as any[]).slice(0, 20)) {
      for (const rule of followerRules) {
        try {
          const welcomeText = `New follower @${follower.username || "someone"} followed you`;
          await executeAction(rule, { followerId: follower.id, username: follower.username }, welcomeText);
        } catch (err: any) {
          console.error("[IG Automation Evaluate - follower]", err.message);
        }
      }
    }

    // Process post_engagement_spike triggers
    const spikeRules = rules.filter(r => r.triggerType === "post_engagement_spike");
    for (const insight of (mediaInsights as any[]).slice(0, 10)) {
      const engagementRate = insight.engagementRate || 0;
      const threshold = 0.05; // 5% engagement spike threshold

      if (engagementRate >= threshold) {
        for (const rule of spikeRules) {
          try {
            const spikeText = `Post "${(insight.caption || "").slice(0, 80)}" reached ${(engagementRate * 100).toFixed(1)}% engagement`;
            await executeAction(rule, { mediaId: insight.id, engagementRate, caption: insight.caption }, spikeText, insight.id);
          } catch (err: any) {
            console.error("[IG Automation Evaluate - spike]", err.message);
          }
        }
      }
    }

    res.json({ queued });
  });

  /* ══════════════════════════════════════
     PROFILE MANAGEMENT — Bio & Picture
  ══════════════════════════════════════ */

  /* GET /api/instagram/profile — return current bio + profile picture from DB */
  app.get("/api/instagram/profile", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getActiveConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "No active Instagram connection" });
    res.json({
      biography: conn.biography || "",
      website: conn.website || "",
      profilePictureUrl: conn.profilePictureUrl || "",
      username: conn.username || "",
      name: conn.name || "",
    });
  });

  /* ── POST /api/instagram/ai/best-time — AI best-time-to-post advisor ──────── */
  app.post("/api/instagram/ai/best-time", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const conn = await getActiveConnection(adminUserId);

    // Gather recent media to analyze engagement patterns
    let postsText = "No post data available yet.";
    if (conn) {
      try {
        const mediaRes = await axios.get(`https://graph.instagram.com/${conn.instagramUserId}/media`, {
          params: {
            fields: "id,media_type,timestamp,like_count,comments_count",
            limit: 50,
            access_token: conn.accessToken,
          },
        });
        const posts: any[] = mediaRes.data?.data || [];
        if (posts.length > 0) {
          // Group by media type for richer analysis
          const byType: Record<string, any[]> = {};
          posts.forEach((p: any) => {
            const t = p.media_type || "PHOTO";
            if (!byType[t]) byType[t] = [];
            byType[t].push(p);
          });
          const lines: string[] = [];
          for (const [type, typePosts] of Object.entries(byType)) {
            lines.push(`\n--- ${type} posts (${typePosts.length} total) ---`);
            typePosts.forEach((p: any) => {
              const d = new Date(p.timestamp);
              const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "long" });
              const hour = d.getHours();
              lines.push(`Day: ${dayOfWeek}, Hour: ${hour}:00, Likes: ${p.like_count || 0}, Comments: ${p.comments_count || 0}`);
            });
          }
          postsText = lines.join("\n");
        }
      } catch { /* use fallback text */ }
    }

    try {
      const { aiChat } = await import("./aiRouter");
      const now = new Date();
      const msg = await aiChat({
        role: "instagram",
        maxTokens: 800,
        system: "You are an Instagram growth expert. Analyze post engagement data by media type and recommend the optimal time to post. Return ONLY a JSON object.",
        messages: [{
          role: "user",
          content: `Based on this post engagement history (grouped by media type), determine the best times to post on Instagram.\n\nHistory:\n${postsText}\n\nCurrent date/time: ${now.toISOString()}\n\nReturn ONLY a JSON object with these exact fields:\n{\n  "bestDays": "string — e.g. Tuesday, Thursday, Saturday",\n  "bestHours": "string — e.g. 7:00–9:00 AM and 6:00–8:00 PM",\n  "reelsAdvice": "string — specific best time advice for Reels/video content",\n  "photoAdvice": "string — specific best time advice for photo posts",\n  "recommendation": "string — 2-3 sentence overall strategy explanation",\n  "suggestedDateTime": "string — next optimal datetime in ISO 8601 local format YYYY-MM-DDTHH:MM"\n}`,
        }],
      });
      const raw = msg.text || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const result = JSON.parse(jsonMatch[0]);
      return res.json(result);
    } catch (err: any) {
      console.error("[IG AI] best-time error:", err.message);
      return res.status(500).json({ error: "Best time analysis failed: " + err.message });
    }
  });


  /* POST /api/instagram/profile/update-bio — update Instagram biography via Graph API */
  app.post("/api/instagram/profile/update-bio", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getActiveConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "No active Instagram connection" });

    const bio: string = (req.body?.biography || "").trim();
    if (bio.length > 150) return res.status(400).json({ error: "Bio may not exceed 150 characters" });

    try {
      // Use the Facebook Graph API (not graph.instagram.com) for profile updates
      await axios.post(
        `https://graph.facebook.com/v18.0/${conn.instagramUserId}`,
        null,
        { params: { biography: bio, access_token: conn.accessToken } }
      );
      await db.update(instagramConnections)
        .set({ biography: bio })
        .where(eq(instagramConnections.id, conn.id));
      res.json({ success: true, biography: bio });
    } catch (err: any) {
      const apiErr = err?.response?.data?.error;
      const msg: string = apiErr?.message || err.message || "Failed to update bio";
      console.error("[IG Profile] update-bio error:", msg);

      // Instagram's API restricts bio updates for most account types —
      // requires instagram_manage_profile permission with Meta app review.
      // Save the bio locally so the user's work is not lost.
      const lower = msg.toLowerCase();
      const isApiLimit =
        apiErr?.code === 100 ||
        apiErr?.code === 190 || // OAuth access token errors
        lower.includes("unsupported") ||
        lower.includes("permission") ||
        lower.includes("not exist") ||
        lower.includes("not supported") ||
        lower.includes("missing permissions") ||
        lower.includes("cannot parse access token") ||
        lower.includes("invalid oauth access token") ||
        lower.includes("oauth");

      if (isApiLimit) {
        // Still persist the bio locally in our DB
        await db.update(instagramConnections)
          .set({ biography: bio })
          .where(eq(instagramConnections.id, conn.id));
        return res.status(422).json({
          error: "api_limitation",
          message: "Instagram's Graph API does not allow programmatic bio updates for personal/creator tokens. This requires a Facebook Page access token with the instagram_manage_profile permission (Meta app review). Your bio has been saved locally — update it manually at instagram.com/accounts/edit, or connect via Facebook Login (Verbinden met Instagram Business) instead of a direct token.",
          biography: bio,
        });
      }

      res.status(502).json({ error: msg });
    }
  });

  /* POST /api/instagram/profile/update-picture — update profile picture via Graph API */
  app.post("/api/instagram/profile/update-picture", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getActiveConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "No active Instagram connection" });

    const pictureUrl: string = (req.body?.pictureUrl || "").trim();
    if (!pictureUrl) return res.status(400).json({ error: "pictureUrl required" });
    if (!pictureUrl.startsWith("https://")) return res.status(400).json({ error: "pictureUrl must be https" });

    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${conn.instagramUserId}`,
        { profile_picture_url: pictureUrl, access_token: conn.accessToken }
      );
      await db.update(instagramConnections)
        .set({ profilePictureUrl: pictureUrl })
        .where(eq(instagramConnections.id, conn.id));
      res.json({ success: true, profilePictureUrl: pictureUrl });
    } catch (err: any) {
      const apiErr = err?.response?.data?.error;
      const apiMsg: string = apiErr?.message || err.message || "Failed";
      console.error("[IG Profile] update-picture error:", apiMsg);

      // Instagram's Graph API does not support profile picture updates for any
      // account type without very specific restricted permissions (app review required).
      // Detect all common rejection patterns and fall back gracefully.
      const msgL = apiMsg.toLowerCase();
      const isApiLimit =
        apiErr?.code === 100 ||
        msgL.includes("unsupported") ||
        msgL.includes("permission") ||
        msgL.includes("not supported") ||
        msgL.includes("not exist") ||
        msgL.includes("oauth") ||
        msgL.includes("access token") ||
        msgL.includes("cannot parse") ||
        msgL.includes("invalid token") ||
        msgL.includes("missing permissions");

      if (isApiLimit) {
        // Still persist the Cloudinary URL locally so the user's upload isn't lost
        await db.update(instagramConnections)
          .set({ profilePictureUrl: pictureUrl })
          .where(eq(instagramConnections.id, conn.id));
        return res.status(422).json({
          error: "api_limitation",
          message: "Instagram's API does not allow programmatic profile picture updates. Your image has been saved. Update it manually at instagram.com/accounts/edit.",
          url: pictureUrl,
        });
      }
      res.status(502).json({ error: apiMsg });
    }
  });

  /* POST /api/instagram/ai/generate-bio — Claude generates bio options */
  app.post("/api/instagram/ai/generate-bio", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getActiveConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "No active Instagram connection" });

    const { currentBio, style, language, focus } = req.body as {
      currentBio?: string;
      style?: string;
      language?: string;
      focus?: string;
    };

    const persona = await db.select().from(instagramAiPersona)
      .where(eq(instagramAiPersona.adminUserId, adminUserId)).limit(1);
    const p = persona[0];

    const systemPrompt = `You are an expert Instagram bio copywriter for urban culture, street art, breakdancing, DJing, graffiti, and youth culture in the Netherlands. You write concise, punchy, and authentic bios that fit within 150 characters. Each bio must capture the brand identity and culture.

${p?.toneAndVoice ? `Tone & Voice: ${p.toneAndVoice}` : ""}
${p?.businessDirection ? `Brand Direction: ${p.businessDirection}` : ""}

Rules:
- Maximum 150 characters per bio (non-negotiable)
- Use line breaks (\n) sparingly for formatting
- Include 1-2 relevant emojis naturally
- For Dutch language, write authentically in Dutch
- Include a call-to-action only if it naturally fits
- Never start with "I" or "We"`;

    const userPrompt = `Generate 4 different Instagram bio options for the account @${conn.username || "this account"}.

Account name: ${conn.name || conn.username || "Unknown"}
${currentBio ? `Current bio: "${currentBio}"` : "No current bio yet."}
${style ? `Preferred style: ${style}` : ""}
${language ? `Language: ${language}` : "Language: English or Dutch (whichever fits best)"}
${focus ? `Key focus: ${focus}` : "Focus: Urban culture, street arts, community"}

Return ONLY a JSON array with exactly 4 objects, each with:
- "text": the bio text (max 150 chars)
- "style": a 2-word description of the style (e.g. "Bold & Punchy", "Warm & Community")
- "charCount": character count of text

Example format:
[
  {"text": "...", "style": "Bold & Punchy", "charCount": 89},
  ...
]`;

    try {
      const { aiChat } = await import("./aiRouter");
      const msg = await aiChat({
        role: "instagram",
        maxTokens: 800,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      });

      const raw = msg.text || "";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array in response");
      const options = JSON.parse(jsonMatch[0]);

      res.json({ options: options.slice(0, 4) });
    } catch (err: any) {
      console.error("[IG AI] generate-bio error:", err.message);
      res.status(500).json({ error: "Bio generation failed: " + err.message });
    }
  });

  /* ── POST /api/instagram/ai/import-captions ─────────────────────────────── */
  app.post("/api/instagram/ai/import-captions", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const conn = await getActiveConnection(adminUserId);
    if (!conn) return res.status(400).json({ error: "No active Instagram connection" });

    try {
      const { limit = 20 } = req.body;
      const safeLimit = Math.min(Number(limit) || 20, 50);

      const mediaRes = await axios.get(
        `https://graph.instagram.com/v21.0/me/media`,
        {
          params: {
            fields: "id,caption,media_type,timestamp,permalink",
            limit: safeLimit,
            access_token: conn.accessToken,
          },
        }
      );

      const items = (mediaRes.data?.data || [])
        .filter((m: any) => m.caption?.trim())
        .map((m: any) => ({
          id: m.id,
          text: m.caption.trim(),
          mediaType: m.media_type,
          timestamp: m.timestamp,
          permalink: m.permalink,
        }));

      res.json({ items });
    } catch (err: any) {
      console.error("[IG AI] import-captions error:", err.message);
      res.status(500).json({ error: "Failed to import captions: " + err.message });
    }
  });

  /* ── POST /api/instagram/ai/analyze-style ───────────────────────────────── */
  app.post("/api/instagram/ai/analyze-style", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { contentSamples = [], currentPersona = {} } = req.body;

    if (!Array.isArray(contentSamples) || contentSamples.length === 0) {
      return res.status(400).json({ error: "At least one content sample is required" });
    }

    const sampleTexts = contentSamples
      .map((s: any) => (typeof s === "string" ? s : s?.text) || "")
      .filter(Boolean)
      .slice(0, 10)
      .join("\n\n---\n\n");

    const prompt = `You are an expert brand analyst. Analyze these real Instagram captions written by a creator/brand and return improved AI persona training data.

CAPTIONS TO ANALYZE:
${sampleTexts}

CURRENT PERSONA (may be empty):
- Tone & Voice: ${currentPersona.toneAndVoice || "(not set)"}
- Communication Style: ${currentPersona.communicationStyle || "(not set)"}
- Business Direction: ${currentPersona.businessDirection || "(not set)"}

Based on the captions, return a JSON object with these fields:
{
  "toneAndVoice": "detailed description of their tone, energy, personality in 2-4 sentences",
  "communicationStyle": "specific rules for how they write: sentence length, emoji use, punctuation style, how they start/end sentences",
  "suggestedHashtags": ["array", "of", "hashtags", "they", "use", "or", "should", "use"],
  "suggestedPhrases": ["signature phrases", "recurring expressions"],
  "brandFacts": ["key fact about their brand/identity extracted from captions"],
  "analysis": "1-2 sentence summary of what makes their content unique"
}

Return ONLY the JSON object, no other text.`;

    try {
      const { aiChat } = await import("./aiRouter");
      const msg = await aiChat({
        role: "instagram",
        maxTokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = msg.text || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const result = JSON.parse(jsonMatch[0]);

      res.json({ ok: true, result });
    } catch (err: any) {
      console.error("[IG AI] analyze-style error:", err.message);
      res.status(500).json({ error: "Style analysis failed: " + err.message });
    }
  });

  /* ── POST /api/instagram/ai/analyze-preferences ─────────────────────────── */
  app.post("/api/instagram/ai/analyze-preferences", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { entries } = req.body as { entries: string[] };
    if (!Array.isArray(entries) || entries.length === 0)
      return res.status(400).json({ error: "entries array required" });

    const entriesText = entries.map((e, i) => `${i + 1}. ${e}`).join("\n");

    const systemPrompt = `Je bent een AI-assistent die leert van gebruikersinput om beter te begrijpen hoe je de gebruiker moet helpen. Analyseer de invoer en categoriseer de geleerde informatie nauwkeurig.

Return ALLEEN een JSON object met exact deze structuur:
{
  "howToAddressMe": "string — hoe de gebruiker aangesproken wil worden (formeel/informeel, jij/u, naam, etc.)",
  "communicationTone": "string — de gewenste toon en stijl van communicatie",
  "languagePreference": "string — taalvoorkeur (Nederlands, Engels, mix, etc.)",
  "myPreferences": ["string"] — lijst van dingen die de gebruiker graag wil (max 8 items),
  "avoidances": ["string"] — lijst van dingen die de gebruiker wil vermijden (max 8 items),
  "otherNotes": "string — overige relevante notities en context over de gebruiker"
}

Als een veld niet van toepassing is of niet uit de input herleid kan worden, gebruik dan een lege string of lege array.`;

    try {
      const { aiChat } = await import("./aiRouter");
      const msg = await aiChat({
        role: "instagram",
        maxTokens: 1000,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Analyseer de volgende gebruikersvoorkeuren en leerhistorie:\n\n${entriesText}\n\nGeef een gestructureerde analyse van wat je hebt geleerd over deze gebruiker.`,
        }],
      });

      const raw = msg.text || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const profile = JSON.parse(jsonMatch[0]);

      return res.json({ ok: true, profile });
    } catch (err: any) {
      console.error("[IG AI] analyze-preferences error:", err.message);
      return res.status(500).json({ error: "Preference analysis failed: " + err.message });
    }
  });
}
