/**
 * Admin endpoints for the AI Control Panel.
 *  GET    /api/admin/ai/config         — current config + role catalogue + available models
 *  PATCH  /api/admin/ai/config         — update one or more role assignments
 *  GET    /api/admin/ai/usage          — usage stats (per-role calls, failures, fallback hits, latency)
 *  POST   /api/admin/ai/usage/reset    — reset usage counters
 *  POST   /api/admin/ai/smart-routing  — toggle global smart-routing flag
 *  POST   /api/admin/ai/test           — quick test prompt for any role
 */

import { type Express, type Request, type Response } from "express";
import {
  aiChat,
  getRoleConfig,
  setRoleConfig,
  getSmartRouting,
  setSmartRouting,
  getUsageStats,
  resetUsageStats,
  getCacheConfig,
  setCacheConfig,
  clearResponseCache,
  getCacheSize,
  getImageConfig,
  setImageConfig,
  AVAILABLE_MODELS,
  AVAILABLE_IMAGE_MODELS,
  MODEL_PRICING,
  ROLE_CATALOGUE,
  type AIRole,
  type AIProvider,
  type RoleConfig,
} from "./aiRouter";
import { verifyFirebaseToken } from "./firebase";

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const allowed = ["admin", "super_admin"];
  if (allowed.includes((req as any).user?.role)) return true;
  if (allowed.includes((req.session as any)?.userRole)) return true;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const decoded = await verifyFirebaseToken(auth.slice(7));
      if (decoded && allowed.includes((decoded as any).role)) return true;
    } catch {}
  }
  res.status(403).json({ error: "Admin access required" });
  return false;
}

const VALID_ROLES = new Set(ROLE_CATALOGUE.map(r => r.id as string));
const VALID_PROVIDERS: AIProvider[] = ["openai", "anthropic"];

function validateRoleConfig(cfg: any): RoleConfig | null {
  if (!cfg || typeof cfg !== "object") return null;
  if (!VALID_PROVIDERS.includes(cfg.provider)) return null;
  if (typeof cfg.model !== "string" || !cfg.model.length) return null;
  const out: RoleConfig = { provider: cfg.provider, model: cfg.model };
  if (cfg.fallbackProvider && VALID_PROVIDERS.includes(cfg.fallbackProvider)) out.fallbackProvider = cfg.fallbackProvider;
  if (cfg.fallbackModel && typeof cfg.fallbackModel === "string") out.fallbackModel = cfg.fallbackModel;
  if (typeof cfg.temperature === "number") out.temperature = cfg.temperature;
  if (typeof cfg.maxTokens === "number") out.maxTokens = cfg.maxTokens;
  return out;
}

export function registerAIControlRoutes(app: Express) {
  app.get("/api/admin/ai/config", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const [config, smartRouting, cache, imageConfig] = await Promise.all([
      getRoleConfig(),
      getSmartRouting(),
      getCacheConfig(),
      getImageConfig(),
    ]);
    res.json({
      config,
      smartRouting,
      cache,
      cacheSize: getCacheSize(),
      roles: ROLE_CATALOGUE,
      providers: [
        { id: "openai", label: "OpenAI" },
        { id: "anthropic", label: "Anthropic (Claude)" },
      ],
      availableModels: AVAILABLE_MODELS,
      availableImageModels: AVAILABLE_IMAGE_MODELS,
      imageConfig,
      pricing: MODEL_PRICING,
    });
  });

  // Update the image-generation model used by LinkedIn auto-post (and any image flow that calls resolveImageParams)
  app.post("/api/admin/ai/image-config", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { model, size, quality } = req.body || {};
    if (!model || typeof model !== "string") return res.status(400).json({ error: "model is required" });
    const validIds = AVAILABLE_IMAGE_MODELS.map(m => m.id);
    if (!validIds.includes(model)) return res.status(400).json({ error: `Unknown image model. Allowed: ${validIds.join(", ")}` });
    if (size !== undefined && typeof size !== "string") return res.status(400).json({ error: "size must be a string" });
    if (quality !== undefined && typeof quality !== "string") return res.status(400).json({ error: "quality must be a string" });
    try {
      // setImageConfig validates size/quality against the chosen model and 400s on invalid combos.
      const updates: Partial<{ model: string; size: string; quality: string }> = { model };
      if (typeof size === "string") updates.size = size;
      if (typeof quality === "string") updates.quality = quality;
      const next = await setImageConfig(updates);
      res.json({ ok: true, imageConfig: next });
    } catch (err: any) {
      const msg = err?.message || "Failed to update image config";
      // Validation errors from setImageConfig are user-fixable → 400, not 500.
      const isValidation = /not allowed for|Unknown image model/i.test(msg);
      res.status(isValidation ? 400 : 500).json({ error: msg });
    }
  });

  app.post("/api/admin/ai/cache", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { enabled, ttlSeconds, maxEntries, perRole } = req.body || {};
    const updates: any = {};
    if (typeof enabled === "boolean") updates.enabled = enabled;
    if (typeof ttlSeconds === "number" && ttlSeconds > 0) updates.ttlSeconds = Math.min(ttlSeconds, 86_400);
    if (typeof maxEntries === "number" && maxEntries > 0) updates.maxEntries = Math.min(maxEntries, 10_000);
    if (perRole && typeof perRole === "object") updates.perRole = perRole;
    const next = await setCacheConfig(updates);
    res.json({ ok: true, cache: next });
  });

  app.post("/api/admin/ai/cache/clear", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const cleared = clearResponseCache();
    res.json({ ok: true, cleared });
  });

  app.patch("/api/admin/ai/config", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const updates = req.body?.config;
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Body must be { config: { roleId: { provider, model, ... } } }" });
    }
    const cleaned: Partial<Record<AIRole, RoleConfig>> = {};
    for (const [roleId, raw] of Object.entries(updates)) {
      if (!VALID_ROLES.has(roleId)) continue;
      const valid = validateRoleConfig(raw);
      if (valid) cleaned[roleId as AIRole] = valid;
    }
    if (!Object.keys(cleaned).length) {
      return res.status(400).json({ error: "No valid role updates supplied" });
    }
    const next = await setRoleConfig(cleaned);
    res.json({ ok: true, config: next });
  });

  app.post("/api/admin/ai/smart-routing", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const enabled = !!req.body?.enabled;
    const value = await setSmartRouting(enabled);
    res.json({ ok: true, smartRouting: value });
  });

  app.get("/api/admin/ai/usage", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const stats = await getUsageStats();
    // Compute averages
    const enriched: Record<string, any> = {};
    let totalCost = 0, totalCalls = 0, totalCacheHits = 0, totalTokensIn = 0, totalTokensOut = 0;
    for (const [role, s] of Object.entries(stats.byRole)) {
      enriched[role] = {
        ...s,
        avgLatencyMs: s.calls > 0 ? Math.round(s.totalLatencyMs / s.calls) : 0,
        successRate: s.calls > 0 ? Math.round(((s.calls - s.failures) / s.calls) * 100) : 100,
        cacheHitRate: s.calls > 0 ? Math.round((s.cacheHits / s.calls) * 100) : 0,
        estimatedCostUsd: Number((s.estimatedCostUsd ?? 0).toFixed(4)),
      };
      totalCost += s.estimatedCostUsd ?? 0;
      totalCalls += s.calls;
      totalCacheHits += s.cacheHits;
      totalTokensIn += s.inputTokens ?? 0;
      totalTokensOut += s.outputTokens ?? 0;
    }
    res.json({
      byRole: enriched,
      updatedAt: stats.updatedAt,
      totals: {
        calls: totalCalls,
        cacheHits: totalCacheHits,
        cacheHitRate: totalCalls > 0 ? Math.round((totalCacheHits / totalCalls) * 100) : 0,
        inputTokens: totalTokensIn,
        outputTokens: totalTokensOut,
        estimatedCostUsd: Number(totalCost.toFixed(4)),
      },
    });
  });

  app.post("/api/admin/ai/usage/reset", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    await resetUsageStats();
    res.json({ ok: true });
  });

  app.post("/api/admin/ai/test", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const { role, prompt } = req.body || {};
    if (!VALID_ROLES.has(role)) return res.status(400).json({ error: "Invalid role" });
    if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "prompt is required" });
    try {
      const result = await aiChat({
        role: role as AIRole,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 400,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || "AI call failed" });
    }
  });
}
