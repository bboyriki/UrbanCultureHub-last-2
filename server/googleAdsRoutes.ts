/**
 * Google Ads connection + live metrics sync.
 *
 * Auto-syncs spend / impressions / clicks for any campaign whose
 * `external_campaign_id` matches a real Google Ads campaign id, replacing
 * the manual daily-spend logger for connected accounts.
 *
 *   GET  /api/admin/ads/connections                       — list all platform connections
 *   PUT  /api/admin/ads/connections/google                — save/update credentials
 *   POST /api/admin/ads/connections/google/test           — test the connection
 *   POST /api/admin/ads/sync/google                       — pull live metrics now
 *   DELETE /api/admin/ads/connections/google              — disconnect
 *
 * NOTE: Real campaign creation via API requires a Google-approved Basic-access
 *       developer token (multi-day approval). Read access works immediately
 *       with a Test-access token for your own account.
 */
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { adPlatformConnections, adCampaigns, adSpendLogs } from "@shared/schema";
import { and, eq } from "drizzle-orm";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ADS_API_BASE = "https://googleads.googleapis.com/v17";

async function getAccessToken(conn: any): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set in environment");
  if (!conn?.refreshToken) throw new Error("No Google refresh token stored — connect first");

  // Reuse cached access token if still valid (>60s left)
  if (conn.accessToken && conn.accessTokenExpiresAt && new Date(conn.accessTokenExpiresAt).getTime() - Date.now() > 60_000) {
    return conn.accessToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: conn.refreshToken,
    grant_type: "refresh_token",
  });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const json: any = await r.json();
  if (!r.ok) throw new Error(`Token refresh failed: ${json.error_description || json.error || r.statusText}`);

  const expiresAt = new Date(Date.now() + (json.expires_in - 60) * 1000);
  await db.update(adPlatformConnections)
    .set({ accessToken: json.access_token, accessTokenExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(adPlatformConnections.id, conn.id));
  return json.access_token;
}

async function googleAdsSearch(conn: any, query: string): Promise<any[]> {
  const accessToken = await getAccessToken(conn);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": conn.developerToken,
    "Content-Type": "application/json",
  };
  if (conn.loginCustomerId) headers["login-customer-id"] = String(conn.loginCustomerId).replace(/-/g, "");
  const customerId = String(conn.customerId).replace(/-/g, "");
  const url = `${ADS_API_BASE}/customers/${customerId}/googleAds:searchStream`;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ query }) });
  const text = await r.text();
  let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = text; }
  if (!r.ok) {
    const msg = Array.isArray(parsed) ? JSON.stringify(parsed[0]?.error || parsed) : (parsed?.error?.message || text);
    throw new Error(`Google Ads API error: ${msg}`);
  }
  // searchStream returns an array of stream chunks each with "results"
  const out: any[] = [];
  if (Array.isArray(parsed)) for (const chunk of parsed) if (chunk.results) out.push(...chunk.results);
  return out;
}

export function registerGoogleAdsRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: any) => void,
) {
  // ── List all connections (status only — never return secrets) ───────────
  app.get("/api/admin/ads/connections", requireAdmin, async (_req, res) => {
    const rows = await db.select({
      id: adPlatformConnections.id,
      platform: adPlatformConnections.platform,
      customerId: adPlatformConnections.customerId,
      loginCustomerId: adPlatformConnections.loginCustomerId,
      status: adPlatformConnections.status,
      lastSyncAt: adPlatformConnections.lastSyncAt,
      lastSyncError: adPlatformConnections.lastSyncError,
      hasRefreshToken: adPlatformConnections.refreshToken,
      hasDeveloperToken: adPlatformConnections.developerToken,
      updatedAt: adPlatformConnections.updatedAt,
    }).from(adPlatformConnections);
    const sanitized = rows.map(r => ({
      ...r,
      hasRefreshToken: !!r.hasRefreshToken,
      hasDeveloperToken: !!r.hasDeveloperToken,
    }));
    const oauthConfigured = !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
    res.json({ connections: sanitized, env: { googleOauthConfigured: oauthConfigured } });
  });

  // ── Save/update Google Ads creds ────────────────────────────────────────
  app.put("/api/admin/ads/connections/google", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { customerId, loginCustomerId, refreshToken, developerToken } = req.body ?? {};
      if (!customerId) return res.status(400).json({ error: "customerId required" });
      if (!developerToken) return res.status(400).json({ error: "developerToken required (get one from Google Ads UI → Tools → API Center)" });

      const existing = await db.select().from(adPlatformConnections)
        .where(eq(adPlatformConnections.platform, "google")).limit(1);

      const values: any = {
        platform: "google",
        customerId: String(customerId).replace(/-/g, ""),
        loginCustomerId: loginCustomerId ? String(loginCustomerId).replace(/-/g, "") : null,
        developerToken,
        status: "connected",
        lastSyncError: null,
        updatedAt: new Date(),
      };
      // Only overwrite refresh token if provided (so user can update other fields without re-pasting)
      if (refreshToken) { values.refreshToken = refreshToken; values.accessToken = null; values.accessTokenExpiresAt = null; }

      let row;
      if (existing.length) {
        [row] = await db.update(adPlatformConnections).set(values)
          .where(eq(adPlatformConnections.id, existing[0].id)).returning();
      } else {
        if (!refreshToken) return res.status(400).json({ error: "refreshToken required on first connect" });
        [row] = await db.insert(adPlatformConnections).values(values).returning();
      }
      // Return sanitized
      res.json({ id: row.id, platform: row.platform, customerId: row.customerId, status: row.status });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Test connection ─────────────────────────────────────────────────────
  app.post("/api/admin/ads/connections/google/test", requireAdmin, async (_req, res) => {
    try {
      const [conn] = await db.select().from(adPlatformConnections)
        .where(eq(adPlatformConnections.platform, "google")).limit(1);
      if (!conn) return res.status(404).json({ error: "Not connected" });

      const results = await googleAdsSearch(conn, "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1");
      const customer = results[0]?.customer;
      await db.update(adPlatformConnections)
        .set({ status: "connected", lastSyncError: null, updatedAt: new Date() })
        .where(eq(adPlatformConnections.id, conn.id));
      res.json({ ok: true, customer });
    } catch (err: any) {
      const [conn] = await db.select().from(adPlatformConnections)
        .where(eq(adPlatformConnections.platform, "google")).limit(1);
      if (conn) await db.update(adPlatformConnections)
        .set({ status: "error", lastSyncError: err.message, updatedAt: new Date() })
        .where(eq(adPlatformConnections.id, conn.id));
      res.status(400).json({ error: err.message });
    }
  });

  // ── Disconnect ──────────────────────────────────────────────────────────
  app.delete("/api/admin/ads/connections/google", requireAdmin, async (_req, res) => {
    await db.delete(adPlatformConnections).where(eq(adPlatformConnections.platform, "google"));
    res.json({ ok: true });
  });

  // ── Sync live metrics ───────────────────────────────────────────────────
  app.post("/api/admin/ads/sync/google", requireAdmin, async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Math.min(90, Number(req.body?.days) || 7));
      const [conn] = await db.select().from(adPlatformConnections)
        .where(eq(adPlatformConnections.platform, "google")).limit(1);
      if (!conn) return res.status(404).json({ error: "Not connected" });

      // Pull per-day per-campaign metrics for the last N days
      const query = `
        SELECT campaign.id, campaign.name, segments.date,
               metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
        FROM campaign
        WHERE segments.date DURING LAST_${days}_DAYS
      `;
      const rows = await googleAdsSearch(conn, query);

      // Match Google campaigns to our local campaigns by external_campaign_id (string compare)
      const localCampaigns = await db.select().from(adCampaigns)
        .where(eq(adCampaigns.platform, "google"));
      const idMap = new Map(localCampaigns.filter(c => c.externalCampaignId).map(c => [String(c.externalCampaignId), c]));

      let synced = 0, skipped = 0;
      for (const row of rows) {
        const gid = String(row.campaign?.id);
        const local = idMap.get(gid);
        if (!local) { skipped++; continue; }
        const date: string = row.segments?.date;
        const amountCents = Math.round(Number(row.metrics?.costMicros || 0) / 10000); // micros → cents (EUR)
        const impressions = Number(row.metrics?.impressions || 0);
        const clicks = Number(row.metrics?.clicks || 0);
        const conversions = Math.round(Number(row.metrics?.conversions || 0));

        // Upsert by (campaignId + date): delete then insert
        await db.delete(adSpendLogs).where(and(
          eq(adSpendLogs.campaignId, local.id),
          eq(adSpendLogs.date, date),
        ));
        await db.insert(adSpendLogs).values({
          campaignId: local.id, date, amountCents, impressions, clicks, conversions,
          notes: "auto-synced from Google Ads API",
        });
        synced++;
      }

      await db.update(adPlatformConnections)
        .set({ lastSyncAt: new Date(), lastSyncError: null, status: "connected", updatedAt: new Date() })
        .where(eq(adPlatformConnections.id, conn.id));
      res.json({ ok: true, synced, skipped, totalRows: rows.length });
    } catch (err: any) {
      const [conn] = await db.select().from(adPlatformConnections)
        .where(eq(adPlatformConnections.platform, "google")).limit(1);
      if (conn) await db.update(adPlatformConnections)
        .set({ status: "error", lastSyncError: err.message, updatedAt: new Date() })
        .where(eq(adPlatformConnections.id, conn.id));
      res.status(500).json({ error: err.message });
    }
  });
}
