import { type Express, type Request, type Response } from "express";
import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { linkedinConnections, linkedinPosts, linkedinAutoPostSettings, outreachLeads, linkedinBrandIntel, linkedinPostExamples, linkedinDiscoverySearches } from "@shared/schema";
import { eq, desc, sql, inArray, and } from "drizzle-orm";
import { buildFactsBlock, getPlatformFactsForDisplay } from "./linkedinPlatformFacts";
import { triggerManualAutoPost, getAutoPostSchedulerStatus } from "./linkedinAutoPost";
import { aiChat } from "./aiRouter";

// ── Claude helper for Profile Builder ─────────────────────────────────────────
function getClaudeClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
  });
}

async function claudeProfileCall(system: string, user: string, maxTokens = 3000): Promise<string> {
  const client = getClaudeClient();
  const msg = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content.find((b: any) => b.type === "text");
  const raw = (block as any)?.text || "{}";
  // strip markdown code fences if present
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";

const LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social"].join(" ");

// Build the redirect URI from the incoming request so it works on both
// dev (*.replit.dev) and production (urbanculturehub.nl)
function getRedirectUri(req: Request): string {
  if (process.env.LINKEDIN_REDIRECT_URI) return process.env.LINKEDIN_REDIRECT_URI;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host || "urbanculturehub.nl";
  return `${proto}://${host}/api/linkedin/callback`;
}

function isConfigured() {
  return !!(LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET);
}

async function getConnection(userId: number, slot = "primary") {
  const rows = await db
    .select()
    .from(linkedinConnections)
    .where(and(eq(linkedinConnections.adminUserId, userId), eq(linkedinConnections.accountSlot, slot)))
    .limit(1);
  return rows[0] ?? null;
}

async function linkedinGet(url: string, token: string) {
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" },
  });
  return res.data;
}

async function linkedinPost(url: string, token: string, body: object) {
  const res = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  return res.data;
}

const LINKEDIN_VERIFICATION_TOKEN = process.env.LINKEDIN_VERIFICATION_TOKEN ?? "";

// In-memory per-admin cooldown for the expensive AI lead-discovery v2 endpoint.
// Each call can fire up to 4 sequential AI requests with 16k token output, so we
// throttle to MAX_PER_WINDOW per admin within WINDOW_MS to control token spend
// and protect against accidental rapid-fire (double-click, infinite-loop UI bugs).
const DISCOVER_V2_WINDOW_MS = 60 * 1000;          // 1 minute window
const DISCOVER_V2_MAX_PER_WINDOW = 5;             // 5 runs per minute per admin
const discoverV2CallTimes = new Map<number, number[]>();
function checkDiscoverV2RateLimit(adminId: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - DISCOVER_V2_WINDOW_MS;
  const recent = (discoverV2CallTimes.get(adminId) || []).filter(t => t > cutoff);
  if (recent.length >= DISCOVER_V2_MAX_PER_WINDOW) {
    const oldest = recent[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + DISCOVER_V2_WINDOW_MS - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  recent.push(now);
  discoverV2CallTimes.set(adminId, recent);
  return { ok: true };
}

export function registerLinkedInRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: any) => void
) {
  // ── Domain verification (public — called by LinkedIn to verify domain) ────
  app.get("/.well-known/linkedin-domain-verification", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(LINKEDIN_VERIFICATION_TOKEN);
  });
  app.get("/linkedin-domain-verification", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(LINKEDIN_VERIFICATION_TOKEN);
  });

  // ── Accounts (list all slots) ─────────────────────────────────────────────
  app.get("/api/admin/linkedin/accounts", requireAdmin, async (req: Request, res: Response) => {
    if (!isConfigured()) return res.json({ configured: false, accounts: [] });
    try {
      const rows = await db.select().from(linkedinConnections)
        .where(eq(linkedinConnections.adminUserId, (req as any).admin?.id));
      const bySlot: Record<string, any> = {};
      for (const row of rows) {
        bySlot[row.accountSlot] = {
          connected: true,
          slot: row.accountSlot,
          profileName: row.profileName,
          profilePictureUrl: row.profilePictureUrl,
          email: row.email,
          connectedAt: row.connectedAt,
        };
      }
      const SLOTS = [
        { slot: "primary", label: "Account 1 — Main" },
        { slot: "core_navigator", label: "Account 2 — Core Navigator Plan One" },
      ];
      return res.json({
        configured: true,
        accounts: SLOTS.map(s => ({ ...s, ...(bySlot[s.slot] || { connected: false, slot: s.slot }) })),
      });
    } catch {
      return res.status(500).json({ error: "Failed to list accounts" });
    }
  });

  // ── Status ────────────────────────────────────────────────────────────────
  app.get("/api/admin/linkedin/status", requireAdmin, async (req: Request, res: Response) => {
    if (!isConfigured()) {
      return res.json({ configured: false, connected: false });
    }
    const slot = String((req.query as any).slot || "primary");
    try {
      const conn = await getConnection((req as any).admin?.id, slot);
      if (!conn) return res.json({ configured: true, connected: false, slot });
      return res.json({
        configured: true,
        connected: true,
        slot,
        profileName: conn.profileName,
        profilePictureUrl: conn.profilePictureUrl,
        email: conn.email,
        connectedAt: conn.connectedAt,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to get LinkedIn status" });
    }
  });

  // ── Auth URL ──────────────────────────────────────────────────────────────
  app.get("/api/admin/linkedin/auth-url", requireAdmin, (req: Request, res: Response) => {
    if (!isConfigured()) {
      return res.status(503).json({ error: "LinkedIn not configured. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET." });
    }
    const slot = String((req.query as any).slot || "primary");
    const redirectUri = getRedirectUri(req);
    const state = Buffer.from(JSON.stringify({ userId: (req as any).admin?.id, slot, ts: Date.now(), redirectUri })).toString("base64");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: LINKEDIN_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: LINKEDIN_SCOPES,
      state,
    });
    return res.json({ url: `https://www.linkedin.com/oauth/v2/authorization?${params}` });
  });

  // ── OAuth Callback (public — no requireAdmin, state carries userId) ────────
  app.get("/api/linkedin/callback", async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(`/admin?linkedinError=${encodeURIComponent(error_description || error)}`);
    }
    if (!code || !state) {
      return res.redirect("/admin?linkedinError=Missing+code+or+state");
    }

    let adminUserId: number;
    let redirectUri: string;
    let slot = "primary";
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
      adminUserId = decoded.userId;
      redirectUri = decoded.redirectUri || getRedirectUri(req);
      if (typeof decoded.slot === "string") slot = decoded.slot;
    } catch {
      return res.redirect("/admin?linkedinError=Invalid+state");
    }

    try {
      // Exchange code for token
      const tokenRes = await axios.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const { access_token, expires_in } = tokenRes.data;
      const tokenExpiresAt = new Date(Date.now() + (expires_in || 5183944) * 1000);

      // Get profile via userinfo (OpenID Connect)
      const profile = await linkedinGet("https://api.linkedin.com/v2/userinfo", access_token);
      const linkedinId: string = profile.sub || "";
      const profileName: string = profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim();
      const email: string = profile.email || "";
      const profilePictureUrl: string = profile.picture || "";

      // Upsert connection (per slot)
      const existing = await getConnection(adminUserId, slot);
      if (existing) {
        await db
          .update(linkedinConnections)
          .set({ accessToken: access_token, tokenExpiresAt, profileName, profilePictureUrl, email, updatedAt: new Date() })
          .where(and(eq(linkedinConnections.adminUserId, adminUserId), eq(linkedinConnections.accountSlot, slot)));
      } else {
        await db.insert(linkedinConnections).values({
          adminUserId,
          accountSlot: slot,
          linkedinId,
          accessToken: access_token,
          tokenExpiresAt,
          profileName,
          profilePictureUrl,
          email,
        });
      }

      return res.redirect(`/admin?linkedinSuccess=1&section=linkedin&slot=${encodeURIComponent(slot)}`);
    } catch (err: any) {
      console.error("LinkedIn OAuth callback error:", err?.response?.data || err);
      return res.redirect(`/admin?linkedinError=${encodeURIComponent("OAuth failed")}`);
    }
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  app.delete("/api/admin/linkedin/disconnect", requireAdmin, async (req: Request, res: Response) => {
    const slot = String(req.body?.slot || "primary");
    try {
      await db
        .delete(linkedinConnections)
        .where(and(eq(linkedinConnections.adminUserId, (req as any).admin?.id), eq(linkedinConnections.accountSlot, slot)));
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  // ── Create Post ───────────────────────────────────────────────────────────
  app.post("/api/admin/linkedin/post", requireAdmin, async (req: Request, res: Response) => {
    const { content, linkUrl, linkTitle, slot } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    const conn = await getConnection((req as any).admin?.id, slot || "primary");
    if (!conn) return res.status(401).json({ error: "LinkedIn not connected" });

    try {
      // Get the person URN from profile
      const profile = await linkedinGet("https://api.linkedin.com/v2/userinfo", conn.accessToken);
      const personUrn = `urn:li:person:${profile.sub}`;

      let shareContent: any;
      if (linkUrl) {
        shareContent = {
          shareCommentary: { text: content },
          shareMediaCategory: "ARTICLE",
          media: [{ status: "READY", originalUrl: linkUrl, title: { text: linkTitle || linkUrl } }],
        };
      } else {
        shareContent = {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        };
      }

      const body = {
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: { "com.linkedin.ugc.ShareContent": shareContent },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      };

      const result = await linkedinPost("https://api.linkedin.com/v2/ugcPosts", conn.accessToken, body);
      const linkedinPostId = result?.id || null;

      // Save to DB
      const [saved] = await db.insert(linkedinPosts).values({
        adminUserId: (req as any).admin?.id,
        linkedinPostId,
        content,
        postType: linkUrl ? "link" : "text",
        linkUrl: linkUrl || null,
        linkTitle: linkTitle || null,
        status: "published",
        publishedAt: new Date(),
      }).returning();

      return res.json({ success: true, post: saved, linkedinPostId });
    } catch (err: any) {
      const liErr = err?.response?.data;
      const status = err?.response?.status;
      console.error("LinkedIn post error:", liErr || err?.message || err);

      // Build a human-readable error that includes LinkedIn's actual response
      let errorMsg = "Failed to post to LinkedIn";
      if (liErr?.message) errorMsg = liErr.message;
      else if (liErr?.serviceErrorCode) errorMsg = `LinkedIn error ${liErr.serviceErrorCode}: ${liErr.message || liErr.status}`;
      else if (status === 401) errorMsg = "LinkedIn token expired or invalid — please reconnect this account";
      else if (status === 403) errorMsg = "Permission denied — this account's token may be missing the 'w_member_social' posting scope. Try disconnecting and reconnecting Account 2.";
      else if (status === 422) errorMsg = "LinkedIn rejected the post content — check for invalid characters or links";
      else if (err?.message) errorMsg = err.message;

      // Save as failed with error detail
      await db.insert(linkedinPosts).values({
        adminUserId: (req as any).admin?.id,
        content,
        postType: linkUrl ? "link" : "text",
        linkUrl: linkUrl || null,
        linkTitle: linkTitle || null,
        status: "failed",
      }).catch(() => {});

      return res.status(500).json({ error: errorMsg, detail: liErr || null, httpStatus: status });
    }
  });

  // ── Connection Diagnostics (test token + scopes per slot) ─────────────────
  app.get("/api/admin/linkedin/test-connection", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const slot = String((req.query as any).slot || "primary");
    const conn = await getConnection(adminId, slot);
    if (!conn) return res.json({ ok: false, error: "No connection found for this slot — please connect first" });

    const result: any = { slot, ok: false, checks: [] };

    // 1. Verify token via userinfo
    try {
      const profile = await linkedinGet("https://api.linkedin.com/v2/userinfo", conn.accessToken);
      result.checks.push({ name: "Token valid", ok: true, detail: `Authenticated as: ${profile.name || profile.sub}` });
      result.profileName = profile.name;
      result.linkedinId = profile.sub;
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.message || err?.message;
      result.checks.push({ name: "Token valid", ok: false, detail: status === 401 ? "Token expired or invalid — reconnect this account" : detail });
      return res.json(result);
    }

    // 2. Check token expiry
    if (conn.tokenExpiresAt) {
      const expired = new Date(conn.tokenExpiresAt) < new Date();
      result.checks.push({
        name: "Token not expired",
        ok: !expired,
        detail: expired
          ? `Expired on ${new Date(conn.tokenExpiresAt).toLocaleDateString()} — reconnect account`
          : `Expires ${new Date(conn.tokenExpiresAt).toLocaleDateString()}`,
      });
    }

    // 3. Introspect token to get actual granted scopes
    try {
      const introRes = await axios.post(
        "https://www.linkedin.com/oauth/v2/introspectToken",
        new URLSearchParams({ token: conn.accessToken, client_id: LINKEDIN_CLIENT_ID, client_secret: LINKEDIN_CLIENT_SECRET }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const intro = introRes.data;
      const scopeStr: string = intro.scope || "";
      const hasPosting = scopeStr.includes("w_member_social");
      result.checks.push({
        name: "Posting scope (w_member_social)",
        ok: hasPosting,
        detail: hasPosting
          ? `Granted scopes: ${scopeStr}`
          : `Scope NOT granted. Granted scopes: ${scopeStr || "(none returned)"}. Disconnect and reconnect this account to re-authorize with posting permission.`,
      });
      result.grantedScopes = scopeStr;
    } catch (err: any) {
      // Introspection not available — skip gracefully
      result.checks.push({
        name: "Posting scope (w_member_social)",
        ok: null,
        detail: "Could not verify scopes via introspection — try posting a test to confirm",
      });
    }

    result.ok = result.checks.every((c: any) => c.ok !== false);
    return res.json(result);
  });

  // ── Analytics ─────────────────────────────────────────────────────────────
  app.get("/api/admin/linkedin/analytics", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [leads, posts] = await Promise.all([
        db.select().from(outreachLeads),
        db.select().from(linkedinPosts).where(eq(linkedinPosts.adminUserId, (req as any).admin?.id)),
      ]);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // Leads breakdown
      const leadsByType: Record<string, number> = {};
      const leadsByStatus: Record<string, number> = {};
      let leadsThisMonth = 0;
      let leadsLastMonth = 0;
      for (const l of leads) {
        leadsByType[l.type] = (leadsByType[l.type] || 0) + 1;
        leadsByStatus[l.status] = (leadsByStatus[l.status] || 0) + 1;
        if (l.createdAt >= startOfMonth) leadsThisMonth++;
        else if (l.createdAt >= startOfLastMonth) leadsLastMonth++;
      }

      // Posts breakdown
      const postsByStatus: Record<string, number> = {};
      let postsThisMonth = 0;
      let postsLastMonth = 0;
      for (const p of posts) {
        postsByStatus[p.status || "draft"] = (postsByStatus[p.status || "draft"] || 0) + 1;
        if (p.createdAt >= startOfMonth) postsThisMonth++;
        else if (p.createdAt >= startOfLastMonth) postsLastMonth++;
      }

      // LinkedIn-imported leads (those with linkedinUrl)
      const linkedinImported = leads.filter(l => l.linkedinUrl).length;
      const emailedLeads = leads.filter(l => (l.emailSentCount || 0) > 0).length;

      return res.json({
        leads: {
          total: leads.length,
          thisMonth: leadsThisMonth,
          lastMonth: leadsLastMonth,
          byType: leadsByType,
          byStatus: leadsByStatus,
          linkedinImported,
          emailedLeads,
        },
        posts: {
          total: posts.length,
          thisMonth: postsThisMonth,
          lastMonth: postsLastMonth,
          byStatus: postsByStatus,
          published: postsByStatus["published"] || 0,
          failed: postsByStatus["failed"] || 0,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to get analytics" });
    }
  });

  // ── AI Post Generator ─────────────────────────────────────────────────────
  app.post("/api/admin/linkedin/generate-post", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const { topic, template, tone } = req.body as { topic: string; template?: string; tone?: string };
    if (!topic) return res.status(400).json({ error: "topic is required" });

    const toneDesc = tone === "professional" ? "professional and authoritative"
      : tone === "casual" ? "casual and energetic"
      : tone === "inspiring" ? "inspiring and motivational"
      : "engaging and authentic";

    const templateGuide: Record<string, string> = {
      event: "Announce an upcoming bboy/urban culture event. Include excitement, key details, and a call to action.",
      battle: "Share results or highlights from a recent bboy battle. Celebrate the community, mention top moments.",
      partnership: "Write a partnership or collaboration outreach post. Professional, explain mutual value.",
      community: "Spotlight the urban dance/bboy community. Celebrate culture, people, or a milestone.",
      general: "Share an update about DanceHealthy.net / Urban Culture Hub platform or initiative.",
    };
    const templateInstruction = templateGuide[template || "general"] || templateGuide.general;

    try {
      // ── AI Brain: load admin-trained brand intel + examples to inject ──
      const intelRows = await db.select().from(linkedinBrandIntel)
        .where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      const intel = intelRows[0];
      const goldExamples = await db.select().from(linkedinPostExamples)
        .where(sql`${linkedinPostExamples.adminUserId} = ${adminId} AND ${linkedinPostExamples.kind} = 'gold'`)
        .orderBy(sql`RANDOM()`).limit(2);
      const avoidExamples = await db.select().from(linkedinPostExamples)
        .where(sql`${linkedinPostExamples.adminUserId} = ${adminId} AND ${linkedinPostExamples.kind} = 'avoid'`)
        .limit(1);

      const intelBlock = intel ? `

ADMIN-TRAINED BRAND INTEL (highest priority — overrides defaults):
${intel.brandStory ? `\n[BRAND STORY]\n${intel.brandStory}\n` : ""}${intel.voiceRules?.length ? `\n[VOICE RULES — must obey]\n${intel.voiceRules.map((r: string) => "• " + r).join("\n")}\n` : ""}${intel.doNotSay?.length ? `\n[DO NOT SAY — never use]\n${intel.doNotSay.map((r: string) => "• " + r).join("\n")}\n` : ""}${intel.topicsLove?.length ? `\n[TOPICS WE LEAN INTO]\n${intel.topicsLove.join(", ")}\n` : ""}${intel.topicsAvoid?.length ? `\n[TOPICS WE AVOID]\n${intel.topicsAvoid.join(", ")}\n` : ""}${intel.signaturePhrases?.length ? `\n[SIGNATURE PHRASES — use naturally]\n${intel.signaturePhrases.map((r: string) => '"' + r + '"').join("\n")}\n` : ""}${intel.audienceNotes ? `\n[AUDIENCE NOTES]\n${intel.audienceNotes}\n` : ""}${intel.preferredHashtags?.length ? `\n[PREFERRED HASHTAGS — pick 3-5]\n${intel.preferredHashtags.join(" ")}\n` : ""}` : "";

      const goldBlock = goldExamples.length ? `\n\n[GOLD EXAMPLES — admin marked these as the ideal voice; imitate cadence, length, energy]\n${goldExamples.map((e, i) => `--- GOLD #${i + 1} ---\n${e.content}`).join("\n\n")}` : "";
      const avoidBlock = avoidExamples.length ? `\n\n[AVOID EXAMPLE — never write like this]\n${avoidExamples[0].content}` : "";

      // Live platform brain (counts + feature graph + rotating angle for this admin)
      const factsBlock = await buildFactsBlock({ adminUserId: adminId, suggestAngle: true })
        .catch(() => ({ text: "", suggestedFeatureId: null as string | null, toString() { return ""; } }));
      const featureId = factsBlock.suggestedFeatureId ?? null;

      const systemPrompt = `You are a LinkedIn content writer for DanceHealthy.net / Urban Culture Hub, a bboy (breakdance) battle and urban culture event platform based in the Netherlands. Write ${toneDesc} LinkedIn posts that resonate with cultural organizations, municipalities, venues, sponsors, and the urban dance community. Keep posts under 1500 characters. Use line breaks for readability. Include 3-5 relevant hashtags at the end. Never use excessive emojis.${factsBlock.text}${intelBlock}${goldBlock}${avoidBlock}`;

      const completion = await aiChat({
        role: "linkedin",
        system: systemPrompt,
        messages: [{ role: "user", content: `${templateInstruction}\n\nTopic/context: ${topic}\n\nWrite the LinkedIn post now:` }],
        temperature: 0.8,
        maxTokens: 800,
      });
      const post = completion.text.trim();

      // Bump usage_count on examples we used so admin can see they're working
      if (goldExamples.length) {
        await db.update(linkedinPostExamples)
          .set({ usageCount: sql`${linkedinPostExamples.usageCount} + 1` })
          .where(sql`${linkedinPostExamples.id} IN (${sql.join(goldExamples.map(e => sql`${e.id}`), sql`, `)})`);
      }

      return res.json({
        success: true,
        post,
        meta: { intelVersion: intel?.version || 0, goldExamplesUsed: goldExamples.length, brainEnabled: !!intel || goldExamples.length > 0 },
      });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to generate post: " + (err?.message || "unknown") });
    }
  });

  // ── Post History ──────────────────────────────────────────────────────────
  app.get("/api/admin/linkedin/posts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const posts = await db
        .select()
        .from(linkedinPosts)
        .where(eq(linkedinPosts.adminUserId, (req as any).admin?.id))
        .orderBy(desc(linkedinPosts.createdAt))
        .limit(50);
      return res.json(posts);
    } catch {
      return res.status(500).json({ error: "Failed to get posts" });
    }
  });

  // ── Search LinkedIn Companies (for lead import) ───────────────────────────
  app.get("/api/admin/linkedin/search-company", requireAdmin, async (req: Request, res: Response) => {
    const { vanityName } = req.query as { vanityName: string };
    if (!vanityName) return res.status(400).json({ error: "vanityName is required" });

    const conn = await getConnection((req as any).admin?.id);
    if (!conn) return res.status(401).json({ error: "LinkedIn not connected" });

    try {
      const data = await linkedinGet(
        `https://api.linkedin.com/v2/organizations?q=vanityName&vanityName=${encodeURIComponent(vanityName)}`,
        conn.accessToken
      );
      return res.json({ success: true, company: data });
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Company not found or insufficient API access";
      return res.status(404).json({ error: msg });
    }
  });

  // ── Import a discovered lead into the Outreach CRM (v2 — accepts rich fields) ─
  app.post("/api/admin/linkedin/import-lead", requireAdmin, async (req: Request, res: Response) => {
    const {
      organization, contactName, email, linkedinUrl, city, notes, type,
      // v2 fields (all optional, backward compatible with old callers)
      leadKind, role, industry, country, seniority, whyRelevant, howToConnect,
      suggestedOpener, tags, score, aiConfidence, discoveryQuery,
    } = req.body || {};

    if (!organization && !contactName) {
      return res.status(400).json({ error: "Either organization or contactName is required" });
    }

    // Coerce leadKind, then derive a stable `type` value from it (legacy column is NOT NULL)
    const validKinds = ["person", "company", "organization"] as const;
    const kind: "person" | "company" | "organization" =
      validKinds.includes(leadKind) ? leadKind : (organization ? "organization" : "person");

    const validLegacyTypes = ["municipality", "venue", "cultural_org", "media", "sponsor", "person", "company", "organization", "investor", "tech", "ai", "startup", "marketing"];
    const legacyType = typeof type === "string" && validLegacyTypes.includes(type)
      ? type
      : (kind === "person" ? "person" : kind === "company" ? "company" : "organization");

    // For people without an org, store the role/title as the org placeholder so the NOT NULL holds
    const orgValue = organization || contactName || "Unknown";

    try {
      // Duplicate check: by org name + by linkedinUrl (only when present)
      const existing = await db.select({ id: outreachLeads.id, organization: outreachLeads.organization })
        .from(outreachLeads)
        .where(sql`lower(regexp_replace(organization, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(${orgValue}, '[^a-zA-Z0-9]', '', 'g'))`);
      if (existing.length > 0 && !linkedinUrl) {
        return res.status(409).json({ error: "duplicate", message: `"${existing[0].organization}" is already in your Outreach CRM` });
      }
      if (linkedinUrl) {
        const urlMatch = await db.select({ id: outreachLeads.id }).from(outreachLeads)
          .where(eq(outreachLeads.linkedinUrl, linkedinUrl));
        if (urlMatch.length > 0) {
          return res.status(409).json({ error: "duplicate", message: "A lead with this LinkedIn URL already exists in your Outreach CRM" });
        }
      }

      const cleanTags = Array.isArray(tags) ? tags.filter((t: any) => typeof t === "string").slice(0, 12) : [];
      const safeScore = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Math.round(Number(score)))) : null;
      const safeConfidence = Number.isFinite(Number(aiConfidence)) ? Math.max(0, Math.min(100, Math.round(Number(aiConfidence)))) : null;

      const [lead] = await db.insert(outreachLeads).values({
        organization: orgValue,
        name: contactName || null,
        email: email || null,
        linkedinUrl: linkedinUrl || null,
        city: city || null,
        notes: notes ? `[AI Lead Discovery]\n${notes}` : "[AI Lead Discovery]",
        status: "new",
        type: legacyType,
        leadKind: kind,
        role: role || null,
        industry: industry || null,
        country: country || null,
        seniority: seniority || null,
        whyRelevant: whyRelevant || null,
        howToConnect: howToConnect || null,
        suggestedOpener: suggestedOpener || null,
        tags: cleanTags,
        score: safeScore,
        aiConfidence: safeConfidence,
        discoveryQuery: typeof discoveryQuery === "string" ? discoveryQuery.slice(0, 2000) : null,
      }).returning();
      return res.json({ success: true, lead });
    } catch (err: any) {
      console.error("Import lead error:", err);
      return res.status(500).json({ error: "Failed to import lead" });
    }
  });

  // ── AI-Powered Lead Discovery (LEGACY v1 — kept for any external callers) ─
  app.post("/api/admin/linkedin/ai-discover", requireAdmin, async (req: Request, res: Response) => {
    const { keyword, city, type, count = 30 } = req.body as { keyword: string; city?: string; type?: string; count?: number };
    if (!keyword) return res.status(400).json({ error: "keyword is required" });

    const typeLabels: Record<string, string> = {
      municipality: "municipality / government cultural department",
      venue: "event venue or performing arts location",
      cultural_org: "cultural organization, dance company, or arts foundation",
      media: "media outlet, music blog, or entertainment journalist",
      sponsor: "brand, sponsor, or corporate CSR partner",
    };
    const typeDescription = typeLabels[type || ""] || "relevant organization or contact";
    const locationHint = city ? ` in or around ${city}` : " in the Netherlands";

    const systemPrompt = `You are an expert outreach researcher for DanceHealthy.net / Urban Culture Hub, a bboy (breakdance) battle and urban culture event platform based in the Netherlands. Your job is to identify real, specific organizations and contacts that would be valuable outreach targets${locationHint}.

Return a JSON object with a single key "leads" containing an array. Each item in the array must have exactly these fields:
- "organization": full official name of the organization
- "contactName": likely job title or role (e.g. "Cultuurcoördinator", "Eventmanager") — never invent personal names, use null if unknown
- "city": city or region (string)
- "linkedinUrl": realistic LinkedIn URL (e.g. https://linkedin.com/company/gemeente-amsterdam or https://linkedin.com/in/handle)
- "website": official website URL or null
- "notes": 1-2 sentences explaining why this is a strong outreach target for bboy/urban culture events
- "type": "${type || "municipality"}"`;

    const userPrompt = `Find ${count} real ${typeDescription} organizations or contacts for outreach about: "${keyword}"${locationHint}. Prioritize entities that would sponsor, host, promote, or support bboy battles and urban culture events.`;

    try {
      const completion = await aiChat({
        role: "linkedin",
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.7,
        maxTokens: 6000,
        jsonMode: true,
      });

      const raw = completion.text || "{}";
      let leads: any[] = [];
      try {
        const parsed = JSON.parse(raw);
        leads = Array.isArray(parsed) ? parsed : (parsed.leads || parsed.results || parsed.organizations || Object.values(parsed)[0] || []);
      } catch {
        return res.status(500).json({ error: "GPT returned invalid JSON" });
      }

      return res.json({ success: true, leads });
    } catch (err: any) {
      console.error("AI discover error:", err?.message || err);
      return res.status(500).json({ error: "AI discovery failed: " + (err?.message || "unknown error") });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // ── AI Lead Discovery v2 — people + companies + actionable per-lead intel ─
  // ────────────────────────────────────────────────────────────────────────
  app.post("/api/admin/linkedin/discover-leads-v2", requireAdmin, async (req: Request, res: Response) => {
    const adminId: number | undefined = (req as any).admin?.id;
    if (!adminId) return res.status(401).json({ error: "Not authenticated" });

    // Per-admin throttle — protect against accidental rapid-fire on this expensive (multi-AI-call) route.
    const limit = checkDiscoverV2RateLimit(adminId);
    if (!limit.ok) {
      res.setHeader("Retry-After", String(limit.retryAfterSec));
      return res.status(429).json({ error: `Too many lead-discovery runs. Please wait ${limit.retryAfterSec}s before trying again.`, retryAfterSec: limit.retryAfterSec });
    }

    const body = req.body || {};
    const leadKind: "person" | "company" | "both" = ["person", "company", "both"].includes(body.leadKind) ? body.leadKind : "both";
    const query: string = String(body.query || "").trim();
    const industries: string[] = Array.isArray(body.industries) ? body.industries.filter((x: any) => typeof x === "string").slice(0, 8) : [];
    const roles: string[] = Array.isArray(body.roles) ? body.roles.filter((x: any) => typeof x === "string").slice(0, 8) : [];
    const cities: string[] = Array.isArray(body.cities) ? body.cities.filter((x: any) => typeof x === "string").slice(0, 8) : [];
    const countries: string[] = Array.isArray(body.countries) ? body.countries.filter((x: any) => typeof x === "string").slice(0, 6) : [];
    const seniority: string = typeof body.seniority === "string" ? body.seniority : "any";
    const intent: string = typeof body.intent === "string" ? body.intent : "networking";
    const count: number = Math.max(5, Math.min(40, parseInt(body.count, 10) || 20));
    const useMyContext: boolean = body.useMyContext !== false;
    const saveSearch: boolean = body.saveSearch !== false;

    if (!query && industries.length === 0 && roles.length === 0) {
      return res.status(400).json({ error: "Provide a query, or at least one industry / role." });
    }

    // 1) Pull brand intel + platform brain so AI tailors leads to *this* admin's projects
    let brandContext = "";
    if (useMyContext) {
      try {
        const [intel] = await db.select().from(linkedinBrandIntel).where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
        const factsBlock = await buildFactsBlock({ adminUserId: adminId, suggestAngle: false });
        const intelLines: string[] = [];
        if (intel?.brandStory) intelLines.push(`BRAND STORY:\n${intel.brandStory}`);
        if (intel?.audienceNotes) intelLines.push(`AUDIENCE NOTES:\n${intel.audienceNotes}`);
        if (intel?.topicsLove?.length) intelLines.push(`TOPICS THIS PERSON LOVES: ${intel.topicsLove.join(", ")}`);
        if (intel?.topicsAvoid?.length) intelLines.push(`TOPICS TO AVOID: ${intel.topicsAvoid.join(", ")}`);
        const factsText = typeof factsBlock === "object" && factsBlock !== null && "text" in factsBlock
          ? (factsBlock as any).text
          : String(factsBlock || "");
        if (intelLines.length) brandContext += "\n\n## ADMIN BRAND INTEL (use to prioritize leads relevant to THIS person)\n" + intelLines.join("\n\n");
        if (factsText) brandContext += "\n\n## PLATFORM CONTEXT (the admin runs this product — leads should be relevant to it)\n" + factsText;
      } catch (e: any) {
        console.warn("[discover-v2] brand context load failed:", e?.message);
      }
    }

    // 2) Build precise filter description
    const kindDescription =
      leadKind === "person" ? "REAL PUBLICLY-IDENTIFIABLE PEOPLE — founders, decision-makers, public-facing operators (no company-only entries; no internal employees you cannot verify)" :
      leadKind === "company" ? "REAL EXISTING COMPANIES / ORGANIZATIONS only (no individual people)" :
      "a healthy mix of REAL EXISTING companies/organizations AND publicly-known people who lead them";

    const intentDescriptions: Record<string, string> = {
      networking: "building genuine professional relationships and growing a network of peers",
      collaboration: "finding partners for joint projects, cross-promotion, content swaps, or co-creating events",
      partnership: "long-term strategic partnerships, integrations, or B2B distribution deals",
      sponsorship: "getting events, content, or projects sponsored / financially supported",
      investment: "finding angel investors, VCs, or grant-makers who could fund growth",
      hiring: "recruiting talent (developers, marketers, designers, ops people) for the team",
      mentorship: "finding experienced operators who can advise or open doors",
    };
    const intentText = intentDescriptions[intent] || intentDescriptions.networking;

    const filterLines: string[] = [];
    if (industries.length) filterLines.push(`Industries to focus on: ${industries.join(", ")}`);
    if (roles.length) filterLines.push(`Roles / job titles wanted: ${roles.join(", ")}`);
    if (seniority && seniority !== "any") filterLines.push(`Seniority preference: ${seniority}`);
    if (cities.length) filterLines.push(`Cities preferred: ${cities.join(", ")}`);
    if (countries.length) filterLines.push(`Countries: ${countries.join(", ")}`);

    // ─── Helpers (anti-hallucination + URL normalization + dedup) ──────────────
    const validKinds = ["person", "company", "organization"] as const;
    const validHow = ["connect_request", "warm_intro", "comment_then_dm", "cold_dm", "email_first", "event_meetup", "content_engagement"] as const;
    // We deliberately do NOT trust AI-supplied /in/<slug> or /company/<slug> URLs even if they look syntactically valid —
    // the model regularly hallucinates plausible-looking slugs that 404. ALL outbound LinkedIn URLs are server-built
    // search URLs, which always land the user on a real LinkedIn search results page.
    const buildSearchUrl = (kind: string, lead: { name?: string | null; role?: string | null; organization?: string }) => {
      const isPerson = kind === "person";
      const path = isPerson ? "people" : "companies";
      // For people: prefer "Name Company"; fall back to "Role at Company". For companies: just the org name.
      const keywords = isPerson
        ? (lead.name ? `${lead.name} ${lead.organization ?? ""}`.trim() : `${lead.role ?? ""} ${lead.organization ?? ""}`.trim())
        : (lead.organization ?? "");
      const safe = keywords.replace(/\s+/g, " ").trim();
      if (!safe) return `https://www.linkedin.com/search/results/${path}/`;
      return `https://www.linkedin.com/search/results/${path}/?keywords=${encodeURIComponent(safe)}&origin=GLOBAL_SEARCH_HEADER`;
    };

    const sanitizeLead = (l: any) => {
      const kind = (validKinds as readonly string[]).includes(l?.leadKind) ? l.leadKind : (l?.name ? "person" : "company");
      const how = (validHow as readonly string[]).includes(l?.howToConnect) ? l.howToConnect : "connect_request";
      const tagArr = Array.isArray(l?.tags) ? l.tags.filter((t: any) => typeof t === "string").slice(0, 5) : [];
      const score = Number.isFinite(Number(l?.score)) ? Math.max(0, Math.min(100, Math.round(Number(l.score)))) : null;
      const confidence = Number.isFinite(Number(l?.aiConfidence)) ? Math.max(0, Math.min(100, Math.round(Number(l.aiConfidence)))) : null;
      const orgRaw = String(l?.organization || l?.company || "").trim();
      // Strip personal name when AI is not confident — prevents fake people from being shown as real.
      const nameOk = l?.name && typeof l.name === "string" && (confidence ?? 0) >= 70 ? String(l.name).trim() : null;
      // URL: ALWAYS server-built search URL (we can't verify slugs, so we never trust AI-supplied profile/company URLs).
      const linkedinUrl = buildSearchUrl(kind, { name: nameOk, role: l?.role, organization: orgRaw });
      return {
        leadKind: kind as "person" | "company" | "organization",
        name: nameOk,
        role: l?.role ? String(l.role).trim() : null,
        organization: orgRaw || "Unknown",
        industry: l?.industry ? String(l.industry).trim() : null,
        city: l?.city ? String(l.city).trim() : null,
        country: l?.country ? String(l.country).trim() : null,
        seniority: l?.seniority ? String(l.seniority).trim() : null,
        linkedinUrl,
        website: l?.website ? String(l.website).trim() : null,
        tags: tagArr,
        whyRelevant: l?.whyRelevant || l?.why_relevant || null,
        howToConnect: how as (typeof validHow)[number],
        suggestedOpener: l?.suggestedOpener || l?.suggested_opener || null,
        score,
        aiConfidence: confidence,
      };
    };

    const dedupKey = (l: { leadKind: string; name: string | null; role: string | null; organization: string }) => {
      const org = (l.organization || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (l.leadKind !== "person") return `org::${org}`;
      const who = (l.name || l.role || "").toLowerCase().replace(/\s+/g, " ").trim();
      return `person::${who}::${org}`;
    };

    const passesQuality = (l: { leadKind: string; organization: string; whyRelevant: string | null; score: number | null; aiConfidence: number | null }) => {
      if (!l.organization || l.organization === "Unknown") return false;
      if (!l.whyRelevant) return false;                               // every lead must explain itself
      if ((l.score ?? 0) < 30) return false;                          // weak relevance → drop
      if (l.leadKind === "person" && (l.aiConfidence ?? 0) < 50) return false; // person leads must be reasonably grounded
      if (l.leadKind !== "person" && (l.aiConfidence ?? 0) < 40) return false; // companies are easier — slightly looser
      return true;
    };

    // ─── System prompt — strict JSON, ZERO tolerance for fabrication ────────
    const buildSystemPrompt = (targetCount: number, excludeOrgs: string[]) => `You are an elite B2B / strategic-network research analyst working for a Netherlands-based entrepreneur (Urban Culture Hub + Coffee & Dance + Dance Healthy — urban culture, dance, sport, community, tech).

Your single job: return ${targetCount} REAL, EXISTING leads as STRICT JSON. Never make up companies. Never make up people.

ABSOLUTE RULES (violations = useless leads, do not violate):
1. ${kindDescription}.
2. Intent: ${intentText}.
3. EVERY company/organization you name MUST be a real entity that exists in 2024–2026 — known brands, established companies, public institutions, well-known associations, real municipalities, real funds, real publishers, real venues. If you are not sure it exists, DO NOT include it. Pick a different real one.
4. For people: ONLY include a personal name if the person is publicly known in that role (founders mentioned in press, public C-level, journalists, public officials, well-known investors, public artists). If you are not sure the person exists in that exact role today, set "name": null and describe the role + company instead. Do NOT invent plausible-sounding Dutch/European names.
5. linkedinUrl: leave it as null or as a real /in/slug or /company/slug URL ONLY if you are CERTAIN the slug exists. Otherwise OMIT it — the server will build a reliable LinkedIn search URL automatically. Do NOT make up slugs.
6. Diversify: do NOT cluster the same accelerator, same city, or same parent company. Spread across multiple sub-industries and entry points.
7. Each lead MUST include WHY it's relevant to this entrepreneur's specific projects (use the brand context).
8. Each lead MUST include HOW to connect (one of: connect_request, warm_intro, comment_then_dm, cold_dm, email_first, event_meetup, content_engagement).
9. Each lead MUST include a SHORT first-message opener (1–2 sentences max), specific to that lead.
10. Set "aiConfidence" honestly: 90+ only for household-name companies / very-public people; 60–80 for real-but-niche; below 50 means you are guessing — do not include those leads.
11. Quantity matters. Return EXACTLY ${targetCount} leads in the array. Not fewer. If you run out of high-confidence options for the requested filters, broaden to adjacent real options that still match the intent.
${excludeOrgs.length ? `12. EXCLUDE these organizations (already returned in this session, do not repeat): ${excludeOrgs.slice(0, 60).join("; ")}.` : ""}

Output STRICT JSON: { "leads": [ ... ] }. Each lead has EXACTLY these fields:
{
  "leadKind": "person" | "company" | "organization",
  "name": string | null,
  "role": string | null,
  "organization": string,
  "industry": string,
  "city": string | null,
  "country": string | null,
  "seniority": "junior" | "mid" | "senior" | "decision_maker" | "c_level" | null,
  "linkedinUrl": string | null,
  "website": string | null,
  "tags": string[],
  "whyRelevant": string,
  "howToConnect": "connect_request" | "warm_intro" | "comment_then_dm" | "cold_dm" | "email_first" | "event_meetup" | "content_engagement",
  "suggestedOpener": string,
  "score": number,
  "aiConfidence": number
}`;

    const userPromptBase = `INTENT: ${intent} — ${intentText}

QUERY: "${query || "(no free-text query — rely on filters)"}"

FILTERS:
${filterLines.length ? filterLines.map(l => "- " + l).join("\n") : "- (no extra filters — be smart about diversity)"}
${brandContext}`;

    // ─── Batched generator: one call returns ~batchSize leads, retried with growing exclude list ─
    const BATCH_SIZE = 12;
    const MAX_BATCHES = 4;     // safety cap on AI calls per request
    const callBatch = async (targetSize: number, excludeOrgs: string[], extraDirective?: string) => {
      const userMsg = `${userPromptBase}\n\nReturn EXACTLY ${targetSize} leads, ordered by relevance score descending. JSON only.${extraDirective ? `\n\nADDITIONAL DIRECTIVE: ${extraDirective}` : ""}`;
      const completion = await aiChat({
        role: "linkedin",
        system: buildSystemPrompt(targetSize, excludeOrgs),
        messages: [{ role: "user", content: userMsg }],
        temperature: 0.5,           // lower temp = less invention
        maxTokens: 16000,           // big enough to fit ~30 leads in JSON, no truncation
        jsonMode: true,
      });
      const raw = completion.text || "{}";
      try {
        const parsed = JSON.parse(raw);
        const arr: any[] = Array.isArray(parsed) ? parsed : (parsed.leads || parsed.results || parsed.people || Object.values(parsed)[0] || []);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    };

    try {
      const merged = new Map<string, ReturnType<typeof sanitizeLead>>(); // dedup by org/person key
      let batchesUsed = 0;
      let consecutiveZeroBatches = 0; // allow one retry before giving up

      while (merged.size < count && batchesUsed < MAX_BATCHES && consecutiveZeroBatches < 2) {
        const remaining = count - merged.size;
        const target = Math.min(BATCH_SIZE, Math.max(6, remaining)); // ask for at least 6 to keep AI productive
        const excludeOrgs = Array.from(merged.values()).map(l => l.organization).filter(Boolean);
        // On a retry after a zero-add batch, push the model toward different angles/sub-industries.
        const extraDirective = consecutiveZeroBatches > 0
          ? "Your previous attempt produced only duplicates or low-confidence guesses. Pivot to ADJACENT real organizations and roles (different sub-industries, different cities, neighboring sectors that still match the intent). Do NOT lower your factual accuracy — drop any lead you are not confident exists."
          : undefined;
        const rawBatch = await callBatch(target, excludeOrgs, extraDirective);
        batchesUsed++;
        let added = 0;
        for (const item of rawBatch) {
          const clean = sanitizeLead(item);
          if (!passesQuality(clean)) continue;
          const key = dedupKey(clean);
          if (merged.has(key)) continue;
          merged.set(key, clean);
          added++;
          if (merged.size >= count) break;
        }
        consecutiveZeroBatches = added === 0 ? consecutiveZeroBatches + 1 : 0;
        console.log(`[discover-v2] batch ${batchesUsed}: requested ${target}, got ${rawBatch.length}, added ${added} after dedup/quality. Total ${merged.size}/${count}${added === 0 ? " (zero-add — will retry once with different angle)" : ""}`);
      }

      // Final assembly: sort by score desc, hard-cap to requested count
      const finalLeads = Array.from(merged.values())
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, count);

      // 4) Persist the search to history (so the user can re-run / build memory)
      let searchId: number | null = null;
      if (saveSearch) {
        try {
          const [savedSearch] = await db.insert(linkedinDiscoverySearches).values({
            adminUserId: adminId,
            query: { leadKind, query, industries, roles, cities, countries, seniority, intent, count, useMyContext },
            label: query || `${intent} · ${[...industries, ...roles].slice(0, 3).join(", ") || leadKind}`,
            resultCount: finalLeads.length,
          }).returning();
          searchId = savedSearch?.id ?? null;
        } catch (e: any) {
          console.warn("[discover-v2] failed to save search history:", e?.message);
        }
      }

      return res.json({
        success: true,
        leads: finalLeads,
        searchId,
        meta: {
          requested: count,
          returned: finalLeads.length,
          batchesUsed,
          shortfall: Math.max(0, count - finalLeads.length),
          note: finalLeads.length < count
            ? "AI couldn't find more high-confidence leads matching these filters without inventing data. Try broadening industries / roles / countries, or lowering the requested count."
            : null,
        },
      });
    } catch (err: any) {
      console.error("Discover-v2 error:", err?.message || err);
      return res.status(500).json({ error: "Lead discovery failed: " + (err?.message || "unknown error") });
    }
  });

  // ── Saved discovery searches (history & memory) ──────────────────────────
  app.get("/api/admin/linkedin/discovery-searches", requireAdmin, async (req: Request, res: Response) => {
    const adminId: number | undefined = (req as any).admin?.id;
    if (!adminId) return res.status(401).json({ error: "Not authenticated" });
    try {
      const rows = await db.select().from(linkedinDiscoverySearches)
        .where(eq(linkedinDiscoverySearches.adminUserId, adminId))
        .orderBy(desc(linkedinDiscoverySearches.createdAt))
        .limit(40);
      return res.json({ success: true, searches: rows });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to load history" });
    }
  });

  app.delete("/api/admin/linkedin/discovery-searches/:id", requireAdmin, async (req: Request, res: Response) => {
    const adminId: number | undefined = (req as any).admin?.id;
    const sid = parseInt(req.params.id, 10);
    if (!adminId || !Number.isFinite(sid)) return res.status(400).json({ error: "Bad request" });
    try {
      await db.delete(linkedinDiscoverySearches)
        .where(and(eq(linkedinDiscoverySearches.id, sid), eq(linkedinDiscoverySearches.adminUserId, adminId)));
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to delete" });
    }
  });

  app.patch("/api/admin/linkedin/discovery-searches/:id/favorite", requireAdmin, async (req: Request, res: Response) => {
    const adminId: number | undefined = (req as any).admin?.id;
    const sid = parseInt(req.params.id, 10);
    const favorite = !!req.body?.favorite;
    if (!adminId || !Number.isFinite(sid)) return res.status(400).json({ error: "Bad request" });
    try {
      await db.update(linkedinDiscoverySearches)
        .set({ savedAsFavorite: favorite })
        .where(and(eq(linkedinDiscoverySearches.id, sid), eq(linkedinDiscoverySearches.adminUserId, adminId)));
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to update" });
    }
  });

  // ── Toggle "save lead to brain" — surfaces the lead in AI context for future posts/dms ─
  app.patch("/api/admin/linkedin/lead/:id/save-to-brain", requireAdmin, async (req: Request, res: Response) => {
    const adminId: number | undefined = (req as any).admin?.id;
    const lid = parseInt(req.params.id, 10);
    const saved = !!req.body?.saved;
    if (!adminId || !Number.isFinite(lid)) return res.status(400).json({ error: "Bad request" });
    try {
      const result = await db.update(outreachLeads)
        .set({ savedToBrain: saved })
        .where(and(eq(outreachLeads.id, lid), eq(outreachLeads.adminUserId, adminId)))
        .returning({ id: outreachLeads.id });
      if (result.length === 0) return res.status(404).json({ error: "Lead not found" });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed" });
    }
  });

  // ── Regenerate a per-lead opener (uses brand intel + the lead's own data) ─
  app.post("/api/admin/linkedin/lead/:id/regenerate-opener", requireAdmin, async (req: Request, res: Response) => {
    const adminId: number | undefined = (req as any).admin?.id;
    const lid = parseInt(req.params.id, 10);
    if (!adminId || !Number.isFinite(lid)) return res.status(400).json({ error: "Bad request" });
    try {
      const [lead] = await db.select().from(outreachLeads)
        .where(and(eq(outreachLeads.id, lid), eq(outreachLeads.adminUserId, adminId)))
        .limit(1);
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const [intel] = await db.select().from(linkedinBrandIntel).where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      const brandStory = intel?.brandStory || "An entrepreneur building Urban Culture Hub — a Netherlands-based platform for street/urban culture, dance, and community events.";

      const sys = `You write short, specific, human first-message openers for LinkedIn outreach. NEVER generic. 1–2 sentences. No emojis. No "Hi, I'd love to connect" filler. Reference one concrete detail about the recipient and one about the sender's work.`;
      const user = `SENDER (the person reaching out):
${brandStory}

RECIPIENT:
- Kind: ${lead.leadKind || "person"}
- Name: ${lead.name || "(role-only)"}
- Role: ${lead.role || "—"}
- Organization: ${lead.organization}
- Industry: ${lead.industry || "—"}
- Why they are relevant: ${lead.whyRelevant || "—"}
- Tags: ${(lead.tags || []).join(", ") || "—"}

Return JSON: { "opener": "..." }`;

      const completion = await aiChat({
        role: "linkedin",
        system: sys,
        messages: [{ role: "user", content: user }],
        temperature: 0.7,
        maxTokens: 400,
        jsonMode: true,
      });

      let opener = "";
      try { opener = JSON.parse(completion.text || "{}").opener || ""; } catch { opener = ""; }
      if (!opener) return res.status(500).json({ error: "AI returned no opener" });

      await db.update(outreachLeads).set({ suggestedOpener: opener }).where(eq(outreachLeads.id, lid));
      return res.json({ success: true, opener });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed" });
    }
  });

  // ── LinkedIn DM Campaign: AI-generate all messages at once ────────────────
  app.post("/api/admin/linkedin/dm-campaign/generate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { leads, tone, goal } = req.body as {
        leads: Array<{ id: number; name?: string; organization: string; department?: string; city?: string; type?: string }>;
        tone: string;
        goal: string;
      };
      if (!Array.isArray(leads) || leads.length === 0) return res.status(400).json({ error: "No leads provided" });

      const AUTHOR = `Riki Almouti, oprichter van Urban Culture Hub (urbanculturehub.nl) — het platform voor urban sports, dans en cultuur in Nederland. iOS app live in de App Store. Hij heeft dans-achtergrond (Dance Healthy, Coffee & Dance), organiseerde grote events (Back to the Street, TurboVision) en bouwt het platform voor gemeenten, sponsors en partners.`;

      const systemPrompt = `Je bent Riki Almouti. Schrijf korte, persoonlijke LinkedIn berichten (max 300 tekens) per contact.
Toon: ${tone || "vriendelijk en direct"}.
Doel: ${goal || "kennismaken en samenwerking bespreken"}.
Over Riki: ${AUTHOR}
Schrijf elk bericht IN HET NEDERLANDS tenzij het een internationale organisatie is.
GEEN emojis tenzij heel spaarzaam. Geen clichés. Altijd persoonlijk aanspreken.
Return ALLEEN een JSON array: [{"id": <lead_id>, "message": "<bericht>"}]`;

      const leadsText = leads.map(l => `ID ${l.id}: ${l.name || ""} @ ${l.organization}${l.department ? ` (${l.department})` : ""}${l.city ? ` — ${l.city}` : ""}${l.type ? ` [${l.type}]` : ""}`).join("\n");

      const completion = await aiChat({
        role: "linkedin",
        system: systemPrompt,
        messages: [{ role: "user", content: `Schrijf een LinkedIn bericht voor elk van deze contacten:\n\n${leadsText}\n\nReturn JSON array met id + message voor elk contact.` }],
        temperature: 0.8,
        jsonMode: true,
      });

      const raw = completion.text || "{}";
      let messages: Array<{ id: number; message: string }> = [];
      try {
        const parsed = JSON.parse(raw);
        messages = Array.isArray(parsed) ? parsed : parsed.messages || parsed.leads || [];
      } catch {
        return res.status(500).json({ error: "AI returned invalid JSON" });
      }

      return res.json({ success: true, messages });
    } catch (err: any) {
      console.error("DM campaign generate error:", err?.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── LinkedIn DM Campaign: Mark lead as DM sent ────────────────────────────
  app.post("/api/admin/linkedin/dm-campaign/mark-sent", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { leadId, message } = req.body as { leadId: number; message: string };
      if (!leadId) return res.status(400).json({ error: "leadId required" });

      await db.update(outreachLeads)
        .set({
          linkedinDmSentAt: new Date(),
          linkedinDmContent: message || null,
          status: "contacted",
        })
        .where(eq(outreachLeads.id, leadId));

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Bulk Import LinkedIn Leads ─────────────────────────────────────────────
  app.post("/api/admin/linkedin/bulk-import", requireAdmin, async (req: Request, res: Response) => {
    const { leads } = req.body as { leads: Array<{ organization: string; contactName?: string; email?: string; linkedinUrl?: string; city?: string; notes?: string; type?: string }> };
    if (!Array.isArray(leads) || leads.length === 0) return res.status(400).json({ error: "No leads provided" });

    const validTypes = ["municipality", "venue", "cultural_org", "media", "sponsor"];
    let imported = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      if (!lead.organization) continue;
      try {
        await db.insert(outreachLeads).values({
          organization: lead.organization,
          name: lead.contactName || null,
          email: lead.email || null,
          linkedinUrl: lead.linkedinUrl || null,
          city: lead.city || null,
          notes: lead.notes ? `[Imported from LinkedIn]\n${lead.notes}` : "[Imported from LinkedIn]",
          status: "new",
          type: validTypes.includes(lead.type || "") ? lead.type! : "municipality",
        });
        imported++;
      } catch (err: any) {
        errors.push(`${lead.organization}: ${err.message}`);
      }
    }

    return res.json({ success: true, imported, errors });
  });

  // ── Auto-Post Settings ────────────────────────────────────────────────────
  app.get("/api/admin/linkedin/auto-post/settings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).admin?.id;
      const rows = await db.select().from(linkedinAutoPostSettings).where(eq(linkedinAutoPostSettings.adminUserId, adminId)).limit(1);
      if (!rows[0]) return res.json(null);
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/linkedin/auto-post/settings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).admin?.id;
      const { enabled, postTime, timezone, topics, tone, template, includeHashtags, includeCta, language, targetAudience, customContext, includeImage, requiresApproval } = req.body;

      const existing = await db.select().from(linkedinAutoPostSettings).where(eq(linkedinAutoPostSettings.adminUserId, adminId)).limit(1);

      const [targetHH, targetMM] = (postTime || "09:00").split(":");
      const now = new Date();
      const nextPost = new Date();
      nextPost.setHours(parseInt(targetHH), parseInt(targetMM), 0, 0);
      if (nextPost <= now) nextPost.setDate(nextPost.getDate() + 1);

      const data = {
        enabled: !!enabled,
        postTime: postTime || "09:00",
        timezone: timezone || "Europe/Amsterdam",
        topics: Array.isArray(topics) ? topics : [],
        tone: tone || "engaging",
        template: template || "auto",
        includeHashtags: includeHashtags !== false,
        includeCta: includeCta !== false,
        language: language || "en",
        targetAudience: targetAudience || "general",
        customContext: customContext || "",
        includeImage: !!includeImage,
        requiresApproval: !!requiresApproval,
        nextPostAt: nextPost,
        updatedAt: new Date(),
      };

      if (existing[0]) {
        const [updated] = await db.update(linkedinAutoPostSettings).set(data).where(eq(linkedinAutoPostSettings.adminUserId, adminId)).returning();
        return res.json(updated);
      } else {
        const [created] = await db.insert(linkedinAutoPostSettings).values({ adminUserId: adminId, ...data }).returning();
        return res.json(created);
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/linkedin/auto-post/trigger", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).admin?.id;
      const result = await triggerManualAutoPost(adminId);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/linkedin/auto-post/scheduler-status", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    return res.json(getAutoPostSchedulerStatus(adminId));
  });

  // ── AI Profile Optimizer ───────────────────────────────────────────────────
  app.post("/api/admin/linkedin/optimize-profile", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { headline, about, goal, targetAudience, name } = req.body;

      const prompt = `You are a LinkedIn profile optimization expert. Analyze this LinkedIn profile and provide comprehensive enhancements.

PROFILE DATA:
Name: ${name || "Not provided"}
Current Headline: ${headline || "Not provided"}
Current About/Bio: ${about || "Not provided"}
Goal: ${goal || "Not provided"}
Target Audience: ${targetAudience || "Not provided"}

CONTEXT: This person runs Urban Culture Hub — a platform that connects people around Amsterdam's urban culture scene including:
- Street art, graffiti, STRAAT Museum
- Dance (breakdancing, hip-hop, house)
- Sports: Padel, Table Tennis, Basketball, Skateboarding, BMX, Calisthenics, Parkour
- Nightlife, cafés, restaurants, cultural events
- A community app connecting artists, athletes, lifestyle enthusiasts, and visitors

Respond with a JSON object (no markdown, pure JSON) with this exact structure:
{
  "score": <number 0-100>,
  "scoreBreakdown": {
    "headline": <0-25>,
    "about": <0-25>,
    "keywords": <0-20>,
    "clarity": <0-15>,
    "engagement": <0-15>
  },
  "organicReachScore": <0-100>,
  "enhancedHeadline": "<improved headline, max 220 chars, keyword-rich>",
  "alternativeHeadlines": ["<option 2>", "<option 3>"],
  "enhancedAbout": "<full enhanced about section, 300-2000 chars, with hook, story, value prop, CTA>",
  "recommendations": [
    {"priority": "high", "title": "<title>", "detail": "<actionable detail>", "impact": "<expected impact>"},
    {"priority": "high", "title": "<title>", "detail": "<actionable detail>", "impact": "<expected impact>"},
    {"priority": "medium", "title": "<title>", "detail": "<actionable detail>", "impact": "<expected impact>"},
    {"priority": "medium", "title": "<title>", "detail": "<actionable detail>", "impact": "<expected impact>"},
    {"priority": "low", "title": "<title>", "detail": "<actionable detail>", "impact": "<expected impact>"}
  ],
  "organicReachTips": [
    "<tip 1 for improving LinkedIn reach>",
    "<tip 2>",
    "<tip 3>",
    "<tip 4>",
    "<tip 5>"
  ],
  "contentStrategy": {
    "bestPostTypes": ["<type 1>", "<type 2>", "<type 3>"],
    "postingFrequency": "<recommended posting frequency>",
    "bestTimes": "<best days/times to post>",
    "contentPillars": ["<pillar 1>", "<pillar 2>", "<pillar 3>"]
  },
  "keywordsToAdd": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"]
}`;

      const completion = await aiChat({
        role: "linkedin",
        system: "You are a LinkedIn profile expert. Return only valid JSON, no markdown.",
        messages: [{ role: "user", content: prompt }],
        maxTokens: 2000,
        temperature: 0.7,
        jsonMode: true,
      });

      const raw = completion.text.trim() || "{}";
      let result: any = {};
      try { result = JSON.parse(raw); } catch { result = { error: "Failed to parse AI response", raw }; }

      return res.json(result);
    } catch (err: any) {
      console.error("LinkedIn profile optimize error:", err);
      return res.status(500).json({ error: err.message || "Failed to optimize profile" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── BRAND INTEL — admin-trained voice & rules that feed every AI prompt ──
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/linkedin/brand-intel", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    try {
      const rows = await db.select().from(linkedinBrandIntel).where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      if (rows.length === 0) {
        // Return empty defaults so UI can render
        return res.json({
          brandStory: "",
          voiceRules: [],
          doNotSay: [],
          topicsLove: [],
          topicsAvoid: [],
          signaturePhrases: [],
          audienceNotes: "",
          preferredHashtags: [],
          version: 0,
        });
      }
      return res.json(rows[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to load brand intel" });
    }
  });

  app.put("/api/admin/linkedin/brand-intel", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const cleanArr = (v: any): string[] => Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean).slice(0, 50) : [];
    const payload = {
      adminUserId: adminId,
      brandStory: String(req.body?.brandStory || "").slice(0, 4000),
      voiceRules: cleanArr(req.body?.voiceRules),
      doNotSay: cleanArr(req.body?.doNotSay),
      topicsLove: cleanArr(req.body?.topicsLove),
      topicsAvoid: cleanArr(req.body?.topicsAvoid),
      signaturePhrases: cleanArr(req.body?.signaturePhrases),
      audienceNotes: String(req.body?.audienceNotes || "").slice(0, 2000),
      preferredHashtags: cleanArr(req.body?.preferredHashtags),
    };
    try {
      const existing = await db.select().from(linkedinBrandIntel).where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      if (existing.length === 0) {
        const [inserted] = await db.insert(linkedinBrandIntel).values(payload).returning();
        return res.json(inserted);
      }
      const [updated] = await db.update(linkedinBrandIntel)
        .set({ ...payload, version: (existing[0].version || 0) + 1, updatedAt: new Date() })
        .where(eq(linkedinBrandIntel.adminUserId, adminId))
        .returning();
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to save brand intel" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── EXAMPLES — few-shot library: gold posts, edited drafts, anti-examples
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/linkedin/examples", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    try {
      const rows = await db.select().from(linkedinPostExamples)
        .where(eq(linkedinPostExamples.adminUserId, adminId))
        .orderBy(desc(linkedinPostExamples.createdAt))
        .limit(100);
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to load examples" });
    }
  });

  app.post("/api/admin/linkedin/examples", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const { content, kind, reason, sourcePostId, postType, language } = req.body || {};
    if (!content || typeof content !== "string" || content.trim().length < 10) {
      return res.status(400).json({ error: "content required (min 10 chars)" });
    }
    const validKinds = ["gold", "edited", "avoid"];
    const safeKind = validKinds.includes(kind) ? kind : "gold";
    try {
      const [row] = await db.insert(linkedinPostExamples).values({
        adminUserId: adminId,
        content: content.trim().slice(0, 5000),
        kind: safeKind,
        reason: String(reason || "").slice(0, 500),
        sourcePostId: sourcePostId ? Number(sourcePostId) : null,
        postType: postType || null,
        language: language || "en",
      }).returning();
      return res.json(row);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to save example" });
    }
  });

  app.delete("/api/admin/linkedin/examples/:id", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
    try {
      await db.delete(linkedinPostExamples)
        .where(sql`${linkedinPostExamples.id} = ${id} AND ${linkedinPostExamples.adminUserId} = ${adminId}`);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to delete example" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── FEEDBACK — admin rates a published post; AI uses this to learn ──
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/admin/linkedin/posts/:id/feedback", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const id = Number(req.params.id);
    const { rating, notes } = req.body || {};
    if (!["up", "down", "neutral"].includes(rating)) {
      return res.status(400).json({ error: "rating must be up|down|neutral" });
    }
    try {
      const [post] = await db.select().from(linkedinPosts)
        .where(sql`${linkedinPosts.id} = ${id} AND ${linkedinPosts.adminUserId} = ${adminId}`).limit(1);
      if (!post) return res.status(404).json({ error: "post not found" });

      const feedback = { rating, notes: String(notes || "").slice(0, 500), at: new Date().toISOString() };
      const [updated] = await db.update(linkedinPosts)
        .set({ feedback: feedback as any })
        .where(eq(linkedinPosts.id, id))
        .returning();

      // If rated UP, auto-add to gold examples library (one-tap learning loop)
      if (rating === "up") {
        const dup = await db.select().from(linkedinPostExamples)
          .where(sql`${linkedinPostExamples.adminUserId} = ${adminId} AND ${linkedinPostExamples.sourcePostId} = ${id}`)
          .limit(1);
        if (dup.length === 0) {
          await db.insert(linkedinPostExamples).values({
            adminUserId: adminId,
            content: post.content,
            kind: "gold",
            reason: notes ? `Admin upvoted: ${String(notes).slice(0, 200)}` : "Admin upvoted",
            sourcePostId: id,
            postType: post.postType || null,
            language: "en",
          });
        }
      }
      return res.json({ success: true, post: updated });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to save feedback" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── AGENT MODE — multi-step: research → plan → 3 variants → self-critique ──
  // ══════════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════════
  // ── PLATFORM FACTS — live, accurate stats fed into every AI prompt ──
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/admin/linkedin/platform-facts", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const facts = await getPlatformFactsForDisplay();
      return res.json(facts);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to load platform facts" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── PENDING APPROVAL QUEUE — auto-posts awaiting admin sign-off ──
  // ══════════════════════════════════════════════════════════════════════════
  app.get("/api/admin/linkedin/pending-posts", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    try {
      const rows = await db.select().from(linkedinPosts)
        .where(sql`${linkedinPosts.adminUserId} = ${adminId} AND ${linkedinPosts.status} = 'pending_approval'`)
        .orderBy(desc(linkedinPosts.createdAt));
      return res.json(rows);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to load pending posts" });
    }
  });

  // EDIT a pending post (text only — imageUrl is intentionally NOT editable here
  // to prevent SSRF: any URL would later be fetched server-side by uploadImageToLinkedIn).
  app.patch("/api/admin/linkedin/pending-posts/:id", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const { content } = req.body || {};
    if (typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "Content required" });
    }
    if (content.length > 3000) return res.status(400).json({ error: "Content too long (max 3000 chars)" });
    try {
      // Conditional update: only mutate if still pending_approval and owned by this admin.
      const updated = await db.update(linkedinPosts)
        .set({ content: content.trim() })
        .where(sql`${linkedinPosts.id} = ${id} AND ${linkedinPosts.adminUserId} = ${adminId} AND ${linkedinPosts.status} = 'pending_approval'`)
        .returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: "Pending post not found (or already published/rejected)" });
      }
      return res.json(updated[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to update pending post" });
    }
  });

  // APPROVE & PUBLISH — atomic CAS pattern to prevent double-publish:
  //   1. Conditional UPDATE pending_approval → publishing (returns 0 rows if already taken).
  //   2. Publish to LinkedIn (network call, may fail).
  //   3. Final UPDATE publishing → published (or revert to pending_approval on failure).
  app.post("/api/admin/linkedin/pending-posts/:id/approve", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const [conn] = await db.select().from(linkedinConnections)
        .where(eq(linkedinConnections.adminUserId, adminId)).limit(1);
      if (!conn?.accessToken) return res.status(400).json({ error: "LinkedIn not connected" });

      // Step 1: Atomic claim — only one request can flip pending_approval → publishing.
      const claimed = await db.update(linkedinPosts)
        .set({ status: "publishing" })
        .where(sql`${linkedinPosts.id} = ${id} AND ${linkedinPosts.adminUserId} = ${adminId} AND ${linkedinPosts.status} = 'pending_approval'`)
        .returning();
      if (claimed.length === 0) {
        return res.status(409).json({ error: "Post is no longer pending approval (already published, rejected, or being processed)." });
      }
      const pending = claimed[0];

      // Step 2: Publish via LinkedIn API
      let result: { linkedinPostId: string };
      try {
        const { publishApprovedPost } = await import("./linkedinAutoPost");
        result = await publishApprovedPost({
          accessToken: conn.accessToken,
          linkedinId: conn.linkedinId,
          content: pending.content,
          imageUrl: pending.imageUrl || undefined,
        });
      } catch (publishErr: any) {
        // Step 2-fail: revert to pending_approval so admin can retry
        await db.update(linkedinPosts)
          .set({ status: "pending_approval" })
          .where(eq(linkedinPosts.id, id));
        console.error("[LinkedIn approve] publish failed (reverted to pending):", publishErr?.response?.data || publishErr.message);
        return res.status(500).json({ error: publishErr?.response?.data?.message || publishErr.message || "Failed to publish" });
      }

      // Step 3: Finalize — only mark published if we still own it (still in 'publishing' state)
      const finalized = await db.update(linkedinPosts)
        .set({ status: "published", linkedinPostId: result.linkedinPostId, publishedAt: new Date() })
        .where(sql`${linkedinPosts.id} = ${id} AND ${linkedinPosts.status} = 'publishing'`)
        .returning();
      // Even if finalize raced, post DID publish on LinkedIn — return success
      return res.json({ success: true, post: finalized[0] || { ...pending, linkedinPostId: result.linkedinPostId, status: "published" } });
    } catch (err: any) {
      console.error("[LinkedIn approve] unexpected error:", err?.response?.data || err.message);
      return res.status(500).json({ error: err?.response?.data?.message || err.message || "Failed to publish" });
    }
  });

  app.delete("/api/admin/linkedin/pending-posts/:id", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      // Conditional update: only reject if still pending (don't overwrite published/publishing rows)
      const rejected = await db.update(linkedinPosts)
        .set({ status: "rejected" })
        .where(sql`${linkedinPosts.id} = ${id} AND ${linkedinPosts.adminUserId} = ${adminId} AND ${linkedinPosts.status} = 'pending_approval'`)
        .returning();
      if (rejected.length === 0) {
        return res.status(404).json({ error: "Pending post not found (or already published)" });
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to reject pending post" });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ── NEW TOOLS ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── Connection Message Generator ─────────────────────────────────────────
  app.post("/api/admin/linkedin/connection-message", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const { name, role, organization, industry, city, purpose, tone, language } = req.body || {};
    if (!organization && !name) return res.status(400).json({ error: "organization or name required" });

    try {
      const [intel] = await db.select().from(linkedinBrandIntel).where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      const brandStory = intel?.brandStory || "Founder of Urban Culture Hub — a platform for urban sports, dance, and street culture in the Netherlands.";

      const toneLabel = tone === "formal" ? "formal and professional" : tone === "casual" ? "casual and friendly" : "warm and direct";
      const lang = language === "nl" ? "Dutch" : "English";

      const system = `You are writing LinkedIn connection request messages for Riki Almouti — founder of Urban Culture Hub. Messages must be in ${lang}, ${toneLabel}, under 300 characters (LinkedIn limit), specific, and human. Never generic. Always reference one concrete detail about the recipient. Never use emojis or "I'd love to connect" clichés.

About the sender: ${brandStory}`;

      const user = `Generate 3 different LinkedIn connection request messages for:
Name: ${name || "(not provided)"}
Role: ${role || "(not provided)"}
Organization: ${organization || "(not provided)"}
Industry: ${industry || "(not provided)"}
City: ${city || "(not provided)"}
Purpose: ${purpose || "networking / potential collaboration"}

Return JSON: { "messages": [{ "label": "Direct", "text": "..." }, { "label": "Curiosity-led", "text": "..." }, { "label": "Event-angle", "text": "..." }] }`;

      const completion = await aiChat({
        role: "linkedin",
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.8,
        maxTokens: 800,
        jsonMode: true,
      });

      let result: any = {};
      try { result = JSON.parse(completion.text || "{}"); } catch { result = {}; }
      return res.json({ success: true, messages: result.messages || [] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to generate messages" });
    }
  });

  // ── Hashtag Intelligence ──────────────────────────────────────────────────
  app.post("/api/admin/linkedin/hashtag-research", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const { topic, audience, language } = req.body || {};
    if (!topic) return res.status(400).json({ error: "topic required" });

    try {
      const [intel] = await db.select().from(linkedinBrandIntel).where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      const preferred = (intel?.preferredHashtags || []).join(" ");

      const system = `You are a LinkedIn hashtag research expert specializing in urban culture, bboy/breakdance, sports, and community-building in the Netherlands and Europe. Return well-researched hashtag recommendations with engagement context.`;

      const user = `Research the best LinkedIn hashtags for:
Topic: ${topic}
Target audience: ${audience || "municipalities, sponsors, cultural organizations"}
Language: ${language || "en"}
Existing brand hashtags (do not re-list these, just note which to combine): ${preferred || "(none set)"}

Return JSON:
{
  "primary": [{"tag": "#Tag", "followers": "~Xk", "why": "1 sentence"}],
  "secondary": [{"tag": "#Tag", "followers": "~Xk", "why": "1 sentence"}],
  "niche": [{"tag": "#Tag", "followers": "~Xk", "why": "1 sentence"}],
  "combinations": ["5-6 tag combos that work well together for this topic — 2-3 combos"],
  "tips": ["tip about hashtag strategy for this specific topic"]
}
primary: 3-4 high-reach tags. secondary: 4-5 mid-reach. niche: 3-4 tight community tags.`;

      const completion = await aiChat({
        role: "linkedin",
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.6,
        maxTokens: 1200,
        jsonMode: true,
      });

      let result: any = {};
      try { result = JSON.parse(completion.text || "{}"); } catch { result = {}; }
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to research hashtags" });
    }
  });

  // ── Content Planner ───────────────────────────────────────────────────────
  app.post("/api/admin/linkedin/content-planner", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const { weeks = 2, focus, language, postsPerWeek = 5 } = req.body || {};

    try {
      const [intel] = await db.select().from(linkedinBrandIntel).where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      const recentPosts = await db.select({ content: linkedinPosts.content, createdAt: linkedinPosts.createdAt })
        .from(linkedinPosts)
        .where(and(eq(linkedinPosts.adminUserId, adminId), eq(linkedinPosts.status, "published")))
        .orderBy(desc(linkedinPosts.createdAt)).limit(10);
      const factsBlock = await buildFactsBlock({ adminUserId: adminId, suggestAngle: false }).catch(() => ({ text: "" }));

      const brandCtx = intel?.brandStory ? `Brand context: ${intel.brandStory.slice(0, 500)}` : "Urban Culture Hub founder, Netherlands-based urban culture platform.";
      const recentCtx = recentPosts.length ? `\n\nRecent topics to avoid repeating: ${recentPosts.map(p => p.content.slice(0, 80)).join(" | ")}` : "";
      const focusCtx = focus ? `\n\nCurrent focus / priorities: ${focus}` : "";
      const lang = language === "nl" ? "Dutch" : "English";

      const system = `You are a LinkedIn content strategy expert. Create a detailed ${weeks}-week content calendar for a founder's LinkedIn presence. Posts in ${lang}. Vary content types, angles, and formats. Think about audience journey and building authority over time.`;

      const user = `${brandCtx}${recentCtx}${focusCtx}
${(factsBlock as any).text || ""}

Create a ${weeks}-week LinkedIn content calendar with ${postsPerWeek} posts per week.

Return JSON:
{
  "weeks": [
    {
      "week": 1,
      "theme": "Weekly theme",
      "posts": [
        {
          "day": "Monday",
          "type": "founder-story | insight | event-spotlight | data-point | community | platform-feature | partnership-angle",
          "hook": "Opening line (the scroll-stopper)",
          "angle": "What angle this post takes and why",
          "hashtags": ["#Tag1", "#Tag2", "#Tag3"],
          "contentPillar": "awareness | authority | community | conversion",
          "estimatedEngagement": "low | medium | high"
        }
      ]
    }
  ],
  "strategy": "2-3 sentence summary of the overall content strategy",
  "bestDays": ["best posting days in order"],
  "contentMix": {"founder-story": 20, "insight": 25, "community": 20, "platform-feature": 15, "event-spotlight": 10, "partnership-angle": 10}
}`;

      const completion = await aiChat({
        role: "linkedin",
        system,
        messages: [{ role: "user", content: user }],
        temperature: 0.7,
        maxTokens: 4000,
        jsonMode: true,
      });

      let result: any = {};
      try { result = JSON.parse(completion.text || "{}"); } catch { result = {}; }
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to generate content plan" });
    }
  });

  // ── Profile AI Brain (chat + apply) ──────────────────────────────────────
  app.post("/api/admin/linkedin/profile-brain", requireAdmin, async (req: Request, res: Response) => {
    const { messages = [], command = "chat", context = {}, language = "en" } = req.body || {};
    const lang = language === "nl" ? "Dutch" : "English";

    const sysChat = `You are a dedicated LinkedIn profile-building AI assistant helping ${context.name || "Riki Almouti"} build their complete LinkedIn profile through natural conversation. Write in ${lang}.

Your personality: Direct, smart, encouraging. Ask targeted follow-up questions to extract career details the user might not think to mention themselves.

Background you already know:
- Urban Culture Connect: Dutch urban culture social platform unifying breakdance, street sports, events, and community
- Riki Almouti: Founder & CEO — breakdancer, community builder, platform creator
- BTTS (Back to the Street): breakdancing event module within the platform
- Dutch municipalities, sponsors, cultural organizations: primary partners and clients
- Platform features: event management, marketplace, culture hub, real-time chat, class booking, artist profiles

Context provided by user:
Role: ${context.role || "Founder & CEO — Urban Culture Hub"}
Industry: ${context.industry || "Urban culture, breakdance, street sports, events, Netherlands"}
Target audience: ${context.audience || "Municipalities, sponsors, cultural organizations"}
Goals: ${context.goals || "Attract sponsors, grow platform, find partners"}

Your job in CHAT mode:
1. Help the user articulate their career, achievements, and professional identity through conversation
2. Ask smart follow-up questions: "What was the biggest result from that?", "How many people attended?", "Who did you work with there?"
3. Confirm key facts you extract and build on them
4. When you have enough material for a section, briefly summarize what you'd put in it
5. Keep responses concise — this is a chat, not an essay
6. When the user has shared enough, suggest: "I have enough to apply this to your profile — just click the Apply button"

DO NOT write full LinkedIn sections in chat. Just guide, extract, and confirm.`;

    const sysExtract = `You are a LinkedIn profile data extractor. Based on the conversation transcript below, extract ALL profile-relevant information and return it as structured JSON — ready to populate a complete LinkedIn profile for ${context.name || "Riki Almouti"}.

Background knowledge (supplement where conversation is sparse):
- Urban Culture Connect: Dutch urban culture platform, founded in Netherlands
- Riki Almouti: Founder, breakdancer, community builder, works with Dutch municipalities
- BTTS (Back to the Street) event module for breakdancing
- Stack: events management, marketplace, real-time features, AI integrations

Rules:
- Extract from the conversation first, supplement with background knowledge for gaps
- Write in ${lang}, first-person where appropriate
- Make each section LinkedIn-optimized (specific, keyword-rich, outcome-focused)
- If a section has no information at all, set it to ""
- For experiences/education: extract as array; if empty use []

Return ONLY valid JSON:
{
  "headline": "220-char LinkedIn headline",
  "about": "First-person About section with hook, story, mission, CTA",
  "skills": "Comma-separated skills list",
  "mission": "Personal mission statement (2-3 sentences)",
  "openTo": "What opportunities the person is open to",
  "services": "Services offered",
  "causes": "Causes and interests",
  "certifications": "Any certifications mentioned",
  "volunteer": "Volunteer work or community involvement",
  "projects": "Notable projects",
  "honors": "Awards or recognition",
  "languages": "Languages and proficiency",
  "experiences": [{"title":"","company":"","duration":"","location":"","description":""}],
  "education": [{"degree":"","field":"","institution":"","dates":"","description":""}]
}`;

    try {
      if (command === "apply") {
        // Extract structured profile data from conversation
        const transcript = messages.map((m: any) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
        const raw = await claudeProfileCall(sysExtract, `Conversation transcript:\n\n${transcript}\n\nExtract complete LinkedIn profile data:`, 4000);
        let result: any = {};
        try { result = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : {}; }
        return res.json({ success: true, type: "apply", ...result });
      } else {
        // Normal chat response
        const anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new anthropic();
        const apiMessages = messages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }));
        if (apiMessages.length === 0) {
          apiMessages.push({ role: "user", content: "Hello, I want to build my LinkedIn profile." });
        }
        const resp = await client.messages.create({ model: "claude-opus-4-5", max_tokens: 600, system: sysChat, messages: apiMessages });
        const reply = (resp.content[0] as any).text || "";
        return res.json({ success: true, type: "chat", reply });
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Brain request failed" });
    }
  });

  // ── Profile Section Enhancer (Claude) ────────────────────────────────────
  app.post("/api/admin/linkedin/profile-enhance", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const { section, currentContent, role, industry, targetAudience, goals, language, sectionLabel, preserveMode } = req.body || {};
    if (!section) return res.status(400).json({ error: "section required" });

    try {
      const [intel] = await db.select().from(linkedinBrandIntel).where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      const brandCtx = intel?.brandStory ? intel.brandStory.slice(0, 800) : "";
      const voiceCtx = intel?.voiceRules?.length ? `\nVoice rules: ${intel.voiceRules.join("; ")}` : "";
      const doNotCtx = intel?.doNotSay?.length ? `\nNever say: ${intel.doNotSay.join(", ")}` : "";
      const lang = language === "nl" ? "Dutch" : "English";

      type SectionGuide = { limit: string; tone: string; purpose: string; corrections: string; doList: string[]; dontList: string[] };
      const sectionGuides: Record<string, SectionGuide> = {
        headline: {
          limit: "220 characters",
          tone: "Bold, clear, keyword-rich. First-person implied. No fluff.",
          purpose: "Your LinkedIn headline is the most visible field after your name. LinkedIn's algorithm uses it for search ranking. It must communicate who you serve, what you do, and what makes you different — in one line.",
          corrections: "Fix vague titles like 'CEO', 'Founder', 'Entrepreneur'. Replace with specific value: who you help + how + outcome. Remove buzzwords with no substance (passionate, visionary, guru). Ensure primary keyword appears early.",
          doList: ["Include primary role + niche + outcome", "Use | or · to separate ideas", "Name the audience you serve", "Put highest-value keyword first"],
          dontList: ["Don't write just a job title", "Don't use vague adjectives (passionate, driven)", "Don't exceed 220 characters", "Don't use first person (I, my)"],
        },
        about: {
          limit: "2,600 characters",
          tone: "First-person, warm, authentic, founder voice. Hook → story → mission → proof → CTA.",
          purpose: "The About section is your pitch page. LinkedIn shows only the first ~300 characters before the 'see more' click — so the opening must hook immediately. This is where personality, mission, and credibility combine.",
          corrections: "Fix third-person writing (use I, not 'Riki is'). Remove corporate buzzwords. Ensure it opens with a hook (a bold statement, stat, or question — NOT 'I am a founder of…'). Add a CTA at the end. Break into short readable paragraphs.",
          doList: ["Start with a compelling hook (bold claim, question, or stat)", "Tell your founding story briefly", "Mention specific outcomes or community impact", "End with a clear call-to-action (DM me, visit, connect)", "Use line breaks — no walls of text"],
          dontList: ["Don't open with 'I am' or 'My name is'", "Don't write in third person", "Don't use buzzwords like 'passionate', 'results-driven'", "Don't write one giant paragraph", "Don't forget a CTA"],
        },
        experience_description: {
          limit: "2,000 characters per role",
          tone: "Achievement-oriented, specific, past-tense verbs. Bullets preferred.",
          purpose: "Experience descriptions show what you actually did and the results. Recruiters and partners scan bullets. LinkedIn's algorithm rewards keyword density here.",
          corrections: "Fix duty-listing (avoid 'responsible for…'). Replace with accomplishment bullets. Add numbers, scale, or outcomes where possible. Use past tense for past roles, present for current. Start each bullet with an action verb.",
          doList: ["Start bullets with action verbs (Built, Led, Launched, Grew)", "Include numbers: percentages, amounts, team sizes, reach", "Show outcomes, not just tasks", "Match keywords to your industry"],
          dontList: ["Don't write 'responsible for' or 'duties included'", "Don't use full sentences where bullets are cleaner", "Don't list every small task — curate for impact"],
        },
        experience_title: {
          limit: "100 characters",
          tone: "Clear, professional, searchable.",
          purpose: "Job titles are heavily indexed by LinkedIn search. They should be recognizable to outsiders, reflect actual authority, and include relevant keywords.",
          corrections: "Fix internal titles that mean nothing externally. Expand acronyms. Ensure the title matches what someone would search for to find you.",
          doList: ["Use industry-standard titles", "Add seniority where it adds credibility", "Include niche if it fits (e.g. 'Urban Culture Strategist')"],
          dontList: ["Don't use internal jargon or acronyms", "Don't be too vague (e.g. just 'Lead')", "Don't exceed 100 characters"],
        },
        skills: {
          limit: "Up to 50 skills, comma-separated",
          tone: "Keyword list — natural, algorithm-friendly.",
          purpose: "Skills directly affect LinkedIn search ranking. They're also endorsed by connections, boosting credibility. Mix hard skills, soft skills, and industry-specific terms.",
          corrections: "Remove generic skills (Microsoft Office, Teamwork) unless genuinely differentiating. Add domain-specific terms LinkedIn's algorithm rewards for your niche. Balance technical and leadership skills.",
          doList: ["Include industry-specific terms", "Add tools, platforms, methodologies", "Mix hard and soft skills", "Use terms people would actually search for"],
          dontList: ["Don't add obvious skills everyone has", "Don't exceed 50", "Don't duplicate skills with different wording"],
        },
        education_description: {
          limit: "1,000 characters",
          tone: "Concise, relevant-forward.",
          purpose: "Most people leave this blank. Use it to connect your education to your current work — coursework, thesis, notable achievements, or skills developed.",
          corrections: "Fix empty or irrelevant descriptions. Connect studies to current expertise. Mention any awards, notable projects, or relevant coursework.",
          doList: ["Connect studies to current role", "Mention relevant projects or thesis", "Include any awards or distinction"],
          dontList: ["Don't just repeat the degree name", "Don't write generic 'great experience' filler"],
        },
        mission: {
          limit: "300–600 characters recommended",
          tone: "Personal, purposeful, visionary. First-person. Short punchy sentences.",
          purpose: "A Personal Mission Statement on LinkedIn signals leadership depth and values alignment. Partners, sponsors, and municipalities want to know why you do what you do — not just what you do. This is not a company tagline; it's personal.",
          corrections: "Fix vague or corporate-sounding missions ('to create value', 'to make an impact'). Make it specific to your actual community and what changes because of your work. It should feel like something only you could have written.",
          doList: ["Name who you serve specifically", "Say what changes because of your work", "Make it personal — only you could write this", "Keep it under 600 characters for readability"],
          dontList: ["Don't use corporate buzzwords (synergy, leverage, impact-driven)", "Don't make it sound like a company slogan", "Don't be vague — 'make a difference' is not a mission"],
        },
        open_to: {
          limit: "300–500 characters recommended",
          tone: "Direct, welcoming, specific. Bullet-list or short sentence style.",
          purpose: "The Open To section signals to your network what kinds of connections and opportunities you welcome. On LinkedIn, being specific dramatically increases the quality of inbound messages.",
          corrections: "Fix vague 'open to opportunities' language. List specific types: speaking invitations, brand partnerships, media coverage, government/municipal collaboration, co-creation. Match to your actual goals.",
          doList: ["List specific opportunity types", "Mention your ideal collaboration partner profile", "Keep it concise — this is a signal, not an essay"],
          dontList: ["Don't say 'open to anything'", "Don't write a paragraph — clarity beats length here"],
        },
        services: {
          limit: "600–1,200 characters recommended",
          tone: "Confident, outcome-focused. Speaks to what the client gets, not what you do.",
          purpose: "The Services section is your pitch to potential clients and partners. It should clearly name what you offer, who it's for, and what they get. This feeds directly into LinkedIn's service search.",
          corrections: "Fix service descriptions that describe process instead of outcome. Focus on the result the client gets. Make services scannable — use short named service blocks. Ensure services match your profile's claimed expertise.",
          doList: ["Name each service clearly", "Say who it's for and what they get", "Use outcome language ('you get', 'results in')", "Make it scannable with clear service names"],
          dontList: ["Don't describe your process without naming the result", "Don't write services as a single block of text", "Don't include services you can't currently deliver"],
        },
        causes: {
          limit: "300–500 characters recommended",
          tone: "Values-driven, genuine, community-oriented.",
          purpose: "Causes & Interests humanize your profile and attract value-aligned partners and followers. For cultural and community work, this section can strongly differentiate you from purely commercial profiles.",
          corrections: "Fix generic causes (Education, Environment) with no personal link. Make the connection to your actual work explicit. Show how your causes connect to Urban Culture Connect's mission.",
          doList: ["Connect causes to your actual daily work", "Be specific — 'urban youth development' over 'youth'", "Show consistency between causes and the rest of your profile"],
          dontList: ["Don't list causes that have no relation to your work", "Don't list too many — 3–5 focused causes beat 15 generic ones"],
        },
        recommendations: {
          limit: "Template message, 300–600 characters",
          tone: "Warm, specific, easy to action.",
          purpose: "You can't write your own LinkedIn recommendations, but you can craft the perfect outreach message to ask for one. A well-crafted request gets a far better recommendation.",
          corrections: "Fix generic 'would you write me a rec?' messages. Be specific: reference your shared project, suggest what angle they could take, make it easy for the person to say yes and write something useful.",
          doList: ["Reference a specific shared project or moment", "Suggest what aspect they could speak to", "Keep it under 200 words", "Make it easy to say yes"],
          dontList: ["Don't send a generic copy-paste request", "Don't make it about your needs — make it easy for them"],
        },
        certifications: {
          limit: "400 characters per cert",
          tone: "Clear, factual, credibility-building.",
          purpose: "Certifications add verifiable credibility. LinkedIn shows them with logos if issued by recognized platforms.",
          corrections: "Fix missing issuers or dates. Add relevance note if the cert isn't obviously related to current work.",
          doList: ["Include issuer and year", "Note relevance if not obvious"],
          dontList: ["Don't list expired irrelevant certs", "Don't use informal course completions as formal certifications"],
        },
        volunteer: {
          limit: "1,000 characters",
          tone: "Community-oriented, leadership-focused.",
          purpose: "Volunteer work shows character, leadership, and community rootedness. For cultural founders, this section can be very powerful.",
          corrections: "Fix vague 'helped out' descriptions. Name your role, what you led or built, and the outcome or community served.",
          doList: ["Name your specific role and contributions", "Show leadership or initiative", "Connect to community impact"],
          dontList: ["Don't list passive participation", "Don't leave it blank if you do meaningful community work"],
        },
        projects: {
          limit: "2,000 characters",
          tone: "Achievement-focused, specific, proof-of-work.",
          purpose: "Projects give you a dedicated showcase space that's separate from your job history. Great for independent work, platform features, events, or initiatives.",
          corrections: "Fix vague project names or descriptions. Include your specific role, what you built, the scale, and the outcome. Add a URL if the project is live.",
          doList: ["Include your specific role", "Add measurable outcomes", "Name technologies, methods, or partners"],
          dontList: ["Don't describe a project without saying what your contribution was", "Don't skip outcomes"],
        },
        publications: {
          limit: "1,000 characters",
          tone: "Informative, credibility-building.",
          purpose: "Publications establish thought leadership. Even LinkedIn articles count here.",
          corrections: "Fix missing publishers or dates. Add a line about the key insight or why it matters to your audience.",
          doList: ["Include key insight", "Link to the publication if available", "Note the audience it was written for"],
          dontList: ["Don't list without context", "Don't forget to include the publisher"],
        },
        honors: {
          limit: "500 characters per award",
          tone: "Factual, specific, credibility-anchoring.",
          purpose: "Awards and honors signal recognition from external parties — which LinkedIn and visitors trust more than self-claims.",
          corrections: "Fix missing issuers or years. Ensure award names are spelled correctly and the issuing body is named.",
          doList: ["Include issuer, year, and why it matters", "Note if it was competitive (e.g. top 10 of 500)"],
          dontList: ["Don't list informal 'best employee' type awards unless prestigious", "Don't skip the issuing organization"],
        },
        featured: {
          limit: "300 characters per caption",
          tone: "Engaging, teaser-style.",
          purpose: "The Featured section is prime real estate at the top of your profile. Use it to showcase your best posts, articles, links, or media — things that prove your claims.",
          corrections: "Fix generic captions. Each featured item caption should tell the visitor what they'll get by clicking, not just describe what it is.",
          doList: ["Write captions that tease the value inside", "Feature items that prove your expertise", "Include a mix: post, article, external link"],
          dontList: ["Don't feature old or irrelevant items", "Don't leave captions blank or generic"],
        },
        creator_topics: {
          limit: "5 hashtags maximum",
          tone: "Strategic, algorithm-aware.",
          purpose: "Creator mode topics tell LinkedIn's algorithm what you post about, and match your content to the right follower communities. Choose carefully.",
          corrections: "Fix overly broad topics (#business, #leadership). Use more specific niche hashtags that have engaged communities and match your actual posting themes.",
          doList: ["Pick niche-specific tags", "Match to what you actually post", "Check hashtag follower counts on LinkedIn"],
          dontList: ["Don't use overly broad hashtags", "Don't exceed 5", "Don't pick hashtags you don't post about"],
        },
        contact_info: {
          limit: "Concise",
          tone: "Professional, clear, direct.",
          purpose: "Contact info makes it easy for the right people to reach you. A custom LinkedIn URL is also important for personal branding.",
          corrections: "Suggest a clean custom LinkedIn URL (linkedin.com/in/firstname-lastname). Recommend listing website, professional email, and phone if relevant.",
          doList: ["Set a custom LinkedIn URL", "List your primary professional website", "Include contact email if you want inbound"],
          dontList: ["Don't use a personal phone unless you want unsolicited calls", "Don't leave the URL as the auto-generated string of numbers"],
        },
        languages: {
          limit: "List of languages + proficiency",
          tone: "Factual, clear.",
          purpose: "Languages expand your audience and credibility, especially for Dutch/English bilingual founders working with international partners.",
          corrections: "Ensure proficiency levels are accurate. For bilingual founders working internationally, highlight dominant languages first.",
          doList: ["List all languages you genuinely use professionally", "Be accurate about proficiency levels"],
          dontList: ["Don't overstate proficiency", "Don't list languages you can only say hello in"],
        },
      };

      const guide = sectionGuides[section] || {
        limit: "varies", tone: "Professional, clear.", purpose: "Optimise for LinkedIn best practices.",
        corrections: "Fix grammar, tone, and LinkedIn formatting issues.", doList: ["Be specific and clear"], dontList: ["Avoid vague language"]
      };
      const displayName = sectionLabel || section.replace(/_/g, " ");

      const system = preserveMode
        ? `You are a LinkedIn copyeditor helping ${role || "a founder"} polish their "${displayName}" section. Write in ${lang}.

PRESERVE MODE — Your ONLY job: fix what's wrong, do NOT change what's right.
You MUST keep:
- Their content direction and focus (if they wrote about X, the result is still about X)
- Their personal voice and style
- The specific experiences, achievements, and facts they mentioned
- Their structure and flow

You MAY fix:
- Grammar and spelling errors
- Weak or vague phrasing (strengthen without changing meaning)
- Corporate buzzwords (replace with specific language)
- Missing LinkedIn keywords (add naturally, don't force)
- Formatting issues (line breaks, bullet starts)
- Character limit compliance (trim excess, never cut meaning)

Section purpose: ${guide.purpose}
Tone: ${guide.tone}
Limit: ${guide.limit}
${brandCtx ? `\nBrand context: ${brandCtx}` : ""}${voiceCtx}${doNotCtx}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation outside JSON.`
        : `You are a world-class LinkedIn profile coach and copywriter specializing in founder profiles for cultural, creative, and sports organizations. You write in ${lang}.

Your job has TWO parts:
1. DIAGNOSE what's wrong or could be stronger in the user's existing content (grammar, tone, LinkedIn conventions, keyword issues, missed opportunities).
2. REWRITE it as the best possible LinkedIn "${displayName}" section — human, specific, credibility-building, algorithm-aware.

Section purpose: ${guide.purpose}
Tone: ${guide.tone}
Character limit: ${guide.limit}
Correction focus: ${guide.corrections}
DO: ${guide.doList.join(" | ")}
DON'T: ${guide.dontList.join(" | ")}
${brandCtx ? `\nBrand context: ${brandCtx}` : ""}${voiceCtx}${doNotCtx}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation outside JSON.`;

      const user = preserveMode
        ? `Role: ${role || "Founder & CEO — Urban Culture Hub"}
Industry: ${industry || "Urban culture, breakdance, street sports, events, Netherlands"}
${currentContent ? `\nContent to polish (keep direction, fix issues):\n"""\n${currentContent}\n"""` : "\n(No content — write a concise starter that fits their role.)"}

Return JSON exactly:
{
  "enhanced": "The polished version — same direction, same voice, just improved",
  "corrections": ["Specific phrasing issue fixed and why", "Grammar or buzzword issue fixed", "Third issue if present"],
  "explanation": "1-2 sentences: what you fixed and why, confirming you kept their original direction",
  "alternatives": [],
  "tips": ["One LinkedIn tip specific to this section"]
}

IMPORTANT: The enhanced version must be recognizably similar to the original in content direction. If it is not, you have failed this task.`
        : `Role: ${role || "Founder & CEO — Urban Culture Hub"}
Industry: ${industry || "Urban culture, breakdance, street sports, events, Netherlands"}
Target audience: ${targetAudience || "Municipalities, sponsors, cultural organizations"}
Goals: ${goals || "Attract sponsors, grow platform, find partners, build thought leadership"}
${currentContent ? `\nExisting content to improve:\n"""\n${currentContent}\n"""` : "\n(No existing content — write a strong starter version from scratch using the context above.)"}

Return JSON exactly:
{
  "enhanced": "The fully optimized, ready-to-use LinkedIn text for this section",
  "corrections": ["Specific issue 1 found in the original text and why it weakens the profile", "Specific issue 2", "Specific issue 3 if present — omit if only 1-2 issues"],
  "explanation": "2-3 sentences explaining the main improvements made and the LinkedIn strategy behind them",
  "alternatives": ["A shorter or differently-toned version of the enhanced text", "A second alternative if a meaningfully different angle exists"],
  "tips": ["A specific LinkedIn tip for this section the user should know", "A second tip if genuinely useful — omit if not"]
}

If no existing content was provided, set corrections to an empty array and explain what you created and why in the explanation field.`;

      const raw = await claudeProfileCall(system, user, 3500);

      let result: any = {};
      try { result = JSON.parse(raw); } catch { result = { enhanced: raw, explanation: "", alternatives: [], tips: [] }; }
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to enhance section" });
    }
  });

  // ── Full Profile Builder (Claude) ─────────────────────────────────────────
  app.post("/api/admin/linkedin/profile-build", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const {
      name, role, industry, targetAudience, goals, language,
      headline, about, experiences, education, skills,
      certifications, volunteer, projects, publications, honors,
      languages: langs, contactInfo, featured, creatorTopics,
    } = req.body || {};

    try {
      const [intel] = await db.select().from(linkedinBrandIntel).where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      const brandCtx = intel?.brandStory ? intel.brandStory.slice(0, 800) : "";
      const voiceCtx = intel?.voiceRules?.length ? `Voice rules: ${intel.voiceRules.join("; ")}` : "";
      const doNotCtx = intel?.doNotSay?.length ? `Never say: ${intel.doNotSay.join(", ")}` : "";
      const lang = language === "nl" ? "Dutch" : "English";

      const system = `You are a world-class LinkedIn profile strategist for founders in urban culture, sports, and the creative economy. Write in ${lang}. Be specific, human, results-oriented. No jargon.${brandCtx ? `\n\nBrand context: ${brandCtx}` : ""}${voiceCtx ? `\n${voiceCtx}` : ""}${doNotCtx ? `\n${doNotCtx}` : ""}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation outside JSON.`;

      const sections = [
        headline ? `HEADLINE (current): ${headline}` : "",
        about ? `ABOUT (current): ${about}` : "",
        experiences?.length ? `EXPERIENCES:\n${experiences.map((e: any, i: number) => `${i+1}. ${e.title}${e.company ? ` @ ${e.company}` : ""}${e.duration ? ` (${e.duration})` : ""}${e.location ? ` — ${e.location}` : ""}${e.description ? `\n   ${e.description}` : ""}`).join("\n")}` : "",
        education?.length ? `EDUCATION:\n${education.map((e: any) => `• ${e.degree}${e.field ? ` in ${e.field}` : ""} @ ${e.institution}${e.dates ? ` (${e.dates})` : ""}${e.description ? `\n  ${e.description}` : ""}`).join("\n")}` : "",
        skills ? `SKILLS (raw input): ${skills}` : "",
        certifications ? `CERTIFICATIONS: ${certifications}` : "",
        volunteer ? `VOLUNTEER: ${volunteer}` : "",
        projects ? `PROJECTS: ${projects}` : "",
        publications ? `PUBLICATIONS: ${publications}` : "",
        honors ? `HONORS/AWARDS: ${honors}` : "",
        langs ? `LANGUAGES: ${langs}` : "",
        contactInfo ? `CONTACT INFO NOTES: ${contactInfo}` : "",
        featured ? `FEATURED SECTION NOTES: ${featured}` : "",
        creatorTopics ? `CREATOR TOPICS NOTES: ${creatorTopics}` : "",
      ].filter(Boolean).join("\n\n");

      const user = `Build a complete optimized LinkedIn profile for:
Name: ${name || "Riki Almouti"}
Role: ${role || "Founder & CEO — Urban Culture Hub"}
Industry: ${industry || "Urban culture, breakdance, street sports, events, Netherlands"}
Target audience: ${targetAudience || "Municipalities, sponsors, cultural organizations, community builders"}
Goals: ${goals || "Attract sponsors, grow platform, find partners, build thought leadership"}

CURRENT PROFILE CONTENT PROVIDED:
${sections || "(Build entirely from scratch based on role/industry/goals above.)"}

Return this EXACT JSON structure (all fields required, use empty arrays [] if not applicable):
{
  "headline": "Optimized headline max 220 chars",
  "about": "Full About section max 2600 chars — first-person, hook, story, mission, CTA",
  "experiences": [{"title":"","company":"","description":"3-5 achievement bullets with metrics"}],
  "education": [{"degree":"","institution":"","description":"Optimized description"}],
  "skills": {"featured":["Skill1","Skill2","Skill3"],"top3":["","",""],"core":["skill x15"]},
  "certifications": "Optimized certifications text",
  "volunteer": "Optimized volunteer section",
  "projects": "Optimized projects section",
  "publications": "Optimized publications section",
  "honors": "Optimized honors/awards section",
  "languages": ["Language — Proficiency level"],
  "featuredItems": [{"type":"post|link|media","caption":"","suggestion":""}],
  "creatorTopics": ["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5"],
  "recommendationRequest": "Template message to request a recommendation",
  "customUrl": "Suggested LinkedIn custom URL slug",
  "callToAction": "The CTA to use in headline/about",
  "profileStrengthTips": ["Quick win 1","Quick win 2","Quick win 3"]
}`;

      const raw = await claudeProfileCall(system, user, 6000);
      let result: any = {};
      try { result = JSON.parse(raw); } catch { result = { error: "JSON parse failed", raw }; }
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Failed to build profile" });
    }
  });

  // ── Context Card Enhance (Claude refines role/industry/audience/goals) ────
  app.post("/api/admin/linkedin/context-enhance", requireAdmin, async (req: Request, res: Response) => {
    const { name, role, industry, audience, goals, language } = req.body || {};
    const lang = language === "nl" ? "Dutch" : "English";
    const system = `You are a LinkedIn profile strategist specializing in Dutch urban culture, street sports, events, and creative industries. You help founders craft powerful, searchable LinkedIn profiles. Always respond in ${lang}.`;
    const user = `Improve these LinkedIn profile context fields for ${name || "this founder"} to be more compelling, keyword-rich, and LinkedIn-search-optimized.

Current values:
- Current Role: ${role || "(empty)"}
- Industry: ${industry || "(empty)"}
- Target Audience: ${audience || "(empty)"}
- Professional Goals: ${goals || "(empty)"}

Return ONLY a valid JSON object with these exact keys: role, industry, audience, goals.
Make each value specific, impactful, and optimized for LinkedIn discovery. Keep role under 220 chars, others concise.`;
    try {
      const raw = await claudeProfileCall(system, user, 700);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON in response");
      const data = JSON.parse(match[0]);
      return res.json({ success: true, ...data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Context enhancement failed" });
    }
  });

  // ── Auto-fill from system knowledge (Claude generates full starter profile) ─
  app.post("/api/admin/linkedin/profile-autofill", requireAdmin, async (req: Request, res: Response) => {
    const { language } = req.body || {};
    const lang = language === "nl" ? "Dutch" : "English";
    const system = `You are a LinkedIn profile expert. You have deep knowledge about the following person and their work:

ABOUT THE PERSON:
- Name: Riki Almouti
- Platform founder: Urban Culture Connect — a Dutch social platform unifying the urban culture community (breakdance, graffiti, street art, street sports, hip-hop, events, culture)
- Role: Founder & CEO, building this platform independently in the Netherlands
- Platform features: event management & ticketing, location discovery (interactive maps), service marketplace (artists, schedules), real-time chat, class bookings, multi-sport competitions, B-boy/breakdance events ("Back to the Street" — BTTS module), culture hub (Street Cred, Crews, Cypher Finder, Graffiti Wall, Beat Lab & Radio, Hall of Fame, Style Match, Style DNA), AI tools, LinkedIn outreach tools, admin moderation suite
- Mission: Fostering economic opportunities for urban culture community members, bridging community gaps, and centralizing cultural activities
- Target audience: Municipalities (Dutch gemeentes), cultural organizations, sponsors, urban athletes, artists, breakdancers, event organizers
- Location: Netherlands
- Unique angle: Bridging commercial/municipal world with underground urban culture community

Always write in ${lang}.`;

    const user = `Based on everything you know about this person, generate a complete LinkedIn profile starter. Return ONLY valid JSON with these exact keys:
{
  "role": "compelling current role title (max 100 chars)",
  "industry": "industry keywords for LinkedIn (max 100 chars)",
  "audience": "who they target professionally (max 150 chars)",
  "goals": "professional goals for LinkedIn networking (max 200 chars)",
  "headline": "powerful LinkedIn headline (max 220 chars, include keywords)",
  "about": "full LinkedIn About section (max 2000 chars, first-person, engaging, professional)",
  "skills": "top 20 relevant skills, comma-separated",
  "mission": "personal mission statement (2-3 powerful sentences)",
  "openTo": "professional opportunities they are open to: speaking, partnerships, investments, media, collaborations — be specific",
  "services": "services they/their platform provide to clients and organizations",
  "causes": "causes and values they stand behind professionally"
}
No markdown fences, no explanation. Only the JSON object.`;

    try {
      const raw = await claudeProfileCall(system, user, 3000);
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON in response");
      const data = JSON.parse(match[0]);
      return res.json({ success: true, ...data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Auto-fill failed" });
    }
  });

  app.post("/api/admin/linkedin/agent-generate", requireAdmin, async (req: Request, res: Response) => {
    const adminId = (req as any).admin?.id;
    const { topic, template, tone, language } = req.body || {};
    if (!topic || typeof topic !== "string") return res.status(400).json({ error: "topic required" });

    try {
      // 1. Pull brand intel
      const intelRows = await db.select().from(linkedinBrandIntel)
        .where(eq(linkedinBrandIntel.adminUserId, adminId)).limit(1);
      const intel = intelRows[0];

      // 2. Pull recent posts (avoid repetition) + gold examples (few-shot) + avoid examples
      const recentPosts = await db.select({ content: linkedinPosts.content, postType: linkedinPosts.postType })
        .from(linkedinPosts)
        .where(eq(linkedinPosts.adminUserId, adminId))
        .orderBy(desc(linkedinPosts.createdAt))
        .limit(5);
      const goldExamples = await db.select().from(linkedinPostExamples)
        .where(sql`${linkedinPostExamples.adminUserId} = ${adminId} AND ${linkedinPostExamples.kind} = 'gold'`)
        .orderBy(sql`RANDOM()`)
        .limit(3);
      const avoidExamples = await db.select().from(linkedinPostExamples)
        .where(sql`${linkedinPostExamples.adminUserId} = ${adminId} AND ${linkedinPostExamples.kind} = 'avoid'`)
        .limit(2);

      // 3. Build the agent prompt with all context
      const intelBlock = intel ? `
ADMIN-TRAINED BRAND INTEL (treat as the highest authority — overrides defaults):
${intel.brandStory ? `\n[BRAND STORY]\n${intel.brandStory}\n` : ""}
${intel.voiceRules?.length ? `\n[VOICE RULES — must obey]\n${intel.voiceRules.map((r: string) => "• " + r).join("\n")}\n` : ""}
${intel.doNotSay?.length ? `\n[DO NOT SAY — never use these]\n${intel.doNotSay.map((r: string) => "• " + r).join("\n")}\n` : ""}
${intel.topicsLove?.length ? `\n[TOPICS WE LEAN INTO]\n${intel.topicsLove.join(", ")}\n` : ""}
${intel.topicsAvoid?.length ? `\n[TOPICS WE AVOID]\n${intel.topicsAvoid.join(", ")}\n` : ""}
${intel.signaturePhrases?.length ? `\n[SIGNATURE PHRASES — feel free to use]\n${intel.signaturePhrases.map((r: string) => '"' + r + '"').join("\n")}\n` : ""}
${intel.audienceNotes ? `\n[AUDIENCE NOTES]\n${intel.audienceNotes}\n` : ""}
${intel.preferredHashtags?.length ? `\n[PREFERRED HASHTAGS]\n${intel.preferredHashtags.join(" ")}\n` : ""}` : "";

      const goldBlock = goldExamples.length ? `\n\n[GOLD EXAMPLES — admin marked these as the ideal voice; imitate their cadence, length, and energy]\n${goldExamples.map((e, i) => `--- GOLD #${i + 1} ---\n${e.content}`).join("\n\n")}` : "";
      const avoidBlock = avoidExamples.length ? `\n\n[AVOID EXAMPLES — admin marked these as off-brand; never write like this]\n${avoidExamples.map((e, i) => `--- AVOID #${i + 1} (${e.reason || "off-brand"}) ---\n${e.content}`).join("\n\n")}` : "";
      const recentBlock = recentPosts.length ? `\n\n[RECENT POSTS — do NOT repeat their hooks, angles, or opening lines]\n${recentPosts.map((p, i) => `${i + 1}. ${p.content.slice(0, 200)}…`).join("\n")}` : "";

      const lang = language === "nl" ? "Dutch" : language === "fr" ? "French" : language === "de" ? "German" : "English";
      const toneDesc = tone || "engaging";

      // Live platform brain (counts + feature graph + rotating angle for this admin)
      const factsBlock = await buildFactsBlock({ adminUserId: adminId, suggestAngle: true })
        .catch(() => ({ text: "", suggestedFeatureId: null as string | null, toString() { return ""; } }));

      const agentSystem = `You are an autonomous LinkedIn ghostwriting AGENT for Riki Almouti — founder of Urban Culture Hub.
Your job: think step-by-step, draft 3 distinct variants, then critique and rank them.

You write in ${lang}. Tone: ${toneDesc}.
${factsBlock.text}${intelBlock}${goldBlock}${avoidBlock}${recentBlock}

OUTPUT FORMAT (return ONLY valid JSON, no markdown fences):
{
  "research": "2-3 sentence summary of the angle landscape — what's been said, what's fresh",
  "plan": "1 sentence describing the strategic angle you'll take and why it lands now",
  "variants": [
    { "label": "Hook-led", "approach": "1-line description", "content": "the full LinkedIn post text" },
    { "label": "Story-led", "approach": "1-line description", "content": "the full LinkedIn post text" },
    { "label": "Insight-led", "approach": "1-line description", "content": "the full LinkedIn post text" }
  ],
  "critique": [
    { "variant": 0, "strengths": "...", "weaknesses": "...", "score": 0-10 },
    { "variant": 1, "strengths": "...", "weaknesses": "...", "score": 0-10 },
    { "variant": 2, "strengths": "...", "weaknesses": "...", "score": 0-10 }
  ],
  "recommendation": 0,
  "reasoning": "1-2 sentences why the recommended variant wins"
}

RULES for every variant:
- Max 1300 characters
- First sentence is THE HOOK — stop the scroll
- Short paragraphs (1-3 sentences)
- First-person ("I built", "I noticed")
- No corporate jargon, no "synergy", no "leverage"
- Each variant must use a clearly DIFFERENT structural approach
- End with 3-5 hashtags on their own line${intel?.preferredHashtags?.length ? " — prefer the brand hashtag bank" : ""}`;

      const userMsg = `TOPIC / BRIEF:
${topic}

TEMPLATE: ${template || "general"}

Now run the full agent loop. Return the JSON.`;

      const completion = await aiChat({
        role: "linkedin",
        system: agentSystem,
        messages: [{ role: "user", content: userMsg }],
        maxTokens: 3500,
        temperature: 0.85,
        jsonMode: true,
      });

      const raw = (completion.text || "").trim();
      let result: any;
      try {
        result = JSON.parse(raw);
      } catch {
        // Try to extract JSON from possible markdown fence
        const m = raw.match(/\{[\s\S]*\}/);
        result = m ? JSON.parse(m[0]) : { error: "Failed to parse agent output", raw };
      }

      // Bump usage counters for the gold examples we used
      if (goldExamples.length > 0) {
        const ids = goldExamples.map((e) => e.id);
        await db.execute(sql`UPDATE linkedin_post_examples SET usage_count = usage_count + 1 WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
      }

      return res.json({
        ...result,
        meta: {
          intelVersion: intel?.version || 0,
          goldExamplesUsed: goldExamples.length,
          avoidExamplesUsed: avoidExamples.length,
          recentPostsConsidered: recentPosts.length,
        },
      });
    } catch (err: any) {
      console.error("Agent generate error:", err);
      return res.status(500).json({ error: err.message || "Agent generation failed" });
    }
  });
}
