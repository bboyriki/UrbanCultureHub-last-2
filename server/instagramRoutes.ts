import { type Express, type Request, type Response } from "express";
import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { db } from "./db";
import { instagramConnections, reels, instagramAiActions, instagramAiPersona, type InsertInstagramAiAction } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { notifyIgNewComment, notifyIgMention, notifyIgDM } from "./instagramPush";
import { uploadImage, uploadBuffer, uploadImageWithProgress } from "./cloudinary";
import { compressVideo, cleanupCompressed } from "./videoCompress";

const igMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB — covers HD video clips
});

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "missing",
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

// App credentials — prefer DB-stored values (set via admin dashboard),
// fall back to env vars for backward-compatibility.
let _igAppId     = process.env.INSTAGRAM_APP_ID     || "";
let _igAppSecret = process.env.INSTAGRAM_APP_SECRET || "";

async function getAppCredentials(): Promise<{ appId: string; appSecret: string }> {
  try {
    const { appSettings } = await import("@shared/schema");
    const { db: _db } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const rows = await _db.select().from(appSettings)
      .where(eq(appSettings.key, "instagram_app_credentials")).limit(1);
    if (rows[0]?.value) {
      const stored = JSON.parse(rows[0].value) as { appId?: string; appSecret?: string };
      return {
        appId:     stored.appId     || _igAppId,
        appSecret: stored.appSecret || _igAppSecret,
      };
    }
  } catch { /* fall through */ }
  return { appId: _igAppId, appSecret: _igAppSecret };
}

// Module-level cache — refreshed after credential save
let _credCache: { appId: string; appSecret: string } | null = null;
async function getCreds() {
  if (!_credCache) _credCache = await getAppCredentials();
  return _credCache;
}
function invalidateCredCache() { _credCache = null; }

// Legacy sync accessors used inside sync functions — kept for existing code
const IG_APP_ID     = process.env.INSTAGRAM_APP_ID     || "";
const IG_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || "";

// Instagram Business Login endpoints (no Facebook Page required)
const IG_AUTH_URL   = "https://www.instagram.com/oauth/authorize";
const IG_TOKEN_URL  = "https://api.instagram.com/oauth/access_token";
const IG_GRAPH      = "https://graph.instagram.com";

// Facebook Graph API (used for media, insights, comments after connection)
const FB_GRAPH = "https://graph.facebook.com/v18.0";

function isConfigured() {
  // Fast sync check — actual credential resolution is async via getCreds()
  return !!(IG_APP_ID && IG_APP_SECRET) || !!(_credCache?.appId && _credCache?.appSecret);
}

function getRedirectUri(req: Request): string {
  if (process.env.INSTAGRAM_REDIRECT_URI) return process.env.INSTAGRAM_REDIRECT_URI;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
  return `${proto}://${host}/api/instagram/callback`;
}

async function getAllConnections(adminUserId: number) {
  return db.select().from(instagramConnections)
    .where(eq(instagramConnections.adminUserId, adminUserId))
    .orderBy(instagramConnections.connectedAt);
}

async function getConnection(adminUserId: number) {
  // Try active connection first
  const active = await db.select().from(instagramConnections)
    .where(and(eq(instagramConnections.adminUserId, adminUserId), eq(instagramConnections.isActive, true)))
    .limit(1);
  if (active[0]) return active[0];

  // Fallback: pick any connection and activate it
  const any = await db.select().from(instagramConnections)
    .where(eq(instagramConnections.adminUserId, adminUserId)).limit(1);
  if (any[0]) {
    await db.update(instagramConnections).set({ isActive: true }).where(eq(instagramConnections.id, any[0].id));
    return { ...any[0], isActive: true as boolean };
  }
  return null;
}

async function activateConnection(adminUserId: number, connectionId: number) {
  // Deactivate all connections for this admin
  await db.update(instagramConnections).set({ isActive: false })
    .where(eq(instagramConnections.adminUserId, adminUserId));
  // Activate the selected one
  await db.update(instagramConnections).set({ isActive: true })
    .where(and(eq(instagramConnections.id, connectionId), eq(instagramConnections.adminUserId, adminUserId)));
}

// Instagram Graph API (graph.instagram.com)
async function igGet(path: string, token: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params }).toString();
  const res = await axios.get(`${IG_GRAPH}/${path}?${qs}`);
  return res.data;
}

async function igPost(path: string, token: string, body: Record<string, unknown> = {}) {
  const res = await axios.post(`${IG_GRAPH}/${path}`, { ...body, access_token: token });
  return res.data;
}

// Facebook Graph API (graph.facebook.com) — for features that still need it
async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ access_token: token, ...params }).toString();
  const res = await axios.get(`${FB_GRAPH}/${path}?${qs}`);
  return res.data;
}

async function graphPost(path: string, token: string, body: Record<string, unknown> = {}) {
  const res = await axios.post(`${FB_GRAPH}/${path}`, { ...body, access_token: token });
  return res.data;
}

// Exchange short-lived Instagram token for long-lived token (60 days)
async function exchangeLongLived(shortToken: string) {
  const { appSecret } = await getCreds();
  const secret = appSecret || IG_APP_SECRET;
  const res = await axios.get(`${IG_GRAPH}/access_token`, {
    params: {
      grant_type: "ig_exchange_token",
      client_secret: secret,
      access_token: shortToken,
    },
  });
  return res.data as { access_token: string; expires_in?: number };
}

// Refresh an already-long-lived token (keeps it valid for another 60 days)
async function refreshLongLived(token: string) {
  const res = await axios.get(`${IG_GRAPH}/refresh_access_token`, {
    params: { grant_type: "ig_refresh_token", access_token: token },
  });
  return res.data as { access_token: string; expires_in?: number };
}

async function getIgUserInfo(igUserId: string, token: string) {
  return igGet(`${igUserId}`, token, {
    fields: [
      "id", "username", "name", "biography", "profile_picture_url",
      "followers_count", "follows_count", "media_count", "account_type", "website",
    ].join(","),
  });
}

const _scheduledPostsTable = "instagram_scheduled_posts";

async function dbQueryScheduled(query: string, params: any[] = []): Promise<any[]> {
  const { pool } = await import("./db");
  const result = await pool.query(query, params);
  return result.rows || [];
}

export function registerInstagramRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: Function) => void,
) {
  /* ── SCHEDULED POSTS CRUD ─────────────────────────────────────────────── */

  // GET /api/instagram/scheduled-posts
  app.get("/api/instagram/scheduled-posts", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const rows = await dbQueryScheduled(
        `SELECT id, admin_user_id as "adminUserId", media_type as "mediaType", media_url as "mediaUrl",
                caption, hashtags, scheduled_at as "scheduledAt", status,
                instagram_media_id as "instagramMediaId", permalink,
                error_message as "errorMessage", created_at as "createdAt",
                carousel_slides as "carouselSlides"
         FROM ${_scheduledPostsTable}
         WHERE admin_user_id = $1
         ORDER BY scheduled_at ASC`,
        [adminUserId],
      );
      res.json(rows.map(r => ({ ...r, carouselSlides: r.carouselSlides ? JSON.parse(r.carouselSlides) : null })));
    } catch (err: any) {
      console.error("[IG Schedule] GET error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/instagram/scheduled-posts
  app.post("/api/instagram/scheduled-posts", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { mediaType = "REELS", mediaUrl, caption = "", hashtags = "", scheduledAt, carouselSlides } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: "scheduledAt is required" });

    const VALID_TYPES = ["PHOTO", "VIDEO", "REELS", "CAROUSEL"];
    if (!VALID_TYPES.includes(mediaType)) return res.status(400).json({ error: `Invalid mediaType. Must be one of: ${VALID_TYPES.join(", ")}` });

    // For carousel posts, carouselSlides array is required; single mediaUrl is derived from first slide
    if (mediaType === "CAROUSEL") {
      const slides: string[] = Array.isArray(carouselSlides)
        ? carouselSlides.filter((s: string) => typeof s === "string" && s.trim())
        : [];
      if (slides.length < 2) return res.status(400).json({ error: "carousel requires at least 2 valid slide URLs" });
      const primaryUrl = slides[0];
      try {
        const rows = await dbQueryScheduled(
          `INSERT INTO ${_scheduledPostsTable}
             (admin_user_id, media_type, media_url, caption, hashtags, scheduled_at, status, carousel_slides)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
           RETURNING id, admin_user_id as "adminUserId", media_type as "mediaType", media_url as "mediaUrl",
                     caption, hashtags, scheduled_at as "scheduledAt", status,
                     instagram_media_id as "instagramMediaId", permalink,
                     error_message as "errorMessage", created_at as "createdAt",
                     carousel_slides as "carouselSlides"`,
          [adminUserId, "CAROUSEL", primaryUrl, caption.trim(), hashtags.trim(), new Date(scheduledAt), JSON.stringify(slides)],
        );
        const row = rows[0];
        res.status(201).json({ ...row, carouselSlides: JSON.parse(row.carouselSlides) });
      } catch (err: any) {
        console.error("[IG Schedule] POST carousel error:", err.message);
        res.status(500).json({ error: err.message });
      }
      return;
    }

    if (!mediaUrl?.trim()) return res.status(400).json({ error: "mediaUrl is required" });

    try {
      const rows = await dbQueryScheduled(
        `INSERT INTO ${_scheduledPostsTable}
           (admin_user_id, media_type, media_url, caption, hashtags, scheduled_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id, admin_user_id as "adminUserId", media_type as "mediaType", media_url as "mediaUrl",
                   caption, hashtags, scheduled_at as "scheduledAt", status,
                   instagram_media_id as "instagramMediaId", permalink,
                   error_message as "errorMessage", created_at as "createdAt"`,
        [adminUserId, mediaType, mediaUrl.trim(), caption.trim(), hashtags.trim(), new Date(scheduledAt)],
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      console.error("[IG Schedule] POST error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/instagram/scheduled-posts/bulk — schedule up to 7 posts at once
  app.post("/api/instagram/scheduled-posts/bulk", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const { posts } = req.body as { posts: Array<{ mediaType: string; mediaUrl: string; caption?: string; hashtags?: string; scheduledAt: string }> };
    if (!Array.isArray(posts) || posts.length === 0) return res.status(400).json({ error: "posts array required" });
    if (posts.length > 21) return res.status(400).json({ error: "Max 21 posts per bulk request" });
    const VALID_TYPES = ["PHOTO", "VIDEO", "REELS", "CAROUSEL", "STORY"];
    const errors: string[] = [];
    const inserted: any[] = [];
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      if (!VALID_TYPES.includes(p.mediaType)) { errors.push(`Post ${i + 1}: invalid mediaType`); continue; }
      if (!p.mediaUrl?.trim()) { errors.push(`Post ${i + 1}: mediaUrl required`); continue; }
      if (!p.scheduledAt) { errors.push(`Post ${i + 1}: scheduledAt required`); continue; }
      try {
        const rows = await dbQueryScheduled(
          `INSERT INTO ${_scheduledPostsTable}
             (admin_user_id, media_type, media_url, caption, hashtags, scheduled_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')
           RETURNING id, media_type as "mediaType", scheduled_at as "scheduledAt", status`,
          [adminUserId, p.mediaType, p.mediaUrl.trim(), (p.caption || "").trim(), (p.hashtags || "").trim(), new Date(p.scheduledAt)],
        );
        inserted.push(rows[0]);
      } catch (err: any) {
        errors.push(`Post ${i + 1}: ${err.message}`);
      }
    }
    res.status(201).json({ inserted, errors });
  });

  // PATCH /api/instagram/scheduled-posts/:id
  app.patch("/api/instagram/scheduled-posts/:id", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const { mediaType, mediaUrl, caption, hashtags, scheduledAt, status } = req.body;
    const VALID_TYPES = ["PHOTO", "VIDEO", "REELS", "CAROUSEL"];
    const VALID_STATUSES = ["pending", "publishing", "published", "failed"];
    if (mediaType && !VALID_TYPES.includes(mediaType)) return res.status(400).json({ error: `Invalid mediaType. Must be one of: ${VALID_TYPES.join(", ")}` });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const sets: string[] = ["updated_at = NOW()"];
    const vals: any[] = [id, adminUserId];
    let idx = 3;
    if (mediaType !== undefined) { sets.push(`media_type = $${idx++}`); vals.push(mediaType); }
    if (mediaUrl !== undefined) { sets.push(`media_url = $${idx++}`); vals.push(mediaUrl); }
    if (caption !== undefined) { sets.push(`caption = $${idx++}`); vals.push(caption); }
    if (hashtags !== undefined) { sets.push(`hashtags = $${idx++}`); vals.push(hashtags); }
    if (scheduledAt !== undefined) { sets.push(`scheduled_at = $${idx++}`); vals.push(new Date(scheduledAt)); }
    if (status !== undefined) { sets.push(`status = $${idx++}`); vals.push(status); }

    try {
      const rows = await dbQueryScheduled(
        `UPDATE ${_scheduledPostsTable} SET ${sets.join(", ")}
         WHERE id = $1 AND admin_user_id = $2
         RETURNING id, admin_user_id as "adminUserId", media_type as "mediaType", media_url as "mediaUrl",
                   caption, hashtags, scheduled_at as "scheduledAt", status,
                   instagram_media_id as "instagramMediaId", permalink,
                   error_message as "errorMessage", created_at as "createdAt"`,
        vals,
      );
      if (!rows[0]) return res.status(404).json({ error: "Post not found" });
      res.json(rows[0]);
    } catch (err: any) {
      console.error("[IG Schedule] PATCH error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/instagram/scheduled-posts/:id
  app.delete("/api/instagram/scheduled-posts/:id", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    try {
      await dbQueryScheduled(
        `DELETE FROM ${_scheduledPostsTable} WHERE id = $1 AND admin_user_id = $2`,
        [id, adminUserId],
      );
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[IG Schedule] DELETE error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/instagram/scheduled-posts/:id/publish-now — immediately publish a pending/failed post
  app.post("/api/instagram/scheduled-posts/:id/publish-now", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    try {
      const { pool } = await import("./db");
      const result = await pool.query(
        `SELECT * FROM ${_scheduledPostsTable} WHERE id = $1 AND admin_user_id = $2`,
        [id, adminUserId],
      );
      const post = result.rows[0];
      if (!post) return res.status(404).json({ error: "Scheduled post not found" });
      if (post.status === "publishing") return res.status(409).json({ error: "Already publishing" });

      await pool.query(
        `UPDATE ${_scheduledPostsTable} SET status = 'publishing', updated_at = NOW() WHERE id = $1`,
        [id],
      );

      const conn = await getConnection(adminUserId);
      if (!conn) throw new Error("No active Instagram connection");

      const FB_GRAPH = "https://graph.facebook.com/v18.0";
      const token = conn.accessToken;
      const igUserId = conn.instagramUserId;
      const fullCaption = [post.caption || "", post.hashtags || ""].filter(Boolean).join("\n\n");
      const mediaType: string = post.media_type || "PHOTO";
      const mediaUrl: string = post.media_url;

      let containerId: string;

      if (mediaType === "CAROUSEL" && post.carousel_slides) {
        // Carousel: create child containers then a carousel container
        const slides: string[] = JSON.parse(post.carousel_slides);
        if (slides.length < 2) throw new Error("Carousel requires at least 2 slides");
        const childIds: string[] = [];
        for (const slideUrl of slides) {
          const childRes = await axios.post(`${FB_GRAPH}/${igUserId}/media`, null, {
            params: { image_url: slideUrl, is_carousel_item: "true", access_token: token },
          });
          childIds.push(childRes.data.id);
        }
        const carouselRes = await axios.post(`${FB_GRAPH}/${igUserId}/media`, null, {
          params: { media_type: "CAROUSEL", caption: fullCaption, children: childIds.join(","), access_token: token },
        });
        containerId = carouselRes.data.id;
      } else {
        const containerParams: Record<string, string> = { caption: fullCaption, access_token: token };
        if (mediaType === "REELS") {
          containerParams.media_type = "REELS";
          containerParams.video_url = mediaUrl;
          containerParams.share_to_feed = "true";
        } else if (mediaType === "VIDEO") {
          containerParams.media_type = "VIDEO";
          containerParams.video_url = mediaUrl;
        } else if (mediaType === "STORY") {
          containerParams.media_type = "STORIES";
          const isVideoUrl = /\.(mp4|mov|avi|webm|m4v)(\?|$)/i.test(mediaUrl);
          if (isVideoUrl) containerParams.video_url = mediaUrl;
          else containerParams.image_url = mediaUrl;
        } else {
          containerParams.image_url = mediaUrl;
        }
        const containerRes = await axios.post(`${FB_GRAPH}/${igUserId}/media`, null, { params: containerParams });
        containerId = containerRes.data.id;
      }

      const isVideoStory = mediaType === "STORY" && /\.(mp4|mov|avi|webm|m4v)(\?|$)/i.test(mediaUrl);
      if (mediaType === "REELS" || mediaType === "VIDEO" || isVideoStory) {
        let ready = false;
        for (let attempt = 0; attempt < 20 && !ready; attempt++) {
          await new Promise(r => setTimeout(r, 6000));
          const statusRes = await axios.get(`${FB_GRAPH}/${containerId}`, {
            params: { fields: "status_code", access_token: token },
          });
          if (statusRes.data.status_code === "FINISHED") ready = true;
          else if (statusRes.data.status_code === "ERROR") throw new Error("Video encoding failed");
        }
        if (!ready) throw new Error("Timeout waiting for video encoding");
      }

      const publishRes = await axios.post(`${FB_GRAPH}/${igUserId}/media_publish`, null, {
        params: { creation_id: containerId, access_token: token },
      });
      const instagramMediaId: string = publishRes.data.id;

      let permalink: string | null = null;
      try {
        const plRes = await axios.get(`${FB_GRAPH}/${instagramMediaId}`, {
          params: { fields: "permalink", access_token: token },
        });
        permalink = plRes.data?.permalink || null;
      } catch { /* non-critical */ }

      await pool.query(
        `UPDATE ${_scheduledPostsTable} SET status = 'published', instagram_media_id = $2, permalink = $3, updated_at = NOW() WHERE id = $1`,
        [id, instagramMediaId, permalink],
      );
      res.json({ ok: true, mediaId: instagramMediaId, permalink });
    } catch (err: any) {
      const { pool } = await import("./db");
      await pool.query(
        `UPDATE ${_scheduledPostsTable} SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
        [id, (err.message || "Unknown error").slice(0, 500)],
      ).catch(() => {});
      console.error("[IG Schedule] publish-now failed:", err.message);
      res.status(500).json({ error: err?.response?.data?.error?.message || err.message });
    }
  });

  /* ── PATCH /api/instagram/profile — update bio + website ─────────────────── */
  app.patch("/api/instagram/profile", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "No active Instagram connection" });

    const bio: string | undefined = req.body?.biography !== undefined ? String(req.body.biography).trim() : undefined;
    const website: string | undefined = req.body?.website !== undefined ? String(req.body.website).trim() : undefined;

    if (bio !== undefined && bio.length > 150) {
      return res.status(400).json({ error: "Biography may not exceed 150 characters" });
    }

    const results: Record<string, any> = {};

    // Attempt to update bio via Graph API
    if (bio !== undefined) {
      try {
        await axios.post(
          `https://graph.facebook.com/v18.0/${conn.instagramUserId}`,
          null,
          { params: { biography: bio, access_token: conn.accessToken } },
        );
        results.biography = { success: true, value: bio };
      } catch (err: any) {
        const apiErr = err?.response?.data?.error;
        const isApiLimit = apiErr?.code === 100 || apiErr?.code === 190 ||
          (apiErr?.message || "").toLowerCase().includes("unsupported") ||
          (apiErr?.message || "").toLowerCase().includes("permission");
        results.biography = {
          success: false,
          apiLimitation: isApiLimit,
          message: isApiLimit
            ? "Instagram API limitation: bio update requires instagram_manage_profile permission via Facebook Login. Saved locally."
            : (apiErr?.message || err.message),
          value: bio,
        };
      }
      // Always persist locally
      await db.update(instagramConnections)
        .set({ biography: bio, updatedAt: new Date() })
        .where(eq(instagramConnections.id, conn.id));
    }

    // Attempt to update website via Graph API
    if (website !== undefined) {
      try {
        await axios.post(
          `https://graph.facebook.com/v18.0/${conn.instagramUserId}`,
          null,
          { params: { website, access_token: conn.accessToken } },
        );
        results.website = { success: true, value: website };
      } catch (err: any) {
        const apiErr = err?.response?.data?.error;
        results.website = {
          success: false,
          apiLimitation: true,
          message: "Instagram API limitation: website update requires instagram_manage_profile permission.",
          value: website,
        };
      }
      // Always persist locally regardless of API result
      await db.update(instagramConnections)
        .set({ website, updatedAt: new Date() })
        .where(eq(instagramConnections.id, conn.id));
    }

    res.json({ ok: true, results });
  });

  /* ── configuration status ─────────────────────────────────────────────── */
  app.get("/api/instagram/config", requireAdmin, (_req, res) => {
    res.json({
      configured: isConfigured(),
      hasDirectToken: !!process.env.INSTAGRAM_ACCESS_TOKEN,
    });
  });

  /* ── Connect via direct access token (supports multiple accounts) ──────── */
  app.post("/api/instagram/connect/token", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const token: string = (req.body?.access_token as string) || process.env.INSTAGRAM_ACCESS_TOKEN || "";
    const label: string = (req.body?.label as string) || "";
    if (!token) return res.status(400).json({ error: "Geen access token beschikbaar. Voer een token in of stel INSTAGRAM_ACCESS_TOKEN in." });

    // ── Resolve the token to Instagram account info ───────────────────────
    // Tokens come in several forms:
    //   A) Instagram User Access Token  → graph.instagram.com/me works directly
    //   B) Facebook User/Page/System token → must resolve via graph.facebook.com
    //      then extract instagram_business_account
    // We try A first; if it gives "Invalid OAuth access token" we fall through to B.

    let info: any = null;
    let resolvedToken = token; // The token we'll actually store (may become page token from B)
    let tokenType = "instagram";

    // ── Attempt A: Instagram native token ────────────────────────────────
    try {
      info = await igGet("me", token, {
        fields: "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,account_type,website",
      });
      console.log(`[Instagram connect] Attempt A (native) succeeded for @${info.username}`);
    } catch (errA: any) {
      const codeA = errA?.response?.data?.error?.code;
      const msgA  = errA?.response?.data?.error?.message || errA.message;
      console.log(`[Instagram connect] Attempt A failed (code=${codeA}): ${msgA}`);

      // ── Attempt B: Facebook token → resolve Instagram Business Account ──
      try {
        // First get the user's Facebook pages and their linked IG accounts
        const fbMe = await graphGet("me", token, {
          fields: "id,name,accounts{id,name,access_token,instagram_business_account{id,username,name,biography,profile_picture_url,followers_count,media_count}}",
        });

        // Walk pages to find one with an instagram_business_account
        const pages: any[] = fbMe?.accounts?.data || [];
        console.log(`[Instagram connect] Attempt B: found ${pages.length} Facebook Page(s) for this token`);
        pages.forEach((p: any) => console.log(`  Page: ${p.name} (${p.id}) → IG: ${p.instagram_business_account?.id || "none"}`));

        let igBiz: any = null;
        let pageToken = token; // keep page token for discovery only
        for (const page of pages) {
          if (page?.instagram_business_account?.id) {
            igBiz     = page.instagram_business_account;
            pageToken = page.access_token || token;
            break;
          }
        }

        // Fallback: token might already be a Page token — try direct IG lookup on FB graph
        if (!igBiz) {
          const directBiz = await graphGet("me", token, {
            fields: "instagram_business_account{id,username,name,biography,profile_picture_url,followers_count,media_count}",
          });
          igBiz = directBiz?.instagram_business_account || null;
          if (igBiz) console.log(`[Instagram connect] Attempt B: found IG via direct page-token lookup: @${igBiz.username}`);
        }

        if (!igBiz?.id) {
          const pagesFound = pages.length;
          const pagesWithoutIg = pages.filter((p: any) => !p.instagram_business_account?.id).map((p: any) => p.name);
          let errorMsg: string;
          if (pagesFound === 0) {
            errorMsg = `Facebook-token herkend, maar dit account heeft geen Facebook Pagina's. Om via een Facebook-token te koppelen heb je een Facebook Pagina nodig die gekoppeld is aan je Instagram Business/Creator-account in Meta Business Suite.\n\nAlternatief: gebruik de knop "Verbinden met Instagram Business" in de admin — dat werkt ook zonder Facebook Pagina.`;
          } else {
            errorMsg = `Facebook-token herkend. ${pagesFound} pagina('s) gevonden (${pagesWithoutIg.join(", ")}), maar geen van deze heeft een Instagram Business-account gekoppeld.\n\nGa naar Meta Business Suite → Instellingen → Instagram-accounts en koppel je Instagram-account aan een van deze pagina's. Of gebruik de knop "Verbinden met Instagram Business" in de admin.`;
          }
          return res.status(400).json({ error: errorMsg, tokenType: "facebook_no_ig" });
        }

        info = {
          id: igBiz.id,
          username: igBiz.username,
          name: igBiz.name,
          biography: igBiz.biography,
          profile_picture_url: igBiz.profile_picture_url,
          followers_count: igBiz.followers_count,
          media_count: igBiz.media_count,
          account_type: igBiz.account_type || "BUSINESS",
        };
        // IMPORTANT: Instagram Graph API media/insights calls require the User Access Token,
        // NOT the page-scoped token. The page token only works for page management endpoints.
        // We store the original user token so that all subsequent IG API calls succeed.
        resolvedToken = token;
        tokenType = "facebook_page";
        console.log(`[Instagram connect] Attempt B (FB→IG) succeeded for @${info.username}`);
      } catch (errB: any) {
        const msgB = errB?.response?.data?.error?.message || errB.message;
        console.error(`[Instagram connect] Attempt B also failed: ${msgB}`);

        // Return a detailed error showing what both attempts said
        return res.status(502).json({
          error: `Token ongeldig voor zowel Instagram als Facebook Graph API.\n\nInstagram API zei: "${msgA}"\nFacebook API zei: "${msgB}"\n\nZorg dat je een geldig Instagram User token OF een Facebook Page token plakt die gekoppeld is aan een Instagram Business/Creator-account.`,
          tokenType: "unknown",
        });
      }
    }

    // ── Save / update the connection ──────────────────────────────────────
    try {
      const igUserId: string = String(info.id);
      const allConns = await getAllConnections(adminUserId);
      const sameIg = allConns.find(c => c.instagramUserId === igUserId);
      const optimisticExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      if (sameIg) {
        await db.update(instagramConnections)
          .set({ accessToken: resolvedToken, tokenExpiresAt: optimisticExpiry,
            username: info.username, name: info.name,
            profilePictureUrl: info.profile_picture_url, biography: info.biography,
            followersCount: info.followers_count, mediaCount: info.media_count,
            accountType: info.account_type || "BUSINESS", label: label || sameIg.label || null,
            updatedAt: new Date() })
          .where(eq(instagramConnections.id, sameIg.id));
        await activateConnection(adminUserId, sameIg.id);
        console.log(`[Instagram] Token refreshed for @${info.username} (type=${tokenType})`);
        res.json({ ok: true, username: info.username, instagramUserId: igUserId, isNew: false, tokenType });
      } else {
        await db.update(instagramConnections).set({ isActive: false })
          .where(eq(instagramConnections.adminUserId, adminUserId));
        await db.insert(instagramConnections).values({
          adminUserId, instagramUserId: igUserId, pageId: null, accessToken: resolvedToken,
          tokenExpiresAt: optimisticExpiry, username: info.username, name: info.name,
          profilePictureUrl: info.profile_picture_url, biography: info.biography,
          followersCount: info.followers_count, mediaCount: info.media_count,
          accountType: info.account_type || "BUSINESS", isActive: true,
          label: label || null,
        });
        console.log(`[Instagram] New account connected: @${info.username} (${igUserId}, type=${tokenType})`);
        res.json({ ok: true, username: info.username, instagramUserId: igUserId, isNew: true, tokenType });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message || "Token validation failed";
      console.error("[Instagram connect/token save error]", msg);
      res.status(502).json({ error: msg });
    }
  });

  /* ── List all connected accounts ──────────────────────────────────────── */
  app.get("/api/instagram/accounts", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conns = await getAllConnections(adminUserId);
    res.json(conns.map(c => ({
      id: c.id, instagramUserId: c.instagramUserId, username: c.username, name: c.name,
      profilePictureUrl: c.profilePictureUrl, followersCount: c.followersCount,
      mediaCount: c.mediaCount, accountType: c.accountType, isActive: c.isActive,
      label: c.label, connectedAt: c.connectedAt,
    })));
  });

  /* ── Switch active account ─────────────────────────────────────────────── */
  app.put("/api/instagram/accounts/:id/activate", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const connectionId = parseInt(req.params.id);
    if (isNaN(connectionId)) return res.status(400).json({ error: "Invalid ID" });
    await activateConnection(adminUserId, connectionId);
    const newActive = await getConnection(adminUserId);
    console.log(`[Instagram] Switched active account to @${newActive?.username}`);
    res.json({ ok: true, username: newActive?.username });
  });

  /* ── Remove a specific account ─────────────────────────────────────────── */
  app.delete("/api/instagram/accounts/:id", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const connectionId = parseInt(req.params.id);
    if (isNaN(connectionId)) return res.status(400).json({ error: "Invalid ID" });

    const allConns = await getAllConnections(adminUserId);
    const target = allConns.find(c => c.id === connectionId);
    if (!target) return res.status(404).json({ error: "Account niet gevonden" });

    await db.delete(instagramConnections)
      .where(and(eq(instagramConnections.id, connectionId), eq(instagramConnections.adminUserId, adminUserId)));

    // If we deleted the active one, activate another
    if (target.isActive) {
      const remaining = allConns.filter(c => c.id !== connectionId);
      if (remaining.length > 0) {
        await db.update(instagramConnections).set({ isActive: true })
          .where(eq(instagramConnections.id, remaining[0].id));
      }
    }
    res.json({ ok: true });
  });

  /* ── Update account label ──────────────────────────────────────────────── */
  app.patch("/api/instagram/accounts/:id/label", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const connectionId = parseInt(req.params.id);
    const { label } = req.body as { label: string };
    await db.update(instagramConnections).set({ label: label || null })
      .where(and(eq(instagramConnections.id, connectionId), eq(instagramConnections.adminUserId, adminUserId)));
    res.json({ ok: true });
  });

  /* ── Setup info — redirect URI + required scopes (for Settings UI) ──── */
  app.get("/api/instagram/setup-info", requireAdmin, (req: Request, res: Response) => {
    const redirectUri = getRedirectUri(req);
    res.json({
      redirectUri,
      scopes: [
        "instagram_business_basic",
        "instagram_business_content_publish",
        "instagram_business_manage_comments",
        "instagram_business_manage_insights",
      ],
      authUrl: "https://www.instagram.com/oauth/authorize",
      metaAppsUrl: "https://developers.facebook.com/apps/",
    });
  });

  /* ── OAuth: generate auth URL ─────────────────────────────────────────── */
  app.get("/api/instagram/auth/url", requireAdmin, (req: Request, res: Response) => {
    if (!isConfigured()) {
      return res.status(503).json({ error: "Instagram App ID / Secret not configured." });
    }
    const redirectUri = getRedirectUri(req);
    const scopes = [
      "instagram_business_basic",
      "instagram_business_content_publish",
      "instagram_business_manage_comments",
      "instagram_business_manage_insights",
    ].join(",");
    const url =
      `${IG_AUTH_URL}` +
      `?client_id=${IG_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code` +
      `&state=${Date.now()}`;
    res.json({ url, redirectUri });
  });

  /* ── OAuth: callback ──────────────────────────────────────────────────── */
  /** Serve a self-closing HTML page for the OAuth popup */
  const popupPage = (success: boolean, message: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${success ? "Connected!" : "Error"}</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:${success ? "#f0fdf4" : "#fff1f2"}}
  .card{text-align:center;padding:32px;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:340px}
  .icon{font-size:48px;margin-bottom:16px}
  h2{margin:0 0 8px;color:${success ? "#16a34a" : "#dc2626"}}
  p{margin:0;color:#6b7280;font-size:14px}
</style>
</head>
<body>
<div class="card">
  <div class="icon">${success ? "✅" : "❌"}</div>
  <h2>${success ? "Instagram Connected!" : "Connection Failed"}</h2>
  <p>${message}</p>
  <p style="margin-top:12px;font-size:12px;color:#9ca3af">This window will close automatically…</p>
</div>
<script>setTimeout(()=>window.close(),2000);</script>
</body>
</html>`;

  app.get("/api/instagram/callback", async (req: Request, res: Response) => {
    const { code, error, error_description, error_code, error_message } = req.query as Record<string, string>;
    const session = (req as any).session;
    console.log("[Instagram callback] query:", req.query);
    console.log("[Instagram callback] session userId:", session?.userId);
    if (error || error_code) {
      const msg = error_message || error_description || error || "Unknown error";
      return res.send(popupPage(false, `Instagram error: ${msg}`));
    }
    if (!code) return res.send(popupPage(false, "No authorization code received."));

    try {
      const redirectUri = getRedirectUri(req);
      const { appId, appSecret } = await getCreds();
      const effectiveAppId     = appId     || IG_APP_ID;
      const effectiveAppSecret = appSecret || IG_APP_SECRET;

      // 1. Exchange code → short-lived token via Instagram's token endpoint (POST form)
      const tokenRes = await axios.post(
        IG_TOKEN_URL,
        new URLSearchParams({
          client_id: effectiveAppId,
          client_secret: effectiveAppSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );
      const shortToken: string = tokenRes.data.access_token;
      const igUserId: string = String(tokenRes.data.user_id);
      console.log("[Instagram callback] short token obtained, user_id:", igUserId);

      // 2. Exchange → long-lived token (60 days)
      const longTokenData = await exchangeLongLived(shortToken);
      const accessToken = longTokenData.access_token;
      const expiresAt = longTokenData.expires_in
        ? new Date(Date.now() + longTokenData.expires_in * 1000)
        : null;

      // 3. Fetch IG user info directly from graph.instagram.com
      const igInfo = await getIgUserInfo(igUserId, accessToken);
      console.log("[Instagram callback] user info:", igInfo?.username, igInfo?.account_type);

      // 4. Get admin user from session
      const adminUserId = session?.userId as number | undefined;
      if (!adminUserId) return res.send(popupPage(false, "Session expired. Please log in again and retry."));

      // 5. Upsert connection in DB (multi-account aware)
      const allConns = await getAllConnections(adminUserId);
      const sameIg = allConns.find(c => c.instagramUserId === igUserId);
      if (sameIg) {
        await db.update(instagramConnections)
          .set({ accessToken, tokenExpiresAt: expiresAt, username: igInfo.username, name: igInfo.name,
            profilePictureUrl: igInfo.profile_picture_url, biography: igInfo.biography,
            followersCount: igInfo.followers_count, mediaCount: igInfo.media_count,
            accountType: igInfo.account_type, updatedAt: new Date() })
          .where(eq(instagramConnections.id, sameIg.id));
        await activateConnection(adminUserId, sameIg.id);
      } else {
        await db.update(instagramConnections).set({ isActive: false })
          .where(eq(instagramConnections.adminUserId, adminUserId));
        await db.insert(instagramConnections).values({
          adminUserId, instagramUserId: igUserId, pageId: null, accessToken,
          tokenExpiresAt: expiresAt, username: igInfo.username, name: igInfo.name,
          profilePictureUrl: igInfo.profile_picture_url, biography: igInfo.biography,
          followersCount: igInfo.followers_count, mediaCount: igInfo.media_count,
          accountType: igInfo.account_type || "BUSINESS", isActive: true,
        });
      }

      res.send(popupPage(true, `@${igInfo.username || igUserId} connected successfully!`));
    } catch (err: any) {
      console.error("[Instagram callback error]", err?.response?.data || err.message);
      const msg = err?.response?.data?.error?.message || err?.response?.data?.error_message || err.message || "OAuth failed. Check your Instagram App settings.";
      res.send(popupPage(false, msg));
    }
  });

  /* ── signed upload params for direct browser → Cloudinary upload ───────
     Returns the Cloudinary signed params so the browser can upload directly
     to Cloudinary — bypassing the Replit proxy size limit entirely.        */
  app.get("/api/instagram/upload-signature", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { generateUploadSignature } = await import("./cloudinary");
      const timestamp = Math.round(Date.now() / 1000);
      const folder = "urban-culture/instagram/videos";
      const signature = generateUploadSignature({ folder }, timestamp);
      if (!signature) return res.status(500).json({ error: "Could not generate upload signature" });
      res.json({
        signature, timestamp, folder,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ── AI video analysis — analyze a Cloudinary video before posting ──────
     1. Extracts a thumbnail from the Cloudinary video URL using transformations
     2. Downloads that thumbnail
     3. Sends it to Claude Vision with Instagram-specific prompts
     Returns: hook score, content quality, caption suggestions, hashtag ideas  */
  app.post("/api/instagram/ai/analyze-video", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { videoUrl, caption = "", postType = "REELS" } = req.body as {
      videoUrl: string; caption?: string; postType?: string;
    };
    if (!videoUrl) return res.status(400).json({ error: "videoUrl required" });

    try {
      // Build a Cloudinary thumbnail from the video URL (first frame, 600px wide)
      // Works for Cloudinary-hosted videos: replace /upload/ with /upload/w_600,so_0/
      // and swap extension to .jpg
      let thumbnailUrl = videoUrl;
      if (videoUrl.includes("cloudinary.com") && videoUrl.includes("/upload/")) {
        thumbnailUrl = videoUrl
          .replace("/upload/", "/upload/w_600,h_600,c_fill,so_0/")
          .replace(/\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i, ".jpg");
      }

      // Download the thumbnail as base64
      let imageBase64: string | null = null;
      let imageMediaType: string = "image/jpeg";
      try {
        const imgRes = await axios.get(thumbnailUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: { "User-Agent": "UrbanCultureHub/1.0" },
        });
        imageBase64 = Buffer.from(imgRes.data).toString("base64");
        imageMediaType = (imgRes.headers["content-type"] || "image/jpeg").split(";")[0];
      } catch (imgErr: any) {
        console.warn("[IG VideoAnalyze] Could not fetch thumbnail:", imgErr.message);
      }

      const promptText = `You are an expert Instagram content strategist specialising in urban culture, breakdancing, street art and Dutch youth culture.

Analyse this ${postType === "REELS" ? "Reel / short video" : "video post"} for Instagram.
${caption ? `Current caption draft: "${caption}"` : "No caption written yet."}

Provide a JSON response with:
1. hookScore (0-10): How strong is the visual hook in the first frame?
2. contentQuality (0-10): Overall production quality and engagement potential
3. urbanCultureFit (0-10): How well does this fit the urban culture / breakdance niche?
4. bestTimeToPost: Recommended posting time based on content type (e.g. "Tuesday 18:00-20:00 NL time")
5. captionSuggestions: Array of 3 alternative caption options (short, punchy, with emojis, in English with optional Dutch words)
6. hashtags: Array of EXACTLY 5 highly relevant niche hashtags (urban culture / breakdance specific)
7. improvements: Array of 2-3 specific content improvements to boost engagement
8. verdict: One sentence summary of the post's potential

Return ONLY valid JSON, no markdown.`;

      const contentBlocks: any[] = imageBase64
        ? [
            { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
            { type: "text", text: promptText },
          ]
        : [{ type: "text", text: promptText + "\n\n(Note: thumbnail could not be extracted, please provide text-based analysis only.)" }];

      // Vision route stays on Anthropic SDK (image input). Model honors admin choice via getResolvedRole.
      const { getResolvedRole } = await import("./aiRouter");
      const { provider, model } = await getResolvedRole("instagram");
      const igModel = provider === "anthropic" ? model : "claude-sonnet-4-6";
      const msg = await anthropicClient.messages.create({
        model: igModel,
        max_tokens: 1200,
        messages: [{ role: "user", content: contentBlocks }],
      });

      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";
      let analysis: any = {};
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      } catch { analysis = { verdict: "Analyse kon niet worden verwerkt." }; }

      res.json({ ok: true, analysis, thumbnailUrl });
    } catch (err: any) {
      console.error("[IG VideoAnalyze]", err.message);
      res.status(500).json({ error: "Video analyse mislukt" });
    }
  });

  app.post("/api/instagram/ai/analyze-media", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { mediaUrl, postType = "PHOTO", caption = "" } = req.body as {
      mediaUrl: string; postType?: string; caption?: string;
    };
    if (!mediaUrl) return res.status(400).json({ error: "mediaUrl required" });

    try {
      let imageBase64: string | null = null;
      let imageMediaType = "image/jpeg";
      try {
        // Apply Cloudinary resize transform to keep images under Claude's 5 MB base64 limit
        let fetchUrl = mediaUrl;
        if (mediaUrl.includes("cloudinary.com") && mediaUrl.includes("/upload/")) {
          fetchUrl = mediaUrl.replace("/upload/", "/upload/w_1000,c_limit,q_auto:good/");
        }
        const imgRes = await axios.get(fetchUrl, {
          responseType: "arraybuffer", timeout: 15000,
          headers: { "User-Agent": "UrbanCultureHub/1.0" },
        });
        const buf = Buffer.from(imgRes.data);
        // Claude Vision hard limit: base64 must be ≤ 5 242 880 bytes (~3.9 MB raw)
        // Skip image and fall back to text-only if still too large
        if (buf.length <= 3_900_000) {
          imageBase64 = buf.toString("base64");
          imageMediaType = (imgRes.headers["content-type"] || "image/jpeg").split(";")[0];
        } else {
          console.warn("[IG MediaAnalyze] Image still too large after resize (%d bytes), using text-only analysis", buf.length);
        }
      } catch (imgErr: any) {
        console.warn("[IG MediaAnalyze] Could not fetch image:", imgErr.message);
      }

      const promptText = `You are an expert Instagram content strategist specialising in urban culture, breakdancing, street art and Dutch youth culture.

Analyse this ${postType} post for Instagram.
${caption ? `Current caption draft: "${caption}"` : "No caption written yet."}

Provide a JSON response with:
1. hookScore (0-10): How strong is the visual hook?
2. contentQuality (0-10): Overall quality and engagement potential
3. urbanCultureFit (0-10): How well does this fit the urban culture / breakdance niche?
4. description: 1-2 sentences describing what you see
5. bestTimeToPost: Recommended posting time (e.g. "Tuesday 18:00-20:00 NL time")
6. captionSuggestions: Array of 3 caption options (short, punchy, with emojis)
7. hashtags: Array of 15 recommended hashtags (mix of niche + broad)
8. improvements: Array of 2-3 specific improvements to boost engagement
9. verdict: One sentence summary of the post's potential

Return ONLY valid JSON, no markdown.`;

      const contentBlocks: any[] = imageBase64
        ? [
            { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
            { type: "text", text: promptText },
          ]
        : [{ type: "text", text: promptText + "\n\n(Note: image could not be loaded — text-based analysis only.)" }];

      const { getResolvedRole } = await import("./aiRouter");
      const { provider, model } = await getResolvedRole("instagram");
      const igModel = provider === "anthropic" ? model : "claude-sonnet-4-6";
      const msg = await anthropicClient.messages.create({
        model: igModel, max_tokens: 1200,
        messages: [{ role: "user", content: contentBlocks }],
      });

      const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "{}";
      let analysis: any = {};
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      } catch { analysis = { verdict: "Analyse kon niet worden verwerkt." }; }

      res.json({ ok: true, analysis });
    } catch (err: any) {
      console.error("[IG MediaAnalyze]", err.message);
      res.status(500).json({ error: "Media analyse mislukt" });
    }
  });

  /* ── Smart Upload Pipeline ────────────────────────────────────────────────
     Three-step flow for large media (especially videos > 80 MB):
       1. /init     → create a server-side upload session, receive sessionId
       2. /chunk    → POST each 5 MB piece; server appends to temp file
       3. /finalize → server compresses (FFmpeg) if needed → streams to Cloudinary

     Why this approach:
       • Replit proxy limits single requests — 5 MB chunks stay well under
       • FFmpeg is already on the server (videoCompress.ts)
       • Cloudinary server-to-server streaming has no per-file size limit
       • Files already ≤ 80 MB skip compression entirely (fast path)
  ─────────────────────────────────────────────────────────────────────── */

  /* In-memory session map: sessionId → { tempPath, mimeType, totalChunks, received } */
  const smartUploadSessions = new Map<string, {
    tempPath: string;
    mimeType: string;
    originalName: string;
    totalChunks: number;
    received: number;
  }>();

  /* Chunk multer — each chunk is max 8 MB (small enough for Replit proxy) */
  const chunkUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
  });

  /* 1. Init ─────────────────────────────────────────────────────────────── */
  app.post("/api/instagram/smart-upload/init", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { mimeType, originalName, totalChunks } = req.body as {
        mimeType: string; originalName: string; totalChunks: number;
      };
      if (!mimeType || !originalName || !totalChunks) {
        return res.status(400).json({ error: "mimeType, originalName and totalChunks required" });
      }
      const sessionId = `igs_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const ext = path.extname(originalName).toLowerCase() || (mimeType.startsWith("video") ? ".mp4" : ".jpg");
      const tempPath = path.join(os.tmpdir(), `${sessionId}${ext}`);
      // Create empty file
      fs.writeFileSync(tempPath, Buffer.alloc(0));
      smartUploadSessions.set(sessionId, { tempPath, mimeType, originalName, totalChunks, received: 0 });
      console.log(`[SmartUpload] Session ${sessionId} — ${totalChunks} chunks expected → ${tempPath}`);
      res.json({ ok: true, sessionId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /* 2. Chunk ─────────────────────────────────────────────────────────────── */
  app.post("/api/instagram/smart-upload/chunk", requireAdmin, chunkUpload.single("chunk"), async (req: Request, res: Response) => {
    try {
      const { sessionId, chunkIndex } = req.body as { sessionId: string; chunkIndex: string };
      const session = smartUploadSessions.get(sessionId);
      if (!session) return res.status(404).json({ error: "Upload session not found" });
      if (!req.file?.buffer) return res.status(400).json({ error: "No chunk data" });

      // Append chunk to temp file
      fs.appendFileSync(session.tempPath, req.file.buffer);
      session.received += 1;
      console.log(`[SmartUpload] ${sessionId} chunk ${chunkIndex} — ${session.received}/${session.totalChunks}`);
      res.json({ ok: true, received: session.received, total: session.totalChunks });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /* 3. Finalize ──────────────────────────────────────────────────────────── */
  app.post("/api/instagram/smart-upload/finalize", requireAdmin, async (req: Request, res: Response) => {
    const { sessionId } = req.body as { sessionId: string };
    const session = smartUploadSessions.get(sessionId);
    if (!session) {
      res.setHeader("Content-Type", "text/event-stream");
      res.write(`data: ${JSON.stringify({ type: "error", message: "Upload session not found" })}\n\n`);
      return res.end();
    }

    const { tempPath, mimeType, originalName } = session;
    smartUploadSessions.delete(sessionId);

    // ── Set up Server-Sent Events ────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (data: object) => {
      try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
    };

    let compressResult: any = null;
    try {
      if (!fs.existsSync(tempPath)) {
        send({ type: "error", message: "Temporary file not found — upload may have been interrupted" });
        return res.end();
      }

      const rawBytes = fs.statSync(tempPath).size;
      const rawMb    = (rawBytes / 1024 / 1024).toFixed(1);
      const isVideo  = mimeType.startsWith("video/");
      const folder   = isVideo ? "urban-culture/instagram/videos" : "urban-culture/instagram/images";
      const resourceType = isVideo ? "video" : "image";

      console.log(`[SmartUpload] Finalizing ${originalName} — ${rawMb} MB, video=${isVideo}`);

      let uploadPath = tempPath;
      let compressed = false;
      let compressedMb = rawMb;

      if (isVideo) {
        send({ type: "progress", stage: "compressing", pct: 0, message: "FFmpeg optimalisatie gestart…" });

        compressResult = await compressVideo(tempPath, (pct) => {
          // FFmpeg progress 0–100 maps to overall 0–72%
          send({ type: "progress", stage: "compressing", pct: Math.round(pct * 0.72) });
        });

        uploadPath   = compressResult.outputPath;
        compressed   = !compressResult.skipped;
        compressedMb = (compressResult.compressedBytes / 1024 / 1024).toFixed(1) as any;

        console.log(
          `[SmartUpload] ${compressed ? `Compressed ${rawMb} MB → ${compressedMb} MB` : `Skipped compression (${rawMb} MB already within limit)`}`
        );
        send({ type: "progress", stage: "cloudinary", pct: 73, message: "Uploaden naar Cloudinary…" });
      }

      // Upload to Cloudinary with byte-level progress (73–99%)
      const result = await uploadImageWithProgress(uploadPath, folder, resourceType, (pct) => {
        // Cloudinary byte progress 0–100 maps to overall 73–99%
        send({ type: "progress", stage: "cloudinary", pct: 73 + Math.round(pct * 0.26) });
      });

      if (!result.success || !result.url) {
        throw new Error(result.error || "Cloudinary upload failed");
      }

      console.log(`[SmartUpload] ✅ Uploaded to Cloudinary: ${result.url}`);

      send({
        type: "done",
        url: result.url,
        resourceType,
        originalName,
        originalMb: rawMb,
        finalMb: isVideo ? compressedMb : rawMb,
        compressed,
      });
      res.end();
    } catch (err: any) {
      console.error("[SmartUpload] Finalize error:", err.message);
      send({ type: "error", message: err.message || "Upload finalization failed" });
      res.end();
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
      if (compressResult) {
        try { cleanupCompressed(compressResult, tempPath); } catch {}
      }
    }
  });

  /* ── direct media upload (device → Cloudinary → Instagram-ready URL) ─── */
  app.post("/api/instagram/upload/media", requireAdmin, igMediaUpload.single("file"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided" });

      const isVideo = file.mimetype.startsWith("video/");
      const isImage = file.mimetype.startsWith("image/");
      if (!isVideo && !isImage) return res.status(400).json({ error: "Only image and video files are supported" });

      const folder = isVideo ? "urban-culture/instagram/videos" : "urban-culture/instagram/images";
      const resourceType = isVideo ? "video" : "image";

      // Use streaming upload for both image and video to avoid base64 413 errors
      const result = await uploadBuffer(file.buffer, folder, resourceType as "image" | "video");
      if (!result.success) return res.status(500).json({ error: result.error || "Upload to cloud storage failed" });

      res.json({
        ok: true,
        url: result.url,
        resourceType,
        originalName: file.originalname,
        sizeMb: (file.size / (1024 * 1024)).toFixed(1),
      });
    } catch (err: any) {
      console.error("[IG Upload] Error:", err.message);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  /* ── connection status ────────────────────────────────────────────────── */
  app.get("/api/instagram/status", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.json({ connected: false });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.json({ connected: false });
    res.json({
      connected: true,
      connectionId: conn.id,
      username: conn.username,
      name: conn.name,
      profilePictureUrl: conn.profilePictureUrl,
      biography: conn.biography,
      followersCount: conn.followersCount,
      mediaCount: conn.mediaCount,
      accountType: conn.accountType,
      instagramUserId: conn.instagramUserId,
      connectedAt: conn.connectedAt,
      automationEnabled: conn.automationEnabled ?? false,
    });
  });

  /* ── toggle automation master switch ─────────────────────────────────── */
  app.patch("/api/instagram/connections/automation", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled (boolean) required" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    await db.update(instagramConnections)
      .set({ automationEnabled: enabled })
      .where(eq(instagramConnections.adminUserId, adminUserId));
    res.json({ ok: true, automationEnabled: enabled });
  });

  /* ── disconnect ───────────────────────────────────────────────────────── */
  app.post("/api/instagram/disconnect", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    await db.delete(instagramConnections).where(
      eq(instagramConnections.adminUserId, adminUserId),
    );
    res.json({ ok: true });
  });

  /* ── account info (live) ──────────────────────────────────────────────── */
  app.get("/api/instagram/account", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    try {
      const info = await getIgUserInfo(conn.instagramUserId, conn.accessToken);
      // Update cached values
      await db.update(instagramConnections)
        .set({
          followersCount: info.followers_count,
          mediaCount: info.media_count,
          biography: info.biography,
          updatedAt: new Date(),
        })
        .where(eq(instagramConnections.id, conn.id));
      res.json(info);
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── media list ───────────────────────────────────────────────────────── */
  app.get("/api/instagram/media", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    try {
      const limit = String(req.query.limit || "24");
      const after = req.query.after as string | undefined;
      const params: Record<string, string> = {
        fields: [
          "id", "caption", "media_type", "media_url", "thumbnail_url",
          "timestamp", "like_count", "comments_count", "permalink",
          "is_shared_to_feed",
        ].join(","),
        limit,
      };
      if (after) params.after = after;
      const data = await igGet(
        `${conn.instagramUserId}/media`,
        conn.accessToken,
        params,
      );
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── insights — try supported metrics only, fall back gracefully ─────── */
  app.get("/api/instagram/insights", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });

    // Try metrics in order of compatibility. MEDIA_CREATOR tokens only support a subset.
    const candidateSets = [
      "follower_count,reach,impressions,profile_views",
      "follower_count,reach,impressions",
      "follower_count,reach",
      "reach",
      "follower_count",
    ];
    for (const metric of candidateSets) {
      try {
        const data = await igGet(`${conn.instagramUserId}/insights`, conn.accessToken, {
          metric,
          period: "day",
        });
        return res.json(data);
      } catch { /* try next */ }
    }
    // Nothing worked — return empty so the UI can show a friendly message
    return res.json({ data: [], limited: true });
  });

  /* ── analytics from media (always works — derived from post data) ─────── */
  app.get("/api/instagram/analytics/media", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    try {
      const data = await igGet(`${conn.instagramUserId}/media`, conn.accessToken, {
        fields: "id,caption,media_type,thumbnail_url,media_url,timestamp,like_count,comments_count,permalink",
        limit: "50",
      });
      const posts: any[] = data.data || [];

      // Compute derived analytics from the posts
      const totalLikes = posts.reduce((s: number, p: any) => s + (p.like_count || 0), 0);
      const totalComments = posts.reduce((s: number, p: any) => s + (p.comments_count || 0), 0);
      const avgLikes = posts.length ? Math.round(totalLikes / posts.length) : 0;
      const avgComments = posts.length ? Math.round(totalComments / posts.length) : 0;
      const engagementRate = conn.followersCount
        ? parseFloat(((totalLikes + totalComments) / (posts.length * conn.followersCount) * 100).toFixed(2))
        : null;

      // Top 5 posts by likes
      const topPosts = [...posts].sort((a, b) => (b.like_count || 0) - (a.like_count || 0)).slice(0, 5);

      // Media type breakdown
      const byType: Record<string, number> = {};
      posts.forEach((p: any) => { byType[p.media_type] = (byType[p.media_type] || 0) + 1; });

      // Posts per month (last 6 months)
      const monthBuckets: Record<string, { likes: number; comments: number; count: number }> = {};
      posts.forEach((p: any) => {
        const key = new Date(p.timestamp).toLocaleDateString("nl-NL", { year: "numeric", month: "short" });
        if (!monthBuckets[key]) monthBuckets[key] = { likes: 0, comments: 0, count: 0 };
        monthBuckets[key].likes += p.like_count || 0;
        monthBuckets[key].comments += p.comments_count || 0;
        monthBuckets[key].count++;
      });
      const byMonth = Object.entries(monthBuckets)
        .map(([month, v]) => ({ month, ...v }))
        .slice(0, 6)
        .reverse();

      res.json({
        summary: { totalLikes, totalComments, avgLikes, avgComments, engagementRate, postCount: posts.length },
        topPosts,
        byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
        byMonth,
      });
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "analytics_error" });
    }
  });

  /* ── audience insights ────────────────────────────────────────────────── */
  app.get("/api/instagram/audience", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });

    // Try audience metrics in order of compatibility
    const candidateSets = [
      ["audience_city", "audience_country", "audience_gender_age", "online_followers"],
      ["audience_country", "audience_gender_age"],
      ["audience_gender_age"],
    ];
    for (const metrics of candidateSets) {
      try {
        const data = await igGet(`${conn.instagramUserId}/insights`, conn.accessToken, {
          metric: metrics.join(","),
          period: "lifetime",
        });
        return res.json(data);
      } catch { /* try next */ }
    }
    return res.json({ data: [], limited: true });
  });

  /* ── image proxy — fetches Instagram CDN images server-side ──────────── */
  app.get("/api/instagram/proxy-image", requireAdmin, async (req: Request, res: Response) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("url required");
    // Safety: only allow Instagram CDN domains
    if (!url.startsWith("https://") || !/(cdninstagram\.com|fbcdn\.net|instagram\.com)/i.test(url)) {
      return res.status(400).send("Invalid image URL");
    }
    try {
      const response = await axios.get(url, {
        responseType: "stream",
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; UrbanCultureBot/1.0)",
          "Referer": "https://www.instagram.com/",
        },
      });
      const ct = response.headers["content-type"] || "image/jpeg";
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=86400");
      (response.data as NodeJS.ReadableStream).pipe(res);
    } catch (err: any) {
      console.error("[Instagram proxy-image]", err.message);
      res.status(502).send("Image unavailable");
    }
  });

  /* ── video proxy — streams Instagram CDN videos server-side ──────────── */
  app.get("/api/instagram/proxy-video", async (req: Request, res: Response) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("url required");
    if (!url.startsWith("https://") || !/(cdninstagram\.com|fbcdn\.net|instagram\.com)/i.test(url)) {
      return res.status(400).send("Invalid video URL");
    }
    try {
      const rangeHeader = req.headers["range"];
      const axiosConfig: any = {
        responseType: "stream",
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; UrbanCultureBot/1.0)",
          "Referer": "https://www.instagram.com/",
        },
      };
      if (rangeHeader) axiosConfig.headers["Range"] = rangeHeader;

      const response = await axios.get(url, axiosConfig);
      const ct = response.headers["content-type"] || "video/mp4";
      const cl = response.headers["content-length"];
      const cr = response.headers["content-range"];

      res.setHeader("Content-Type", ct);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=3600");
      if (cl) res.setHeader("Content-Length", cl);
      if (cr) res.setHeader("Content-Range", cr);

      const status = response.status === 206 ? 206 : 200;
      res.status(status);
      (response.data as NodeJS.ReadableStream).pipe(res);
    } catch (err: any) {
      console.error("[Instagram proxy-video]", err.message);
      res.status(502).send("Video unavailable");
    }
  });

  /* ── share Instagram reel → in-app Reels section ─────────────────────── */
  app.post("/api/instagram/share-to-reels", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });

    const { postId } = req.body as { postId?: string };
    if (!postId) return res.status(400).json({ error: "postId required" });

    try {
      // Fetch the media details from Instagram
      const media = await igGet(postId, conn.accessToken, {
        fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,permalink",
      });

      const igVideoUrl = media.media_url;
      if (!igVideoUrl) return res.status(400).json({ error: "No video URL available for this post" });

      // Upload to Cloudinary so we have a permanent, browser-safe URL
      console.log(`[Instagram→Reels] Uploading video to Cloudinary from ${igVideoUrl.slice(0, 60)}…`);
      const uploadResult = await uploadImage(igVideoUrl, "urban-culture/reels/instagram", "video");

      let finalVideoUrl = igVideoUrl;   // fallback: use proxy if Cloudinary fails
      let videoPublicId = `instagram_${postId}`;

      if (uploadResult.success && uploadResult.url) {
        finalVideoUrl = uploadResult.url;
        videoPublicId = uploadResult.publicId || videoPublicId;
        console.log(`[Instagram→Reels] Cloudinary upload OK: ${finalVideoUrl}`);
      } else {
        console.warn(`[Instagram→Reels] Cloudinary upload failed (${uploadResult.error}), falling back to proxy URL`);
        // Store as proxy URL so the Reels player can stream it
        finalVideoUrl = `/api/instagram/proxy-video?url=${encodeURIComponent(igVideoUrl)}`;
      }

      // Also upload thumbnail if available
      let thumbUrl = media.thumbnail_url || null;
      if (thumbUrl) {
        const thumbResult = await uploadImage(thumbUrl, "urban-culture/reels/instagram/thumbs", "image").catch(() => ({ success: false }));
        if (thumbResult.success && (thumbResult as any).url) thumbUrl = (thumbResult as any).url;
      }

      // Store in reels table
      const [reel] = await db.insert(reels).values({
        userId: adminUserId,
        videoUrl: finalVideoUrl,
        videoPublicId,
        thumbnailUrl: thumbUrl,
        caption: (media.caption || "").slice(0, 1000),
        status: "active",
      }).returning();

      res.json({ ok: true, reelId: reel.id });
    } catch (err: any) {
      console.error("[Instagram share-to-reels]", err.message);
      res.status(502).json({ error: err?.response?.data?.error?.message || err.message || "Failed to share reel" });
    }
  });

  /* ── media comments ───────────────────────────────────────────────────── */
  app.get("/api/instagram/media/:mediaId/comments", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    try {
      const { mediaId } = req.params;
      const data = await igGet(
        `${mediaId}/comments`,
        conn.accessToken,
        { fields: "id,text,timestamp,username,like_count,replies{id,text,timestamp,username}" },
      );
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── reply to comment ─────────────────────────────────────────────────── */
  app.post("/api/instagram/comments/:commentId/reply", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    const { message } = req.body as { message?: string };
    if (!message?.trim()) return res.status(400).json({ error: "message required" });
    try {
      const { commentId } = req.params;
      const data = await igPost(`${commentId}/replies`, conn.accessToken, { message });
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── hide / delete comment ────────────────────────────────────────────── */
  app.delete("/api/instagram/comments/:commentId", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    try {
      const { commentId } = req.params;
      await axios.delete(`${IG_GRAPH}/${commentId}`, {
        params: { access_token: conn.accessToken },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── create media container (step 1 of posting) ──────────────────────── */
  app.post("/api/instagram/media/create", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    const {
      image_url, video_url, caption, media_type,
      location_id, user_tags, children,
      share_to_feed, thumb_offset,
    } = req.body as Record<string, any>;
    try {
      const body: Record<string, unknown> = { caption: caption || "" };
      if (media_type === "REELS") {
        body.media_type = "REELS";
        body.video_url = video_url;
        body.share_to_feed = share_to_feed ?? true;
        if (thumb_offset) body.thumb_offset = thumb_offset;
      } else if (media_type === "VIDEO") {
        body.media_type = "VIDEO";
        body.video_url = video_url;
      } else if (media_type === "CAROUSEL") {
        body.media_type = "CAROUSEL";
        body.children = children;
      } else if (media_type === "STORY") {
        body.media_type = "STORIES";
        if (video_url) body.video_url = video_url;
        else body.image_url = image_url;
      } else {
        body.image_url = image_url;
      }
      if (location_id) body.location_id = location_id;
      if (user_tags) body.user_tags = user_tags;
      const data = await igPost(
        `${conn.instagramUserId}/media`,
        conn.accessToken,
        body,
      );
      res.json(data); // { id: creation_id }
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── create carousel child container ─────────────────────────────────── */
  app.post("/api/instagram/media/carousel-child", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    const { image_url, video_url, media_type = "IMAGE" } = req.body as Record<string, string>;
    try {
      const body: Record<string, any> = { is_carousel_item: true };
      if (media_type === "VIDEO") {
        body.media_type = "VIDEO";
        body.video_url = video_url;
      } else {
        body.image_url = image_url;
      }
      const data = await igPost(`${conn.instagramUserId}/media`, conn.accessToken, body);
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── check media status ───────────────────────────────────────────────── */
  app.get("/api/instagram/media/:creationId/status", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    try {
      const data = await igGet(
        req.params.creationId,
        conn.accessToken,
        { fields: "status_code,status" },
      );
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── publish media (step 2) ───────────────────────────────────────────── */
  app.post("/api/instagram/media/publish", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    const { creation_id } = req.body as { creation_id?: string };
    if (!creation_id) return res.status(400).json({ error: "creation_id required" });
    try {
      const data = await igPost(
        `${conn.instagramUserId}/media_publish`,
        conn.accessToken,
        { creation_id },
      );
      res.json(data); // { id: media_id }
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── cross-post to multiple accounts ─────────────────────────────────── */
  app.post("/api/instagram/cross-post", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const { caption, mediaType, imageUrl, videoUrl, targetAccountIds } = req.body as {
      caption?: string; mediaType?: string; imageUrl?: string;
      videoUrl?: string; targetAccountIds?: number[];
    };
    if (!targetAccountIds?.length) return res.status(400).json({ error: "targetAccountIds required" });
    const allConns = await getAllConnections(adminUserId);
    const results: Array<{ accountId: number; username: string; success: boolean; mediaId?: string; error?: string }> = [];
    for (const accountId of targetAccountIds) {
      const conn = allConns.find(c => c.id === accountId);
      if (!conn) { results.push({ accountId, username: "unknown", success: false, error: "Account not found" }); continue; }
      try {
        const createBody: Record<string, any> = { caption: caption || "", media_type: mediaType || "PHOTO" };
        if (mediaType === "STORY") {
          createBody.media_type = "STORIES";
          const isVideoUrl = /\.(mp4|mov|avi|webm|m4v)(\?|$)/i.test(videoUrl || "");
          if (isVideoUrl && videoUrl) createBody.video_url = videoUrl;
          else createBody.image_url = imageUrl;
        } else if ((mediaType || "PHOTO") === "PHOTO") {
          createBody.image_url = imageUrl;
        } else {
          createBody.video_url = videoUrl;
        }
        const createData = await igPost(`${conn.instagramUserId}/media`, conn.accessToken, createBody);
        const creationId: string = createData.id;
        let statusCode = "IN_PROGRESS", attempts = 0;
        while (statusCode !== "FINISHED" && attempts < 20) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const s = await igGet(creationId, conn.accessToken, { fields: "status_code" });
            statusCode = s.status_code;
          } catch { /* ignore status check errors */ }
          attempts++;
        }
        const publishData = await igPost(`${conn.instagramUserId}/media_publish`, conn.accessToken, { creation_id: creationId });
        results.push({ accountId, username: conn.username || "unknown", success: true, mediaId: publishData.id });
      } catch (err: any) {
        results.push({ accountId, username: conn.username || "unknown", success: false, error: err?.response?.data?.error?.message || err.message });
      }
    }
    res.json({ results });
  });

  /* ── hashtag search ───────────────────────────────────────────────────── */
  app.get("/api/instagram/hashtags/search", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    const { q } = req.query as { q?: string };
    if (!q) return res.status(400).json({ error: "q required" });
    try {
      const searchData = await igGet("ig_hashtag_search", conn.accessToken, {
        user_id: conn.instagramUserId,
        q,
      });
      const hashtagId: string = searchData.data?.[0]?.id;
      if (!hashtagId) return res.json({ id: null, top_media_count: 0 });
      const info = await igGet(hashtagId, conn.accessToken, {
        fields: "id,name,use_count",
        user_id: conn.instagramUserId,
      });
      res.json(info);
    } catch (err: any) {
      res.status(502).json({ error: err?.response?.data?.error?.message || "graph_api_error" });
    }
  });

  /* ── Quick AI Caption Generator ─────────────────────────────────────── */
  app.post("/api/instagram/ai/caption", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { postType = "PHOTO", topHashtags = [], accountUsername = "", followers = 0 } = req.body as {
      postType: string; topHashtags: string[]; accountUsername: string; followers: number;
    };

    const formatInstructions: Record<string, string> = {
      PHOTO: "single image post — punchy opening line, 3–5 sentences, 10–15 hashtags at the end",
      CAROUSEL: "carousel post — start with a hook like 'Swipe for →', tease each slide concept briefly, 10–15 hashtags",
      REELS: "reel description — very short (max 3 lines), high energy, trending language, 5–10 hashtags, encourage saves/shares",
      STORY: "story caption — super short, 1–2 punchy lines max, optional emoji, no hashtags needed",
      VIDEO: "video post — describe what's happening, create curiosity, 8–12 hashtags",
    };

    const hashtagHint = topHashtags.length > 0
      ? `\n\nTop performing hashtags for this account (incorporate where relevant): ${topHashtags.slice(0, 8).join(", ")}`
      : "";

    const prompt = `You are a professional Instagram content strategist for an urban culture / breakdance / street art brand in the Netherlands.

Generate ONE complete Instagram caption for a ${postType} post.
Format: ${formatInstructions[postType] || formatInstructions.PHOTO}
${accountUsername ? `Account: @${accountUsername}` : ""}
${followers ? `Audience: ~${followers.toLocaleString()} followers` : ""}
Niche: urban culture, breakdancing, bboying, Dutch street culture, events, community
Tone: authentic, energetic, community-focused, slightly Dutch cultural flavor
Language: write in English but you may include 1–2 Dutch words naturally${hashtagHint}

Return ONLY the caption text, no explanations, no "Caption:" prefix.`;

    try {
      const { aiChat } = await import("./aiRouter");
      const msg = await aiChat({
        role: "instagram",
        maxTokens: 400,
        messages: [{ role: "user", content: prompt }],
      });
      res.json({ caption: msg.text.trim() });
    } catch (err: any) {
      res.status(500).json({ error: "Caption generation failed" });
    }
  });

  /* ── Instagram AI Agent (SSE streaming) ──────────────────────────────── */
  app.post("/api/instagram/agent", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const { message = "", history = [], context = {}, mode = "chat" } = req.body as {
      message: string;
      history: Array<{ role: string; content: string }>;
      context: Record<string, any>;
      mode: string;
    };

    const {
      account, topPosts = [], hashtagPerformance = [],
      avgEngagement, postingFrequency, scheduledCount = 0, status,
    } = context;

    const accountCtx = `
ACCOUNT: @${account?.username || status?.username || "bboy_rikimaru"}
Volgers: ${account?.followers_count || status?.followersCount || 11500}
Volgend: ${account?.follows_count || "–"}
Posts totaal: ${account?.media_count || status?.mediaCount || "–"}
Account type: ${status?.accountType || "CREATOR"}
Engagement rate: ${avgEngagement ? (avgEngagement as number).toFixed(2) + "%" : "~2-4% (schatting)"}
Posts per week: ${postingFrequency ? (postingFrequency as number).toFixed(1) : "2-3 (schatting)"}
In wachtrij: ${scheduledCount} geplande posts`.trim();

    const postsCtx = topPosts.length > 0
      ? "TOP POSTS:\n" + topPosts.slice(0, 5).map((p: any, i: number) =>
          `${i + 1}. ${p.like_count ?? 0}♥ ${p.comments_count ?? 0}💬 | ${(p.caption || "").slice(0, 100)}`
        ).join("\n")
      : "";

    const hashCtx = hashtagPerformance.length > 0
      ? "HASHTAG PERFORMANCE (op engagement):\n" + hashtagPerformance.slice(0, 10).map((h: any) =>
          `${h.tag}: score ${h.score}, ~${h.avgLikes} likes gem. (${h.count}× gebruikt)`
        ).join("\n")
      : "";

    const systemPrompt = `Je bent een elite Instagram strategie- en operatieagent voor @${account?.username || status?.username || "bboy_rikimaru"} — het officiële Instagram-account van Urban Culture Hub, een platform voor breakdance, street art, hip-hop en stedelijke cultuur in Nederland.

${accountCtx}

${postsCtx}

${hashCtx}

JOUW ROL:
Je bent geen gewone chatbot. Je bent de AI-operator van dit Instagram-account. Je denkt en handelt als een senior social media strateeg die dit account door en door kent. Je gebruikt de echte data om specifieke, uitvoerbare aanbevelingen te geven — geen generieke tips.

EXPERTISE:
- Instagram algoritme, content-strategie, Reels-groei
- Urban dance cultuur: breakdancing, popping, locking, hip-hop (NL & internationaal)
- Nederlandse stedelijke cultuurscene, Amsterdam en omgeving
- Community-opbouw, publieksgroei, engagement-optimalisatie
- Hashtag-onderzoek, content kalender, story-tactiek

COMMUNICATIESTIJL:
- Direct, zelfverzekerd, actiegericht — geen opvulling
- Schrijf in het Nederlands tenzij gevraagd om Engels
- Gebruik Markdown: ## headers, bullet points, **vetgedrukt** voor kerncijfers
- Wees beknopt maar volledig — elke aanbeveling gekoppeld aan echte data
- Proactief: merk patronen op, stel vervolgvragen, denk strategisch mee`;

    let userMsg = message;
    if (mode === "briefing" || message === "__briefing__") {
      userMsg = `Geef mij een strategische briefing voor dit Instagram-account. Analyseer de beschikbare data en geef:
1. Huidige staat van het account (3 concrete observaties met cijfers)
2. Wat nu goed gaat
3. De 3 grootste kansen voor verbetering
4. Één concrete actie die ik VANDAAG kan uitvoeren
Wees direct en specifiek. Gebruik de echte cijfers. Maximaal 300 woorden.`;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const anthropicMsgs = [
        ...history.slice(-8).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: userMsg },
      ];

      // Streaming uses Anthropic SDK directly; model honors admin choice for the "instagram" role.
      const { getResolvedRole } = await import("./aiRouter");
      const { provider, model } = await getResolvedRole("instagram");
      const igModel = provider === "anthropic" ? model : "claude-sonnet-4-6";
      const stream = anthropicClient.messages.stream({
        model: igModel,
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMsgs,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          res.write(`data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (err: any) {
      console.error("[Instagram Agent]", err.message);
      res.write(`data: ${JSON.stringify({ type: "error", message: "AI-agent fout. Probeer opnieuw." })}\n\n`);
      res.end();
    }
  });

  /* ════════════════════════════════════════════════════════════════════════
     HEALTH & CAPABILITIES
     A single endpoint that probes every important Graph API capability so
     the admin can see at a glance what truly works with the current token,
     when the token expires, and which features are blocked. This makes the
     feature honest about its real limits instead of pretending.
     ════════════════════════════════════════════════════════════════════════ */
  app.get("/api/instagram/health", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) {
      return res.json({
        connected: false,
        token: { valid: false, expiresAt: null, daysRemaining: null },
        capabilities: {},
      });
    }

    const token = conn.accessToken;
    const igUserId = conn.instagramUserId;

    // Probe a single capability and return a tiny report.
    type Cap = { ok: boolean; reason?: string; sample?: any; fbCode?: number; fbSubcode?: number; fbType?: string };
    const probe = async (label: string, fn: () => Promise<any>): Promise<Cap> => {
      try {
        const sample = await fn();
        return { ok: true, sample };
      } catch (err: any) {
        const fbErr = err?.response?.data?.error;
        const reason =
          fbErr?.error_user_msg ||
          fbErr?.message ||
          err?.message ||
          "Failed";
        return {
          ok: false,
          reason,
          fbCode: fbErr?.code,
          fbSubcode: fbErr?.error_subcode,
          fbType: fbErr?.type,
        };
      }
    };

    // Run capability probes in parallel — all are tiny `limit=1` requests.
    const [
      account,
      mediaList,
      accountInsights,
      audienceInsights,
      stories,
      mentions,
      hashtagSearch,
    ] = await Promise.all([
      probe("account", () => getIgUserInfo(igUserId, token)),
      probe("media", () => igGet(`${igUserId}/media`, token, { fields: "id", limit: "1" })),
      probe("accountInsights", () =>
        igGet(`${igUserId}/insights`, token, { metric: "reach", period: "day" })),
      probe("audienceInsights", () =>
        igGet(`${igUserId}/insights`, token, { metric: "audience_gender_age", period: "lifetime" })),
      probe("stories", () => igGet(`${igUserId}/stories`, token, { fields: "id", limit: "1" })),
      probe("mentions", () => igGet(`${igUserId}/tags`, token, { fields: "id", limit: "1" })),
      probe("hashtagSearch", () => igGet(`ig_hashtag_search`, token, { user_id: igUserId, q: "music" })),
    ]);

    // Per-media insights probe — only meaningful if media exists.
    let mediaInsights: Cap = { ok: false, reason: "No media to probe" };
    let commentsRead: Cap = { ok: false, reason: "No media to probe" };
    if (mediaList.ok && mediaList.sample?.data?.[0]?.id) {
      const firstMediaId = mediaList.sample.data[0].id;
      [mediaInsights, commentsRead] = await Promise.all([
        probe("mediaInsights", () =>
          igGet(`${firstMediaId}/insights`, token, { metric: "reach,impressions" })),
        probe("comments", () => igGet(`${firstMediaId}/comments`, token, { fields: "id", limit: "1" })),
      ]);
    }

    // Token validity = the account probe succeeded.
    const tokenValid = account.ok;
    const expiresAt = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt) : null;
    const daysRemaining = expiresAt
      ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

    // Map Facebook error codes to human-readable invalidation reasons.
    // https://developers.facebook.com/docs/graph-api/using-graph-api/error-handling/
    let invalidReason: string | null = null;
    if (!tokenValid) {
      const fbCode = account.fbCode;
      const fbSub = account.fbSubcode;
      if (fbCode === 190) {
        if (fbSub === 460) invalidReason = "password_changed";
        else if (fbSub === 463) invalidReason = "token_expired";
        else if (fbSub === 467 || fbSub === 492) invalidReason = "revoked";
        else invalidReason = "oauth_invalid";
      } else if (fbCode === 4 || fbCode === 17 || fbCode === 32 || fbCode === 613) {
        invalidReason = "rate_limited";
      } else {
        invalidReason = "unknown";
      }
    }

    // Compose the capability report. Every capability is honestly labelled.
    const capabilities = {
      account:           { label: "Account profile",        ...account },
      media:             { label: "Media list",             ...mediaList },
      mediaInsights:     { label: "Per-post insights",      ...mediaInsights },
      comments:          { label: "Read comments",          ...commentsRead },
      commentsManage:    {
        label: "Reply to comments",
        ok: commentsRead.ok, // same scope as reading
        reason: commentsRead.ok ? undefined : commentsRead.reason,
      },
      accountInsights:   { label: "Account insights",       ...accountInsights },
      audienceInsights:  { label: "Audience demographics",  ...audienceInsights },
      stories:           { label: "Active stories",         ...stories },
      mentions:          { label: "Tagged & mentioned",     ...mentions },
      hashtagSearch:     { label: "Hashtag discovery",      ...hashtagSearch },
      publishing:        {
        label: "Publish posts (containers)",
        // Publishing requires `instagram_business_content_publish` scope. We can't probe
        // without actually creating a container, so we infer from the scope being
        // requested at OAuth time and from the account being a BUSINESS/CREATOR.
        ok: tokenValid && (conn.accountType === "BUSINESS" || conn.accountType === "CREATOR"),
        reason: !tokenValid
          ? "Token invalid"
          : conn.accountType !== "BUSINESS" && conn.accountType !== "CREATOR"
            ? `Account type ${conn.accountType ?? "unknown"} does not support publishing`
            : undefined,
      },
    };

    // Strip the bulky `sample` payloads — they were only for the probe.
    const slim: Record<string, { label: string; ok: boolean; reason?: string }> = {};
    for (const [k, v] of Object.entries(capabilities)) {
      slim[k] = { label: v.label, ok: v.ok, reason: v.reason };
    }

    res.json({
      connected: true,
      account: {
        username: conn.username,
        accountType: conn.accountType,
        followersCount: conn.followersCount,
        mediaCount: conn.mediaCount,
      },
      token: {
        valid: tokenValid,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        daysRemaining,
        connectedAt: conn.connectedAt,
        updatedAt: conn.updatedAt,
        invalidReason,
        fbCode: tokenValid ? null : account.fbCode,
        fbSubcode: tokenValid ? null : account.fbSubcode,
        // Long-lived tokens become eligible for refresh after they're at
        // least 24h old.
        canRefresh: tokenValid && Date.now() - new Date(conn.connectedAt).getTime() > 24 * 60 * 60 * 1000,
      },
      capabilities: slim,
    });
  });

  /* ── Refresh long-lived token (extend by 60 days) ─────────────────────── */
  app.post("/api/instagram/refresh-token", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    try {
      // Instagram's long-lived refresh endpoint
      const r = await axios.get(`${IG_GRAPH}/refresh_access_token`, {
        params: { grant_type: "ig_refresh_token", access_token: conn.accessToken },
      });
      const newToken: string = r.data.access_token;
      const expiresIn: number = r.data.expires_in || 60 * 24 * 60 * 60;
      const newExpiry = new Date(Date.now() + expiresIn * 1000);
      await db.update(instagramConnections)
        .set({ accessToken: newToken, tokenExpiresAt: newExpiry, updatedAt: new Date() })
        .where(eq(instagramConnections.id, conn.id));
      console.log(`[Instagram] Token refreshed for @${conn.username} → expires ${newExpiry.toISOString()}`);
      res.json({ ok: true, expiresAt: newExpiry.toISOString(), daysRemaining: Math.round(expiresIn / 86400) });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message || "Refresh failed";
      console.error("[Instagram refresh-token]", msg);
      res.status(502).json({ ok: false, error: msg });
    }
  });

  /* ── Active stories (with insights when allowed) ──────────────────────── */
  app.get("/api/instagram/stories", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    try {
      const stories = await igGet(`${conn.instagramUserId}/stories`, conn.accessToken, {
        fields: "id,media_type,media_url,thumbnail_url,permalink,timestamp",
      });
      // Try to enrich with insights for each story; quietly skip on failure.
      const enriched = await Promise.all(
        (stories.data || []).map(async (s: any) => {
          try {
            const ins = await igGet(`${s.id}/insights`, conn.accessToken, {
              metric: "impressions,reach,replies,exits,taps_forward,taps_back",
            });
            const m: Record<string, number> = {};
            (ins.data || []).forEach((d: any) => { m[d.name] = d.values?.[0]?.value ?? 0; });
            return { ...s, insights: m };
          } catch {
            return { ...s, insights: null };
          }
        }),
      );
      res.json({ data: enriched, count: enriched.length });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || "stories_unavailable";
      res.status(502).json({ error: msg, data: [] });
    }
  });

  /* ── Tagged / mentioned media ─────────────────────────────────────────── */
  app.get("/api/instagram/mentions", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "Not connected" });
    try {
      const data = await igGet(`${conn.instagramUserId}/tags`, conn.accessToken, {
        fields: "id,caption,media_type,media_url,thumbnail_url,permalink,username,timestamp,like_count,comments_count",
        limit: "24",
      });
      res.json(data);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || "mentions_unavailable";
      res.status(502).json({ error: msg, data: [] });
    }
  });

  /* ════════════════════════════════════════════════════════════════════════
     APP CREDENTIALS — store Facebook App ID + Secret in the DB so admins
     can configure them from the dashboard without touching env vars.
     ════════════════════════════════════════════════════════════════════════ */

  app.get("/api/instagram/app-credentials", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const { appId, appSecret } = await getCreds();
      // Never send the full secret — just the first 4 chars so admin can verify
      const maskedSecret = appSecret
        ? appSecret.slice(0, 4) + "●".repeat(Math.max(0, appSecret.length - 4))
        : "";
      res.json({
        appId: appId || "",
        appSecretMasked: maskedSecret,
        hasAppId: !!appId,
        hasAppSecret: !!appSecret,
        source: (appId && appSecret) ? "db" : (IG_APP_ID ? "env" : "none"),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/instagram/app-credentials", requireAdmin, async (req: Request, res: Response) => {
    const { appId, appSecret } = req.body as { appId?: string; appSecret?: string };
    if (!appId?.trim() || !appSecret?.trim()) {
      return res.status(400).json({ error: "Both App ID and App Secret are required." });
    }
    try {
      const { appSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const existing = await db.select().from(appSettings)
        .where(eq(appSettings.key, "instagram_app_credentials")).limit(1);
      const value = JSON.stringify({ appId: appId.trim(), appSecret: appSecret.trim() });
      if (existing[0]) {
        await db.update(appSettings).set({ value, updatedAt: new Date() })
          .where(eq(appSettings.key, "instagram_app_credentials"));
      } else {
        await db.insert(appSettings).values({
          key: "instagram_app_credentials",
          value,
          label: "Instagram App Credentials",
          description: "Facebook App ID and App Secret for Instagram API",
        });
      }
      invalidateCredCache();
      // Warm the cache immediately
      await getCreds();
      console.log("[Instagram] App credentials saved to DB");
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ════════════════════════════════════════════════════════════════════════
     TOKEN AUTO-REFRESH — refresh a long-lived token before it expires.
     Long-lived tokens are valid 60 days and can be refreshed any time
     after they are at least 24 hours old.
     ════════════════════════════════════════════════════════════════════════ */

  app.post("/api/instagram/token/refresh", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    // Support refreshing a specific account id, or the active one
    const connectionId: number | undefined = req.body?.connectionId ? Number(req.body.connectionId) : undefined;
    try {
      const allConns = await getAllConnections(adminUserId);
      const connsToRefresh = connectionId
        ? allConns.filter(c => c.id === connectionId)
        : allConns; // refresh all when called from nightly scheduler

      const results: { id: number; username: string; ok: boolean; error?: string }[] = [];

      for (const conn of connsToRefresh) {
        try {
          const refreshed = await refreshLongLived(conn.accessToken);
          const newExpiry = refreshed.expires_in
            ? new Date(Date.now() + refreshed.expires_in * 1000)
            : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
          await db.update(instagramConnections)
            .set({ accessToken: refreshed.access_token, tokenExpiresAt: newExpiry, updatedAt: new Date() })
            .where(eq(instagramConnections.id, conn.id));
          console.log(`[Instagram] Token refreshed for @${conn.username}, expires ${newExpiry.toISOString()}`);
          results.push({ id: conn.id, username: conn.username || "", ok: true });
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message || err.message || "refresh_failed";
          console.error(`[Instagram] Token refresh failed for @${conn.username}:`, msg);
          results.push({ id: conn.id, username: conn.username || "", ok: false, error: msg });
        }
      }
      res.json({ ok: true, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ════════════════════════════════════════════════════════════════════════
     WEBHOOKS — receive real-time Instagram events (comments, DMs, mentions,
     story replies) via the Instagram Graph API webhook.

     Setup flow:
     1. Admin saves App ID + Secret (above).
     2. Admin sets a Webhook Verify Token in the dashboard.
     3. Admin copies the callback URL and pastes it in Meta Developer Console
        → App → Webhooks → Instagram → Add Callback.
     4. Meta hits GET /api/instagram/webhook to verify; we check the token.
     5. On live events Meta sends POST /api/instagram/webhook with HMAC-SHA256
        signature in x-hub-signature-256 header.
     ════════════════════════════════════════════════════════════════════════ */

  // GET — webhook verification handshake (called by Meta when you save the webhook URL)
  app.get("/api/instagram/webhook", (req: Request, res: Response) => {
    const mode      = req.query["hub.mode"]         as string;
    const token     = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"]    as string;

    const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "urban-culture-hub-ig";
    if (mode === "subscribe" && token === verifyToken) {
      console.log("[Instagram Webhook] Verification handshake accepted");
      return res.status(200).send(challenge);
    }
    console.warn("[Instagram Webhook] Verification failed — token mismatch");
    res.status(403).json({ error: "Forbidden — verify token mismatch" });
  });

  // POST — incoming events from Meta
  app.post("/api/instagram/webhook", async (req: Request, res: Response) => {
    // Immediately ACK — Meta requires 200 within 5s or it retries
    res.status(200).json({ ok: true });

    const rawBody    = (req as any).rawBody as Buffer | undefined;
    const sigHeader  = req.headers["x-hub-signature-256"] as string | undefined;

    // Validate HMAC-SHA256 signature using our App Secret
    if (rawBody && sigHeader) {
      try {
        const crypto = await import("crypto");
        const { appSecret } = await getCreds();
        const secret = appSecret || IG_APP_SECRET;
        if (secret) {
          const expected = "sha256=" + crypto.createHmac("sha256", secret)
            .update(rawBody).digest("hex");
          if (sigHeader !== expected) {
            console.warn("[Instagram Webhook] Invalid signature — ignoring payload");
            return;
          }
        }
      } catch (e) {
        console.error("[Instagram Webhook] Signature check error:", e);
      }
    }

    const body = req.body as any;
    console.log("[Instagram Webhook] Event received:", JSON.stringify(body).slice(0, 400));

    // Fire-and-forget background processing (200 already sent above)
    ;(async () => {
      const { generateDraftReply } = await import("./instagramAutomationScheduler");
      const entries: any[] = body?.entry || [];

      for (const entry of entries) {
        const igUserId: string = String(entry.id || "");
        const changes: any[] = entry?.changes || [];

        // Find which admin connection owns this Instagram account
        const connRows = igUserId
          ? await db.select().from(instagramConnections)
              .where(eq(instagramConnections.instagramUserId, igUserId)).limit(1)
          : [];
        const conn = connRows[0] || null;

        for (const change of changes) {
          const field = change?.field as string;
          const value = change?.value as any;

          // ── Comments ──────────────────────────────────────────────────────
          if (field === "comments") {
            const commentText = value?.text || "";
            const username    = value?.from?.username || "iemand";
            const mediaId     = value?.media?.id || "";
            const commentId   = value?.id || "";
            console.log(`[Instagram Webhook] Comment on ${mediaId} from @${username}: "${commentText}"`);

            let suggestedReply = "";
            let actionId: number | undefined;

            if (conn && commentId) {
              // Generate AI draft reply
              try {
                const personaRows = await db.select().from(instagramAiPersona)
                  .where(eq(instagramAiPersona.adminUserId, conn.adminUserId)).limit(1);
                const { buildPersonaSystemPrompt } = await import("./instagramAiRoutes");
                const systemPrompt = buildPersonaSystemPrompt(personaRows[0] || null);
                suggestedReply = await generateDraftReply(commentText, systemPrompt, { username });
              } catch (e: any) {
                console.warn("[IG Webhook] Draft reply generation failed:", e.message);
              }

              // Save as pending action (avoid duplicates)
              try {
                const existing = await db.select().from(instagramAiActions)
                  .where(and(
                    eq(instagramAiActions.adminUserId, conn.adminUserId),
                    eq(instagramAiActions.commentId, commentId),
                  )).limit(1);

                if (existing.length === 0) {
                  const [action] = await db.insert(instagramAiActions).values({
                    adminUserId: conn.adminUserId,
                    triggerType: "comment_received",
                    triggerData: { commentId, mediaId, source: "webhook", username },
                    rawAiOutput: suggestedReply,
                    status: "pending",
                    mediaId: mediaId || null,
                    commentId: commentId || null,
                    sourceText: commentText,
                  }).returning();
                  actionId = action.id;
                }
              } catch (e: any) {
                console.warn("[IG Webhook] Action save failed:", e.message);
              }
            }

            // Push notification to admin
            await notifyIgNewComment({
              adminUserId: conn?.adminUserId,
              username,
              commentText,
              suggestedReply: suggestedReply || undefined,
              actionId,
            });

          // ── Mentions ───────────────────────────────────────────────────────
          } else if (field === "mentions") {
            const username = value?.from?.username || "iemand";
            const mediaId  = value?.media_id || "";
            const caption  = value?.caption || "";
            console.log(`[Instagram Webhook] Mention in media ${mediaId} from @${username}`);
            await notifyIgMention({ username, mediaId, caption });

          // ── Direct Messages ────────────────────────────────────────────────
          } else if (field === "messages") {
            const senderId = value?.sender?.id || "";
            const message  = value?.message?.text || "";
            console.log(`[Instagram Webhook] DM from ${senderId}`);
            await notifyIgDM({ senderId, message });

          } else if (field === "story_insights") {
            console.log(`[Instagram Webhook] Story insight for ${value?.media_id}`);
          } else {
            console.log(`[Instagram Webhook] Unhandled webhook field: ${field}`);
          }
        }
      }
    })().catch(err => console.error("[Instagram Webhook] Background processing error:", err.message));
  });

  // GET — current webhook config status
  app.get("/api/instagram/webhook/status", requireAdmin, async (req: Request, res: Response) => {
    const { appId } = await getCreds();
    const effectiveAppId = appId || IG_APP_ID;
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host  = req.headers["x-forwarded-host"] || req.headers.host || "";
    const callbackUrl = `${proto}://${host}/api/instagram/webhook`;
    res.json({
      callbackUrl,
      verifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "urban-culture-hub-ig",
      hasAppId: !!effectiveAppId,
      hasAppSecret: !!(await getCreds()).appSecret || !!IG_APP_SECRET,
      subscribeUrl: effectiveAppId
        ? `https://developers.facebook.com/apps/${effectiveAppId}/webhooks/`
        : null,
    });
  });

  // POST — manually trigger a webhook subscription (calls Meta Graph API)
  app.post("/api/instagram/webhook/subscribe", requireAdmin, async (req: Request, res: Response) => {
    const session = (req as any).session;
    const adminUserId = session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "No connected Instagram account" });

    const { appId, appSecret } = await getCreds();
    const effectiveAppId     = appId     || IG_APP_ID;
    const effectiveAppSecret = appSecret || IG_APP_SECRET;
    if (!effectiveAppId || !effectiveAppSecret) {
      return res.status(400).json({ error: "App ID and App Secret must be configured first." });
    }

    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host  = req.headers["x-forwarded-host"] || req.headers.host || "";
    const callbackUrl = process.env.INSTAGRAM_WEBHOOK_CALLBACK_URL
      || `${proto}://${host}/api/instagram/webhook`;
    const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || "urban-culture-hub-ig";

    try {
      // Subscribe to Instagram webhook fields via the App's system user access token
      // First get an app access token (appId|appSecret)
      const appTokenRes = await axios.get("https://graph.facebook.com/oauth/access_token", {
        params: {
          client_id:     effectiveAppId,
          client_secret: effectiveAppSecret,
          grant_type:    "client_credentials",
        },
      });
      const appToken: string = appTokenRes.data.access_token;

      const subRes = await axios.post(
        `https://graph.facebook.com/v18.0/${effectiveAppId}/subscriptions`,
        null,
        {
          params: {
            object:        "instagram",
            callback_url:  callbackUrl,
            fields:        "comments,mentions,messages,story_insights",
            verify_token:  verifyToken,
            access_token:  appToken,
          },
        },
      );
      console.log("[Instagram Webhook] Subscription created:", subRes.data);
      res.json({ ok: true, data: subRes.data });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message;
      console.error("[Instagram Webhook] Subscribe error:", msg);
      res.status(502).json({ error: msg });
    }
  });

  // POST /api/instagram/profile/refresh — pull latest profile from Instagram Graph API and persist
  app.post("/api/instagram/profile/refresh", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "No active Instagram connection" });
    try {
      const info = await axios.get(`${IG_GRAPH}/${conn.instagramUserId}`, {
        params: {
          fields: "id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,account_type,website",
          access_token: conn.accessToken,
        },
      });
      const d = info.data;
      await db.update(instagramConnections)
        .set({
          username: d.username || conn.username,
          name: d.name || conn.name,
          biography: d.biography ?? conn.biography,
          website: d.website ?? conn.website,
          profilePictureUrl: d.profile_picture_url ?? conn.profilePictureUrl,
          followersCount: d.followers_count ?? conn.followersCount,
          mediaCount: d.media_count ?? conn.mediaCount,
          accountType: d.account_type ?? conn.accountType,
          updatedAt: new Date(),
        })
        .where(eq(instagramConnections.id, conn.id));
      res.json({ ok: true, username: d.username });
    } catch (err: any) {
      console.error("[IG] Profile refresh error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/instagram/leads — AI-scored lead discovery
  const _leadsCache = new Map<number, { ts: number; leads: any[] }>();
  const LEADS_CACHE_MS = 30 * 60 * 1000;

  app.get("/api/instagram/leads", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });

    const cached = _leadsCache.get(adminUserId);
    if (cached && Date.now() - cached.ts < LEADS_CACHE_MS) {
      return res.json({ leads: cached.leads, cached: true });
    }

    const conn = await getConnection(adminUserId);
    if (!conn) return res.status(404).json({ error: "No active Instagram connection" });

    try {
      const mediaRes = await axios.get(`${IG_GRAPH}/${conn.instagramUserId}/media`, {
        params: { fields: "id,caption,timestamp", limit: 20, access_token: conn.accessToken },
      });
      const posts: any[] = mediaRes.data?.data || [];

      type UserData = {
        texts: string[];
        count: number;
        postIds: string[];
        sources: string[];
        latestCommentId?: string;
        latestCommentPostId?: string;
        latestCommentText?: string;
        latestTs?: string;
      };
      const commentsByUser: Record<string, UserData> = {};

      const addUser = (username: string, text: string, postId: string, source: string, commentId?: string, ts?: string) => {
        const u = username.replace(/^@/, "").trim();
        if (!u) return;
        if (!commentsByUser[u]) commentsByUser[u] = { texts: [], count: 0, postIds: [], sources: [] };
        const entry = commentsByUser[u];
        entry.texts.push(text);
        entry.count++;
        if (!entry.postIds.includes(postId)) entry.postIds.push(postId);
        if (!entry.sources.includes(source)) entry.sources.push(source);
        if (commentId && (!entry.latestTs || (ts && ts > entry.latestTs))) {
          entry.latestCommentId = commentId;
          entry.latestCommentPostId = postId;
          entry.latestCommentText = text;
          entry.latestTs = ts;
        }
      };

      await Promise.allSettled(posts.slice(0, 20).map(async (post: any) => {
        try {
          const commRes = await axios.get(`${IG_GRAPH}/${post.id}/comments`, {
            params: { fields: "id,username,text,timestamp", limit: 30, access_token: conn.accessToken },
          });
          const comments: any[] = commRes.data?.data || [];
          for (const c of comments) addUser(c.username || "", c.text || "", post.id, "comment", c.id, c.timestamp);
          const captionMentions = (post.caption || "").match(/@([A-Za-z0-9_.]+)/g) || [];
          for (const m of captionMentions) addUser(m.slice(1), `mentioned in caption: "${(post.caption || "").slice(0, 80)}"`, post.id, "caption_mention");
          for (const c of comments) {
            const mentionsInComment = (c.text || "").match(/@([A-Za-z0-9_.]+)/g) || [];
            for (const m of mentionsInComment) addUser(m.slice(1), `mentioned in comment by @${c.username}: "${c.text.slice(0, 60)}"`, post.id, "comment_mention");
          }
        } catch { /* skip post */ }
      }));

      try {
        const taggedRes = await axios.get(`${IG_GRAPH}/${conn.instagramUserId}/tags`, {
          params: { fields: "id,username,timestamp", limit: 20, access_token: conn.accessToken },
        });
        for (const t of (taggedRes.data?.data || []) as any[]) {
          if (t.username) addUser(t.username, "tagged our account", t.id || "tagged", "tagged_post");
        }
      } catch { /* permission may not be granted */ }

      const topUsers = Object.entries(commentsByUser).sort((a, b) => b[1].count - a[1].count).slice(0, 25);
      if (topUsers.length === 0) return res.json({ leads: [], cached: false });

      const { aiChat } = await import("./aiRouter");
      const usersText = topUsers.map(([username, data], i) =>
        `${i + 1}. @${username} — ${data.count} interaction(s) via [${data.sources.join(", ")}]. Sample: "${data.texts.slice(0, 2).join(" / ")}"`
      ).join("\n");

      const msg = await aiChat({
        role: "instagram",
        maxTokens: 1400,
        system: "You are an Instagram lead scoring expert. Score users as potential business leads. Return ONLY a JSON array.",
        messages: [{
          role: "user",
          content: `Score these Instagram users as leads for an urban culture brand.\n\n${usersText}\n\nReturn ONLY a JSON array:\n[\n  { "username": "...", "score": 1-10, "note": "brief reason" }\n]`,
        }],
      });

      const jsonMatch = (msg.text || "").match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array in AI response");
      let leads = JSON.parse(jsonMatch[0]) as any[];
      leads = leads.map(l => {
        const ud = commentsByUser[l.username];
        return { ...l, commentCount: ud?.count || 1, sources: ud?.sources || ["comment"],
          latestCommentId: ud?.latestCommentId, latestCommentPostId: ud?.latestCommentPostId, latestCommentText: ud?.latestCommentText };
      }).sort((a, b) => (b.score || 0) - (a.score || 0));

      _leadsCache.set(adminUserId, { ts: Date.now(), leads });
      return res.json({ leads, cached: false });
    } catch (err: any) {
      console.error("[IG Leads] discovery error:", err.message);
      return res.status(500).json({ error: "Lead discovery failed: " + err.message });
    }
  });

  // POST /api/instagram/leads/notes — persist a note for a lead
  const _leadNotesStore = new Map<string, string>();

  app.post("/api/instagram/leads/notes", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const { username, note } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });

    const key = `${adminUserId}:${username}`;
    _leadNotesStore.set(key, String(note || "").trim());

    try {
      const insertPayload: InsertInstagramAiAction = {
        adminUserId,
        triggerType: "lead_note",
        triggerData: { username, note: note || "" },
        rawAiOutput: String(note || ""),
        status: "saved",
        sourceText: String(note || ""),
        finalSentText: String(note || ""),
      };
      await db.insert(instagramAiActions).values(insertPayload);
    } catch { /* non-critical */ }

    res.json({ ok: true, username, note: _leadNotesStore.get(key) });
  });

  // GET /api/instagram/leads/notes — retrieve notes for leads
  app.get("/api/instagram/leads/notes", requireAdmin, async (req: Request, res: Response) => {
    const adminUserId = (req as any).session?.userId as number | undefined;
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    const prefix = `${adminUserId}:`;
    const notes: Record<string, string> = {};
    for (const [key, val] of _leadNotesStore.entries()) {
      if (key.startsWith(prefix)) notes[key.slice(prefix.length)] = val;
    }
    res.json({ notes });
  });
}
