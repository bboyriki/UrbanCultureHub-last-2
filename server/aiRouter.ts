/**
 * Central AI Router — single entry point for every text/chat AI call across the app.
 *
 * Design goals:
 *  - One function (`aiChat`) replaces direct OpenAI/Anthropic SDK calls.
 *  - Per-role model assignment, configurable from the admin panel at runtime.
 *  - Automatic fallback to a second provider/model on failure (smart routing).
 *  - Usage tracking (calls, failures, fallback hits, latency) persisted in `app_settings`.
 *  - Tone/personality consistency via shared system-prompt prefix.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

// ───────────── Types ─────────────
export type AIProvider = "openai" | "anthropic";

export type AIRole =
  | "finder"
  | "community"
  | "admin_assistant"
  | "content"
  | "map"
  | "instagram"
  | "events"
  | "btts"
  | "marketplace"
  | "linkedin"
  | "spot_description"
  | "urban_ai"
  | "default";

export interface RoleConfig {
  provider: AIProvider;
  model: string;
  fallbackProvider?: AIProvider;
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatOptions {
  role: AIRole;
  system?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Override the configured model just for this single call. */
  overrideModel?: string;
  overrideProvider?: AIProvider;
}

export interface AIChatResult {
  text: string;
  provider: AIProvider;
  model: string;
  usedFallback: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

// ───────────── Available models (admin UI uses this) ─────────────
export const AVAILABLE_MODELS: Record<AIProvider, { id: string; label: string; tier: "fast" | "balanced" | "powerful" }[]> = {
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini (fast, cheap)", tier: "fast" },
    { id: "gpt-4o",      label: "GPT-4o (balanced)",         tier: "balanced" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo (powerful)",    tier: "powerful" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5 (fast, cheap)",   tier: "fast" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)",     tier: "balanced" },
    { id: "claude-opus-4-5",   label: "Claude Opus 4.5 (powerful)",       tier: "powerful" },
    { id: "claude-opus-4-6",   label: "Claude Opus 4.6 (most powerful)",  tier: "powerful" },
  ],
};

// ───────────── Image generation models (admin UI uses this) ─────────────
export interface ImageModelMeta {
  id: string;
  label: string;
  provider: AIProvider;
  tier: "fast" | "balanced" | "powerful";
  defaultSize: string;
  defaultQuality: string;
  pricePerImageUsd: number;
  description: string;
  allowedSizes: string[];
  allowedQualities: string[];
}

export const AVAILABLE_IMAGE_MODELS: ImageModelMeta[] = [
  { id: "gpt-image-1", label: "GPT Image 1 (highest quality)", provider: "openai", tier: "powerful", defaultSize: "1536x1024", defaultQuality: "high",     pricePerImageUsd: 0.190, description: "OpenAI's newest image model. Best photorealism + text rendering. Slowest + priciest.", allowedSizes: ["1024x1024", "1024x1536", "1536x1024"], allowedQualities: ["low", "medium", "high", "auto"] },
  { id: "dall-e-3",   label: "DALL·E 3 (balanced)",            provider: "openai", tier: "balanced", defaultSize: "1792x1024", defaultQuality: "hd",       pricePerImageUsd: 0.080, description: "Strong creative output, faster than GPT Image 1, supports landscape format.",          allowedSizes: ["1024x1024", "1024x1792", "1792x1024"], allowedQualities: ["standard", "hd"] },
  { id: "dall-e-2",   label: "DALL·E 2 (cheapest, fastest)",    provider: "openai", tier: "fast",     defaultSize: "1024x1024", defaultQuality: "standard", pricePerImageUsd: 0.020, description: "Cheapest option. Square only. Use when cost matters more than quality.",                allowedSizes: ["256x256", "512x512", "1024x1024"], allowedQualities: ["standard"] },
];

export interface ImageConfig {
  model: string;
  size?: string;
  quality?: string;
}

const DEFAULT_IMAGE_CONFIG: ImageConfig = { model: "gpt-image-1" };

// Approx pricing per 1M tokens (USD). Used to surface cost in the admin panel.
// Update these whenever providers change pricing.
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o-mini": { input: 0.15,  output: 0.60 },
  "gpt-4o":      { input: 2.50,  output: 10.00 },
  "gpt-4-turbo": { input: 10.00, output: 30.00 },
  // Anthropic
  "claude-haiku-4-5":  { input: 1.00,  output: 5.00 },
  "claude-sonnet-4-6": { input: 3.00,  output: 15.00 },
  "claude-opus-4-5":   { input: 15.00, output: 75.00 },
  "claude-opus-4-6":   { input: 15.00, output: 75.00 },
};

function estimateCost(model: string, inputTokens?: number, outputTokens?: number): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  const inCost  = ((inputTokens  ?? 0) / 1_000_000) * p.input;
  const outCost = ((outputTokens ?? 0) / 1_000_000) * p.output;
  return inCost + outCost;
}

// ───────────── Role catalogue (admin UI metadata) ─────────────
export const ROLE_CATALOGUE: { id: AIRole; label: string; description: string; recommendedTier: "fast" | "balanced" | "powerful" }[] = [
  { id: "finder",           label: "AI Finder",            description: "Quick spot/event discovery — needs speed and accuracy.",          recommendedTier: "fast" },
  { id: "community",        label: "Community AI",         description: "Engagement, replies, tone-aware social interactions.",            recommendedTier: "balanced" },
  { id: "admin_assistant",  label: "Admin Assistant",      description: "Internal tool with code/file access — needs reasoning power.",   recommendedTier: "powerful" },
  { id: "content",          label: "Content Creation",     description: "Posts, captions, longer-form writing — creativity matters.",     recommendedTier: "balanced" },
  { id: "map",              label: "Map AI",               description: "Location reasoning, neighborhood context, spot relevance.",      recommendedTier: "fast" },
  { id: "instagram",        label: "Instagram AI",         description: "Persona, replies, captions for IG automation.",                  recommendedTier: "balanced" },
  { id: "events",           label: "Event Recommendations", description: "Match events to user interests and history.",                    recommendedTier: "balanced" },
  { id: "btts",             label: "Back-to-the-Street AI", description: "Battle/program AI — analytical and conversational.",            recommendedTier: "balanced" },
  { id: "marketplace",      label: "Marketplace AI",       description: "Listing helpers, pricing tips, descriptions.",                   recommendedTier: "balanced" },
  { id: "linkedin",         label: "LinkedIn AI",          description: "Professional tone post generation.",                              recommendedTier: "balanced" },
  { id: "spot_description", label: "Spot Descriptions",    description: "Bulk auto-description of street-culture spots.",                  recommendedTier: "fast" },
  { id: "urban_ai",         label: "Urban AI (Main App)",   description: "The public /ai-assistant chat — the AI tab users tap in the bottom nav. Swap Claude ↔ GPT here.", recommendedTier: "powerful" },
  { id: "default",          label: "Default fallback",     description: "Used by any AI feature not yet assigned its own role.",          recommendedTier: "balanced" },
];

// ───────────── Defaults ─────────────
const DEFAULT_CONFIG: Record<AIRole, RoleConfig> = {
  finder:           { provider: "anthropic", model: "claude-haiku-4-5",  fallbackProvider: "openai",    fallbackModel: "gpt-4o-mini" },
  community:        { provider: "anthropic", model: "claude-sonnet-4-6", fallbackProvider: "openai",    fallbackModel: "gpt-4o" },
  admin_assistant:  { provider: "anthropic", model: "claude-sonnet-4-6", fallbackProvider: "openai",    fallbackModel: "gpt-4o" },
  content:          { provider: "openai",    model: "gpt-4o",            fallbackProvider: "anthropic", fallbackModel: "claude-sonnet-4-6" },
  map:              { provider: "anthropic", model: "claude-haiku-4-5",  fallbackProvider: "openai",    fallbackModel: "gpt-4o-mini" },
  instagram:        { provider: "anthropic", model: "claude-sonnet-4-6", fallbackProvider: "openai",    fallbackModel: "gpt-4o" },
  events:           { provider: "anthropic", model: "claude-sonnet-4-6", fallbackProvider: "openai",    fallbackModel: "gpt-4o" },
  btts:             { provider: "anthropic", model: "claude-sonnet-4-6", fallbackProvider: "openai",    fallbackModel: "gpt-4o" },
  marketplace:      { provider: "openai",    model: "gpt-4o",            fallbackProvider: "anthropic", fallbackModel: "claude-sonnet-4-6" },
  linkedin:         { provider: "openai",    model: "gpt-4o",            fallbackProvider: "anthropic", fallbackModel: "claude-sonnet-4-6" },
  spot_description: { provider: "openai",    model: "gpt-4o-mini",       fallbackProvider: "anthropic", fallbackModel: "claude-haiku-4-5" },
  urban_ai:         { provider: "anthropic", model: "claude-opus-4-5",   fallbackProvider: "openai",    fallbackModel: "gpt-4o", maxTokens: 1500 },
  default:          { provider: "anthropic", model: "claude-sonnet-4-6", fallbackProvider: "openai",    fallbackModel: "gpt-4o" },
};

// Shared personality prefix — keeps tone consistent across providers and models.
export const SHARED_PERSONALITY = `You are the Urban Culture Hub assistant — knowledgeable about street culture, dance, hip-hop, urban sports, music, and Dutch city life. Be warm, concise, and culturally aware. Never invent facts. If you do not know something, say so plainly.`;

// ───────────── Config + stats persistence (in-memory cache + DB write-through) ─────────────
const CONFIG_KEY = "ai_role_config";
const ROUTING_KEY = "ai_smart_routing";
const STATS_KEY = "ai_usage_stats";
const CACHE_CONFIG_KEY = "ai_response_cache_config";
const IMAGE_CONFIG_KEY = "ai_image_config";

interface UsageStats {
  byRole: Record<string, {
    calls: number;
    failures: number;
    fallbackHits: number;
    cacheHits: number;
    totalLatencyMs: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    lastUsedAt: string;
    lastError?: string;
  }>;
  updatedAt: string;
}

export interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  maxEntries: number;
  /** Per-role override: true=force on, false=force off, undefined=use global. */
  perRole: Partial<Record<AIRole, boolean>>;
}

let configCache: Record<AIRole, RoleConfig> | null = null;
let smartRoutingCache: boolean | null = null;
let statsCache: UsageStats | null = null;
let cacheConfig: CacheConfig | null = null;
let lastStatsFlush = 0;
const STATS_FLUSH_MS = 15_000;

// In-memory LRU response cache.
const responseCache = new Map<string, { result: AIChatResult; expiresAt: number }>();

async function readSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function writeSetting(key: string, value: string, label: string, description?: string) {
  const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (existing) {
    await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({ key, value, label, description: description ?? null });
  }
}

export async function getRoleConfig(): Promise<Record<AIRole, RoleConfig>> {
  if (configCache) return configCache;
  const raw = await readSetting(CONFIG_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      configCache = { ...DEFAULT_CONFIG, ...parsed };
      return configCache!;
    } catch {}
  }
  configCache = { ...DEFAULT_CONFIG };
  return configCache;
}

export async function setRoleConfig(updates: Partial<Record<AIRole, RoleConfig>>): Promise<Record<AIRole, RoleConfig>> {
  const current = await getRoleConfig();
  const next = { ...current, ...updates };
  configCache = next;
  await writeSetting(CONFIG_KEY, JSON.stringify(next), "AI role → provider/model mapping", "Per-feature AI provider & model assignments managed via /admin/ai-control");
  return next;
}

export async function getSmartRouting(): Promise<boolean> {
  if (smartRoutingCache !== null) return smartRoutingCache;
  const raw = await readSetting(ROUTING_KEY);
  smartRoutingCache = raw === "true" || raw === null; // default ON
  return smartRoutingCache;
}

export async function setSmartRouting(enabled: boolean): Promise<boolean> {
  smartRoutingCache = enabled;
  await writeSetting(ROUTING_KEY, enabled ? "true" : "false", "AI Smart Routing", "When ON, failed AI calls automatically fall back to the configured backup provider/model.");
  return enabled;
}

function emptyRoleSlot() {
  return { calls: 0, failures: 0, fallbackHits: 0, cacheHits: 0, totalLatencyMs: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, lastUsedAt: new Date().toISOString() };
}

async function loadStats(): Promise<UsageStats> {
  if (statsCache) return statsCache;
  const raw = await readSetting(STATS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // Migrate older rows that lack new fields.
      for (const k of Object.keys(parsed.byRole ?? {})) {
        parsed.byRole[k] = { ...emptyRoleSlot(), ...parsed.byRole[k] };
      }
      statsCache = parsed;
      return statsCache!;
    } catch {}
  }
  statsCache = { byRole: {}, updatedAt: new Date().toISOString() };
  return statsCache;
}

export async function getUsageStats(): Promise<UsageStats> {
  return loadStats();
}

export async function resetUsageStats(): Promise<void> {
  statsCache = { byRole: {}, updatedAt: new Date().toISOString() };
  await writeSetting(STATS_KEY, JSON.stringify(statsCache), "AI Usage Stats", "Per-role call counts, failures, fallback hits, latency.");
}

function recordUsage(role: AIRole, latencyMs: number, model: string, opts: { failed?: boolean; fallback?: boolean; cacheHit?: boolean; error?: string; inputTokens?: number; outputTokens?: number }) {
  if (!statsCache) {
    loadStats().catch(() => {});
    statsCache = statsCache ?? { byRole: {}, updatedAt: new Date().toISOString() };
  }
  const slot = statsCache.byRole[role] ?? emptyRoleSlot();
  slot.calls += 1;
  slot.totalLatencyMs += latencyMs;
  slot.lastUsedAt = new Date().toISOString();
  if (opts.failed) slot.failures += 1;
  if (opts.fallback) slot.fallbackHits += 1;
  if (opts.cacheHit) slot.cacheHits += 1;
  if (opts.inputTokens) slot.inputTokens += opts.inputTokens;
  if (opts.outputTokens) slot.outputTokens += opts.outputTokens;
  if (!opts.cacheHit) slot.estimatedCostUsd += estimateCost(model, opts.inputTokens, opts.outputTokens);
  if (opts.error) slot.lastError = String(opts.error).slice(0, 500);
  statsCache.byRole[role] = slot;
  statsCache.updatedAt = new Date().toISOString();
  if (Date.now() - lastStatsFlush > STATS_FLUSH_MS) {
    lastStatsFlush = Date.now();
    writeSetting(STATS_KEY, JSON.stringify(statsCache), "AI Usage Stats", "Per-role call counts, failures, fallback hits, cache, tokens, cost.").catch(() => {});
  }
}

// ───────────── Cache config + helpers ─────────────
const DEFAULT_CACHE: CacheConfig = { enabled: false, ttlSeconds: 300, maxEntries: 500, perRole: {} };

export async function getCacheConfig(): Promise<CacheConfig> {
  if (cacheConfig) return cacheConfig;
  const raw = await readSetting(CACHE_CONFIG_KEY);
  if (raw) {
    try { cacheConfig = { ...DEFAULT_CACHE, ...JSON.parse(raw) }; return cacheConfig!; } catch {}
  }
  cacheConfig = { ...DEFAULT_CACHE };
  return cacheConfig;
}

export async function setCacheConfig(updates: Partial<CacheConfig>): Promise<CacheConfig> {
  const current = await getCacheConfig();
  cacheConfig = { ...current, ...updates, perRole: { ...current.perRole, ...(updates.perRole ?? {}) } };
  await writeSetting(CACHE_CONFIG_KEY, JSON.stringify(cacheConfig), "AI Response Cache", "Per-role response caching configuration.");
  return cacheConfig;
}

// ───────────── Image config ─────────────
let imageConfigCache: ImageConfig | null = null;

export async function getImageConfig(): Promise<ImageConfig> {
  if (imageConfigCache) return imageConfigCache;
  const raw = await readSetting(IMAGE_CONFIG_KEY);
  if (raw) {
    try { imageConfigCache = { ...DEFAULT_IMAGE_CONFIG, ...JSON.parse(raw) }; return imageConfigCache!; } catch {}
  }
  imageConfigCache = { ...DEFAULT_IMAGE_CONFIG };
  return imageConfigCache;
}

export async function setImageConfig(updates: Partial<ImageConfig>): Promise<ImageConfig> {
  const current = await getImageConfig();
  const modelChanged = updates.model !== undefined && updates.model !== current.model;
  const next: ImageConfig = { ...current, ...updates };

  const meta = AVAILABLE_IMAGE_MODELS.find(m => m.id === next.model);
  if (!meta) throw new Error(`Unknown image model: ${next.model}`);

  // If the model changed, snap size/quality to defaults whenever the caller didn't
  // explicitly send valid values for the new model. Prevents persisting illegal combos.
  if (modelChanged) {
    if (!next.size || !meta.allowedSizes.includes(next.size)) next.size = meta.defaultSize;
    if (!next.quality || !meta.allowedQualities.includes(next.quality)) next.quality = meta.defaultQuality;
  } else {
    // Same model: any provided size/quality must be in that model's allow-list.
    if (next.size && !meta.allowedSizes.includes(next.size)) {
      throw new Error(`Size "${next.size}" not allowed for ${meta.id}. Allowed: ${meta.allowedSizes.join(", ")}`);
    }
    if (next.quality && !meta.allowedQualities.includes(next.quality)) {
      throw new Error(`Quality "${next.quality}" not allowed for ${meta.id}. Allowed: ${meta.allowedQualities.join(", ")}`);
    }
  }

  imageConfigCache = next;
  await writeSetting(IMAGE_CONFIG_KEY, JSON.stringify(next), "AI Image Generation Model", "Model used by LinkedIn auto-post and any image-generating feature. Configurable via /admin/ai-control.");
  return next;
}

/** Resolve effective image params (filling in defaults for the chosen model). */
export async function resolveImageParams(): Promise<{ model: string; size: string; quality: string }> {
  const cfg = await getImageConfig();
  const meta = AVAILABLE_IMAGE_MODELS.find(m => m.id === cfg.model) || AVAILABLE_IMAGE_MODELS[0];
  return {
    model: meta.id,
    size: cfg.size || meta.defaultSize,
    quality: cfg.quality || meta.defaultQuality,
  };
}

export function clearResponseCache(): number {
  const n = responseCache.size;
  responseCache.clear();
  return n;
}

function cacheKeyFor(role: AIRole, opts: AIChatOptions, provider: AIProvider, model: string): string {
  const payload = { role, provider, model, system: opts.system ?? "", messages: opts.messages, temperature: opts.temperature, maxTokens: opts.maxTokens, jsonMode: !!opts.jsonMode };
  return JSON.stringify(payload);
}

function isCacheableForRole(role: AIRole, cfg: CacheConfig): boolean {
  const override = cfg.perRole[role];
  if (typeof override === "boolean") return override;
  return cfg.enabled;
}

function pruneCacheIfNeeded(maxEntries: number) {
  if (responseCache.size <= maxEntries) return;
  // LRU-ish: drop oldest insertion order entries.
  const dropCount = responseCache.size - maxEntries;
  let i = 0;
  for (const k of responseCache.keys()) {
    if (i++ >= dropCount) break;
    responseCache.delete(k);
  }
}

// ───────────── Provider clients ─────────────
let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;

function openai(): OpenAI {
  if (_openai) return _openai;
  _openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "missing",
    ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
  });
  return _openai;
}

function anthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  _anthropic = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    ...(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL } : {}),
  });
  return _anthropic;
}

// ───────────── Provider call adapters ─────────────
async function callOpenAI(opts: { model: string; system?: string; messages: AIMessage[]; temperature?: number; maxTokens?: number; jsonMode?: boolean; }): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const completion = await openai().chat.completions.create({
    model: opts.model,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      ...opts.messages.map(m => ({ role: m.role, content: m.content })),
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });
  const text = completion.choices[0]?.message?.content || "";
  return { text, inputTokens: completion.usage?.prompt_tokens, outputTokens: completion.usage?.completion_tokens };
}

async function callAnthropic(opts: { model: string; system?: string; messages: AIMessage[]; temperature?: number; maxTokens?: number; jsonMode?: boolean; }): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  // Anthropic has no native JSON mode — we enforce it via system prompt + post-processing.
  const sys = opts.jsonMode
    ? `${opts.system ?? ""}\n\nIMPORTANT: Respond with a single valid JSON object only. No prose, no markdown fences, no explanation — just the JSON.`
    : opts.system;
  const resp = await anthropic().messages.create({
    model: opts.model,
    system: sys,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    messages: opts.messages.map(m => ({ role: m.role, content: m.content })),
  });
  let text = resp.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
  if (opts.jsonMode) {
    // Strip optional ```json fences and isolate the first JSON object/array.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();
    const first = text.search(/[\[{]/);
    const last = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
  }
  return { text, inputTokens: (resp as any).usage?.input_tokens, outputTokens: (resp as any).usage?.output_tokens };
}

async function callProvider(provider: AIProvider, model: string, opts: AIChatOptions): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  if (provider === "openai") {
    return callOpenAI({ model, system: opts.system, messages: opts.messages, temperature: opts.temperature, maxTokens: opts.maxTokens, jsonMode: opts.jsonMode });
  }
  return callAnthropic({ model, system: opts.system, messages: opts.messages, temperature: opts.temperature, maxTokens: opts.maxTokens, jsonMode: opts.jsonMode });
}

// ───────────── Public chat entry point ─────────────
export async function aiChat(opts: AIChatOptions): Promise<AIChatResult> {
  if (!statsCache) await loadStats();
  const config = await getRoleConfig();
  const cfg = config[opts.role] ?? config.default ?? DEFAULT_CONFIG.default;
  const smart = await getSmartRouting();
  const cacheCfg = await getCacheConfig();

  const provider = opts.overrideProvider ?? cfg.provider;
  const model = opts.overrideModel ?? cfg.model;
  const finalSystem = opts.system ? `${SHARED_PERSONALITY}\n\n${opts.system}` : SHARED_PERSONALITY;
  const callOpts: AIChatOptions = { ...opts, system: finalSystem, temperature: opts.temperature ?? cfg.temperature, maxTokens: opts.maxTokens ?? cfg.maxTokens };

  // Cache check (skip when JSON mode is OFF and temperature > 0.7 — those calls are non-deterministic by intent)
  const cacheable = isCacheableForRole(opts.role, cacheCfg);
  const key = cacheable ? cacheKeyFor(opts.role, callOpts, provider, model) : "";
  if (cacheable && key) {
    const hit = responseCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      recordUsage(opts.role, 0, model, { cacheHit: true });
      return { ...hit.result, latencyMs: 0 };
    }
    if (hit) responseCache.delete(key);
  }

  const startedAt = Date.now();
  try {
    const { text, inputTokens, outputTokens } = await callProvider(provider, model, callOpts);
    const latencyMs = Date.now() - startedAt;
    recordUsage(opts.role, latencyMs, model, { inputTokens, outputTokens });
    const result: AIChatResult = { text, provider, model, usedFallback: false, latencyMs, inputTokens, outputTokens };
    if (cacheable && key) {
      responseCache.set(key, { result, expiresAt: Date.now() + cacheCfg.ttlSeconds * 1000 });
      pruneCacheIfNeeded(cacheCfg.maxEntries);
    }
    return result;
  } catch (err: any) {
    const latencyMs = Date.now() - startedAt;
    console.error(`[aiRouter] primary failed (role=${opts.role} provider=${provider} model=${model}):`, err?.message || err);

    if (smart && cfg.fallbackProvider && cfg.fallbackModel && !(opts.overrideProvider || opts.overrideModel)) {
      const fbStart = Date.now();
      try {
        const { text, inputTokens, outputTokens } = await callProvider(cfg.fallbackProvider, cfg.fallbackModel, callOpts);
        const fbLatency = Date.now() - fbStart;
        recordUsage(opts.role, latencyMs + fbLatency, cfg.fallbackModel, { fallback: true, error: err?.message, inputTokens, outputTokens });
        const result: AIChatResult = { text, provider: cfg.fallbackProvider, model: cfg.fallbackModel, usedFallback: true, latencyMs: latencyMs + fbLatency, inputTokens, outputTokens };
        if (cacheable && key) {
          responseCache.set(key, { result, expiresAt: Date.now() + cacheCfg.ttlSeconds * 1000 });
          pruneCacheIfNeeded(cacheCfg.maxEntries);
        }
        return result;
      } catch (fbErr: any) {
        recordUsage(opts.role, latencyMs + (Date.now() - fbStart), model, { failed: true, fallback: true, error: `primary: ${err?.message}; fallback: ${fbErr?.message}` });
        throw new Error(`AI primary and fallback both failed: ${err?.message} / ${fbErr?.message}`);
      }
    }

    recordUsage(opts.role, latencyMs, model, { failed: true, error: err?.message });
    throw err;
  }
}

/** Returns the live cache size for the admin UI. */
export function getCacheSize(): number {
  return responseCache.size;
}

/**
 * Convenience helper for single-prompt completions.
 */
export async function aiComplete(role: AIRole, system: string, prompt: string, opts: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}): Promise<string> {
  const result = await aiChat({
    role,
    system,
    messages: [{ role: "user", content: prompt }],
    ...opts,
  });
  return result.text;
}

/**
 * Returns the current resolved (provider, model) for a role — useful when callers
 * cannot route through aiChat (e.g. streaming or tool-using flows in server/ai.ts)
 * but still want to honour admin model preferences.
 */
export async function getResolvedRole(role: AIRole): Promise<{ provider: AIProvider; model: string }> {
  const config = await getRoleConfig();
  const cfg = config[role] ?? config.default;
  return { provider: cfg.provider, model: cfg.model };
}
