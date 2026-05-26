/**
 * Ads Hub — Phase 1 (semi-auto): AI drafts campaigns; admin reviews, copies into
 * each ad platform UI, logs spend, and gets daily AI insights.
 *
 *   POST /api/admin/ads/draft           — AI generates a full campaign draft
 *   POST /api/admin/ads/creatives       — AI generates extra ad copy variations
 *   GET  /api/admin/ads/campaigns
 *   POST /api/admin/ads/campaigns
 *   PATCH /api/admin/ads/campaigns/:id
 *   DELETE /api/admin/ads/campaigns/:id
 *   POST /api/admin/ads/campaigns/:id/spend
 *   GET  /api/admin/ads/campaigns/:id/spend
 *   GET  /api/admin/ads/analytics       — unified KPIs (spend + signups attributed)
 *   POST /api/admin/ads/insights        — generate AI recommendation report
 *   GET  /api/admin/ads/insights/latest
 *   POST /api/track/landing             — public: capture UTM landing
 *   POST /api/track/conversion          — public: mark a session as converted
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import {
  adCampaigns, adSpendLogs, adAttributions, adInsights,
  insertAdCampaignSchema, insertAdSpendLogSchema,
} from "@shared/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { aiChat } from "./aiRouter";
import { loadMarketingContext } from "./marketingContextRoutes";

function tryParseJson(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/i, "").replace(/```\s*$/m, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
function slug(s: string) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "campaign";
}

const PLATFORM_GUIDE: Record<string, string> = {
  google: "Google Ads (Search/Display). Headlines: 30 chars max, descriptions: 90 chars max. Output 10 headlines + 4 descriptions + 20 keywords (mix of broad, exact, long-tail).",
  meta: "Meta Ads (Instagram + Facebook). Primary text up to 125 chars catchy, headline up to 40 chars, description up to 30 chars. Output 5 primary texts + 5 headlines + 1 image-prompt + 10 hashtags + interest-targeting suggestions.",
  tiktok: "TikTok Ads. Punchy, native-feeling, Gen Z/Millennial tone. Output 5 hook lines (under 60 chars) + 5 captions (under 100 chars) + 1 video script (15s, scene-by-scene) + 10 hashtags.",
  linkedin: "LinkedIn Ads. Professional but authentic. Output 5 headlines (150 chars max), 5 intro texts (150 chars), recommended job-titles + industries to target. Keep tone credible, mention community/networking.",
};

export function registerAdsHubRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: any) => void,
) {
  // ── AI: draft a full campaign ───────────────────────────────────────────
  app.post("/api/admin/ads/draft", requireAdmin, async (req: Request, res: Response) => {
    try {
      const {
        platform, goal = "signups", productPitch, audience,
        dailyBudgetEur = 10, name,
        angle, featureFocus, audienceOverride, language, tonalTwist, useContext = true,
      } = req.body ?? {};
      if (!platform || !PLATFORM_GUIDE[platform]) {
        return res.status(400).json({ error: "platform must be google|meta|tiktok|linkedin" });
      }

      // Load the editable Marketing Brain so AI knows the actual app
      const ctx = useContext ? await loadMarketingContext().catch(() => null) : null;

      const ctxBlock = ctx ? `
═══ MARKETING BRAIN (always use this — it's the single source of truth about the product) ═══
APP: ${ctx.appName}
TAGLINE: ${ctx.tagline || ""}
PITCH: ${ctx.pitch || ""}

UNIQUE VALUE: ${ctx.uniqueValue || ""}

KEY FEATURES:
${(ctx.features as any[] || []).map((f: any) => `- ${f.name}: ${f.description}${f.audienceFit ? ` (fits: ${f.audienceFit})` : ""}`).join("\n")}

AUDIENCE PERSONAS:
${(ctx.audiencePersonas as any[] || []).map((p: any) => `- ${p.name}: ${p.description}\n   pain: ${(p.painPoints || []).join(", ")}\n   wants: ${(p.motivators || []).join(", ")}`).join("\n")}

BRAND VOICE: ${ctx.brandVoice || ""}
DO say: ${(ctx.doSay as string[] || []).join(", ")}
DON'T say: ${(ctx.dontSay as string[] || []).join(", ")}
COMPETITORS / WHY WE WIN: ${ctx.competitors || ""}
GEO FOCUS: ${ctx.geographicFocus || ""}
LANGUAGES: ${(ctx.languages as string[] || ["en"]).join(", ")}
EXAMPLE OF COPY THAT WORKS:
"${ctx.exampleWinningCopy || ""}"
═══════════════════════════════════════════════════════════════════════════════════════════
` : "";

      const system = `You are a senior performance-marketing strategist. You only ever write ad copy that's GROUNDED in the Marketing Brain provided — never make up features that don't exist there, never use generic cliches. Always respond in STRICT JSON.`;
      const userMsg = `Draft a complete ad campaign.
${ctxBlock}
═══ THIS CAMPAIGN ═══
Platform: ${platform}
Goal: ${goal}
Daily budget: €${dailyBudgetEur}
${productPitch ? `Extra pitch override: ${productPitch}\n` : ""}${audience ? `Audience hint: ${audience}\n` : ""}${audienceOverride ? `AUDIENCE OVERRIDE — write specifically for: ${audienceOverride}\n` : ""}${angle ? `ANGLE — frame the campaign around: ${angle}\n` : ""}${featureFocus ? `FEATURE FOCUS — make the hero of this ad: ${featureFocus}\n` : ""}${language ? `LANGUAGE — write copy in: ${language}\n` : ""}${tonalTwist ? `TONE TWIST: ${tonalTwist}\n` : ""}
═════════════════════

Platform requirements:
${PLATFORM_GUIDE[platform]}

Return JSON with this exact shape:
{
  "name": "short campaign name",
  "audience": {
    "locations": ["city or country list"],
    "ageRange": "e.g. 16-34",
    "interests": ["..."],
    "behaviors": ["..."],
    "languages": ["en","nl",...]
  },
  "creative": {
    "headlines": ["..."],
    "descriptions": ["..."],
    "primaryText": ["..."],
    "cta": "Sign Up | Join Now | Learn More",
    "imagePrompt": "vivid prompt for generating an ad image",
    "videoScript": "(only for tiktok)",
    "hashtags": ["#..."],
    "keywords": ["..."],
    "targetingNotes": "1-2 sentences on why this audience"
  },
  "recommendedDailyBudgetEur": number,
  "expectedSignupsPerWeek": "low estimate string e.g. '3-8'",
  "tips": ["3 short pro tips for running this campaign"]
}

Keep it punchy, urban-culture authentic, no corporate fluff. JSON only.`;

      const r = await aiChat({
        role: "content",
        system,
        messages: [{ role: "user", content: userMsg }],
        temperature: 0.85,
        maxTokens: 1400,
        jsonMode: true,
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI returned unreadable response", raw: r.text?.slice(0, 500) });

      // Build UTM defaults
      const utmCampaign = slug(parsed.name || name || `${platform}_${goal}`);
      res.json({
        ...parsed,
        utm: {
          source: platform,
          medium: platform === "google" ? "cpc" : "paid_social",
          campaign: utmCampaign,
        },
      });
    } catch (err: any) {
      console.error("[ads/draft]", err);
      res.status(500).json({ error: err.message || "Draft failed" });
    }
  });

  // ── AI: extra creative variations ───────────────────────────────────────
  app.post("/api/admin/ads/creatives", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { platform, productPitch, count = 5, kind = "headlines" } = req.body ?? {};
      if (!platform || !productPitch) return res.status(400).json({ error: "platform & productPitch required" });
      const r = await aiChat({
        role: "content",
        system: `You write urban-culture ad copy. Respond with JSON: {"variations":["..."]}.`,
        messages: [{ role: "user", content: `Give me ${count} ${kind} for ${platform} for: ${productPitch}. JSON only.` }],
        temperature: 0.95,
        maxTokens: 600,
        jsonMode: true,
      });
      const parsed = tryParseJson(r.text);
      res.json({ variations: parsed?.variations || [] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Campaigns CRUD ───────────────────────────────────────────────────────
  app.get("/api/admin/ads/campaigns", requireAdmin, async (_req, res) => {
    const rows = await db.select().from(adCampaigns).orderBy(desc(adCampaigns.createdAt));
    res.json(rows);
  });

  app.post("/api/admin/ads/campaigns", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const data = insertAdCampaignSchema.parse({
        ...req.body,
        createdBy: userId ?? null,
        utmCampaign: req.body?.utmCampaign || slug(req.body?.name || "campaign"),
      });
      const [row] = await db.insert(adCampaigns).values(data).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Invalid campaign" });
    }
  });

  app.patch("/api/admin/ads/campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const patch: any = { ...req.body, updatedAt: new Date() };
    if (patch.status === "live" && !patch.launchedAt) patch.launchedAt = new Date();
    if (patch.status === "ended" && !patch.endedAt) patch.endedAt = new Date();
    const [row] = await db.update(adCampaigns).set(patch).where(eq(adCampaigns.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  app.delete("/api/admin/ads/campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await db.delete(adCampaigns).where(eq(adCampaigns.id, id));
    res.json({ success: true });
  });

  // ── Spend logs ───────────────────────────────────────────────────────────
  app.post("/api/admin/ads/campaigns/:id/spend", requireAdmin, async (req: Request, res: Response) => {
    try {
      const campaignId = Number(req.params.id);
      const data = insertAdSpendLogSchema.parse({ ...req.body, campaignId });
      const [row] = await db.insert(adSpendLogs).values(data).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/admin/ads/campaigns/:id/spend", requireAdmin, async (req: Request, res: Response) => {
    const campaignId = Number(req.params.id);
    const rows = await db.select().from(adSpendLogs)
      .where(eq(adSpendLogs.campaignId, campaignId))
      .orderBy(desc(adSpendLogs.date));
    res.json(rows);
  });

  // ── Unified analytics ────────────────────────────────────────────────────
  app.get("/api/admin/ads/analytics", requireAdmin, async (req: Request, res: Response) => {
    const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400000);

    const campaigns = await db.select().from(adCampaigns);

    const spendByCampaign = await db
      .select({
        campaignId: adSpendLogs.campaignId,
        spendCents: sql<number>`COALESCE(SUM(${adSpendLogs.amountCents}),0)::int`,
        impressions: sql<number>`COALESCE(SUM(${adSpendLogs.impressions}),0)::int`,
        clicks: sql<number>`COALESCE(SUM(${adSpendLogs.clicks}),0)::int`,
      })
      .from(adSpendLogs)
      .where(gte(adSpendLogs.createdAt, since))
      .groupBy(adSpendLogs.campaignId);

    const conversionsByCampaign = await db
      .select({
        utmCampaign: adAttributions.utmCampaign,
        conversions: sql<number>`COUNT(${adAttributions.convertedAt})::int`,
        landings: sql<number>`COUNT(*)::int`,
      })
      .from(adAttributions)
      .where(gte(adAttributions.landedAt, since))
      .groupBy(adAttributions.utmCampaign);

    const convMap = new Map(conversionsByCampaign.map(c => [c.utmCampaign, c]));
    const spendMap = new Map(spendByCampaign.map(s => [s.campaignId, s]));

    const perCampaign = campaigns.map(c => {
      const s = spendMap.get(c.id);
      const cv = convMap.get(c.utmCampaign);
      const spendCents = s?.spendCents || 0;
      const conversions = cv?.conversions || 0;
      return {
        id: c.id,
        name: c.name,
        platform: c.platform,
        status: c.status,
        utmCampaign: c.utmCampaign,
        spendEur: spendCents / 100,
        impressions: s?.impressions || 0,
        clicks: s?.clicks || 0,
        landings: cv?.landings || 0,
        signups: conversions,
        costPerSignup: conversions > 0 ? Number((spendCents / 100 / conversions).toFixed(2)) : null,
        ctr: s?.impressions ? Number(((s.clicks / s.impressions) * 100).toFixed(2)) : null,
      };
    });

    const totals = perCampaign.reduce((acc, x) => ({
      spendEur: acc.spendEur + x.spendEur,
      impressions: acc.impressions + x.impressions,
      clicks: acc.clicks + x.clicks,
      landings: acc.landings + x.landings,
      signups: acc.signups + x.signups,
    }), { spendEur: 0, impressions: 0, clicks: 0, landings: 0, signups: 0 });

    const byPlatform: Record<string, any> = {};
    for (const c of perCampaign) {
      const p = byPlatform[c.platform] ??= { spendEur: 0, signups: 0, clicks: 0, impressions: 0 };
      p.spendEur += c.spendEur; p.signups += c.signups; p.clicks += c.clicks; p.impressions += c.impressions;
    }
    Object.keys(byPlatform).forEach(p => {
      const v = byPlatform[p];
      v.costPerSignup = v.signups > 0 ? Number((v.spendEur / v.signups).toFixed(2)) : null;
    });

    res.json({
      periodDays: days,
      totals: {
        ...totals,
        costPerSignup: totals.signups > 0 ? Number((totals.spendEur / totals.signups).toFixed(2)) : null,
      },
      byPlatform,
      campaigns: perCampaign,
    });
  });

  // ── AI insights / recommendations ────────────────────────────────────────
  app.post("/api/admin/ads/insights", requireAdmin, async (req: Request, res: Response) => {
    try {
      const days = Math.max(3, Math.min(90, Number(req.body?.days) || 7));
      // Re-use analytics
      const analyticsResp = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/api/admin/ads/analytics?days=${days}`, {
        headers: { cookie: req.headers.cookie || "", authorization: req.headers.authorization || "" },
      }).catch(() => null);
      const analytics = analyticsResp ? await analyticsResp.json() : null;

      const system = `You are a no-fluff performance-marketing analyst. Read the data and give 3-6 specific, actionable recommendations. Always respond in STRICT JSON: {"summary":"2-3 sentence plain-English overview","recommendations":[{"action":"do X","platform":"google|meta|...|all","reason":"why","priority":"high|medium|low"}]}.`;
      const r = await aiChat({
        role: "content",
        system,
        messages: [{ role: "user", content: `Period: last ${days} days. Data:\n${JSON.stringify(analytics)}\n\nIf there's no data yet, give 3 starter recommendations on which channel to test first for an urban-culture community app on a tight (€500/mo) budget. JSON only.` }],
        temperature: 0.5,
        maxTokens: 800,
        jsonMode: true,
      });
      const parsed = tryParseJson(r.text) || { summary: "No insights available.", recommendations: [] };

      const [row] = await db.insert(adInsights).values({
        periodDays: days,
        summary: parsed.summary,
        recommendations: parsed.recommendations,
        kpis: analytics?.totals,
      }).returning();
      res.json({ ...row, byPlatform: analytics?.byPlatform });
    } catch (err: any) {
      console.error("[ads/insights]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/ads/insights/latest", requireAdmin, async (_req, res) => {
    const [row] = await db.select().from(adInsights).orderBy(desc(adInsights.generatedAt)).limit(1);
    res.json(row || null);
  });

  // ── Public tracking (no admin required) ──────────────────────────────────
  app.post("/api/track/landing", async (req: Request, res: Response) => {
    try {
      const { sessionId, utm = {}, referrer, landingPath } = req.body ?? {};
      if (!sessionId) return res.status(400).json({ error: "sessionId required" });
      // De-dupe: only one landing row per session per campaign
      const existing = await db.select({ id: adAttributions.id }).from(adAttributions)
        .where(and(eq(adAttributions.sessionId, sessionId), eq(adAttributions.utmCampaign, utm.campaign || "")))
        .limit(1);
      if (existing.length) return res.json({ ok: true, id: existing[0].id, deduped: true });
      const [row] = await db.insert(adAttributions).values({
        sessionId,
        utmSource: utm.source || null,
        utmMedium: utm.medium || null,
        utmCampaign: utm.campaign || null,
        utmContent: utm.content || null,
        utmTerm: utm.term || null,
        referrer: referrer || null,
        landingPath: landingPath || null,
      }).returning();
      res.json({ ok: true, id: row.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/track/conversion", async (req: Request, res: Response) => {
    try {
      const { sessionId, userId, conversionType = "signup" } = req.body ?? {};
      if (!sessionId) return res.status(400).json({ error: "sessionId required" });
      await db.update(adAttributions)
        .set({ convertedAt: new Date(), conversionType, userId: userId || null })
        .where(and(eq(adAttributions.sessionId, sessionId), sql`${adAttributions.convertedAt} IS NULL`));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
