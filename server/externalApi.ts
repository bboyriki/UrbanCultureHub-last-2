/**
 * External API — /api/v1/
 *
 * Authenticated via API keys (Authorization: Bearer uch_...)
 * Generated in Admin → API Keys panel.
 *
 * Every route checks:
 *   1. Valid, non-expired API key (requireApiKey middleware)
 *   2. The key has the required scope (checkScope helper)
 *
 * SCOPES
 *   read          — read public/user data
 *   write         — create / update content
 *   admin         — user management, security controls
 *   security      — security checks, ban, unban
 *
 * External website usage:
 *   fetch("https://your-app.up.railway.app/api/v1/health")
 *   fetch("https://your-app.up.railway.app/api/v1/users", {
 *     headers: { Authorization: "Bearer uch_..." }
 *   })
 */

import { type Express, type Request, type Response, NextFunction } from "express";
import { db } from "./db";
import { users, events, locations, apiKeys } from "@shared/schema";
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { requireApiKey } from "./apiKeyRoutes";

// ── Per-key rate limiter (100 req/min) ────────────────────────────────────────
const apiV1Limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => (req as any).apiKey?.id?.toString() ?? req.ip ?? "unknown",
  message: { error: "Rate limit exceeded. Max 100 requests per minute per API key." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Scope checker ─────────────────────────────────────────────────────────────
function checkScope(required: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req as any).apiKey;
    const perms: string[] = key?.permissions ?? [];
    if (perms.includes(required) || perms.includes("admin")) return next();
    return res.status(403).json({
      error: `Forbidden. This endpoint requires the '${required}' scope.`,
      yourScopes: perms,
    });
  };
}

// ── CORS for external sites ───────────────────────────────────────────────────
function apiCors(req: Request, res: Response, next: NextFunction) {
  // Allow any origin — the API key IS the authentication.
  // For stricter control, check against a whitelist env var.
  const allowed = process.env.API_ALLOWED_ORIGINS || "*";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

export function registerExternalApi(app: Express) {

  // Apply CORS + rate limit to all /api/v1/* routes
  app.use("/api/v1", apiCors);
  app.use("/api/v1", apiV1Limiter);

  // ════════════════════════════════════════════════════════════════════════════
  // PUBLIC — no key required
  // ════════════════════════════════════════════════════════════════════════════

  /** Health / connectivity check */
  app.get("/api/v1/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "1.0",
      timestamp: new Date().toISOString(),
      docs: "https://your-app.up.railway.app/api/v1/docs",
    });
  });

  /** API info — list scopes and example endpoints */
  app.get("/api/v1/docs", (_req, res) => {
    res.json({
      version: "1.0",
      auth: "Pass your key as: Authorization: Bearer uch_...",
      scopes: {
        read:     "Read users, events, locations",
        write:    "Create / update content",
        admin:    "User management, full access",
        security: "Ban/unban users, security checks",
      },
      endpoints: {
        "GET  /api/v1/health":               "No key required — connectivity check",
        "GET  /api/v1/users":                "scope: read — list users",
        "GET  /api/v1/users/:id":            "scope: read — get user",
        "PATCH /api/v1/users/:id/role":      "scope: admin — change user role",
        "POST /api/v1/users/:id/ban":        "scope: security — ban user",
        "DELETE /api/v1/users/:id/ban":      "scope: security — unban user",
        "GET  /api/v1/events":               "scope: read — list events",
        "GET  /api/v1/events/:id":           "scope: read — get event",
        "GET  /api/v1/locations":            "scope: read — list locations",
        "GET  /api/v1/security/banned":      "scope: security — list banned users",
        "GET  /api/v1/security/audit":       "scope: security — API key usage log",
        "POST /api/v1/security/check-user":  "scope: security — check user status",
      },
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AUTHENTICATED — key required from here down
  // ════════════════════════════════════════════════════════════════════════════

  // ── Users ─────────────────────────────────────────────────────────────────

  app.get("/api/v1/users", requireApiKey, checkScope("read"), async (req, res) => {
    try {
      const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string | undefined;

      let query = db.select({
        id:          users.id,
        displayName: users.displayName,
        email:       users.email,
        role:        users.role,
        isBanned:    users.isBanned,
        createdAt:   users.createdAt,
        lastLoginAt: users.lastLoginAt,
      }).from(users);

      if (search) {
        query = (query as any).where(
          or(ilike(users.email, `%${search}%`), ilike(users.displayName, `%${search}%`))
        );
      }

      const rows = await (query as any).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);

      res.json({ data: rows, total: Number(count), limit, offset });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/v1/users/:id", requireApiKey, checkScope("read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [user] = await db.select({
        id:          users.id,
        displayName: users.displayName,
        email:       users.email,
        role:        users.role,
        isBanned:    users.isBanned,
        createdAt:   users.createdAt,
        lastLoginAt: users.lastLoginAt,
      }).from(users).where(eq(users.id, id)).limit(1);

      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/v1/users/:id/role", requireApiKey, checkScope("admin"), async (req, res) => {
    try {
      const id   = parseInt(req.params.id);
      const role = req.body.role as string;
      const allowed = ["user", "moderator", "admin", "super_admin"];
      if (!allowed.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${allowed.join(", ")}` });
      }
      await db.update(users).set({ role } as any).where(eq(users.id, id));
      res.json({ success: true, userId: id, role });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Security ──────────────────────────────────────────────────────────────

  app.post("/api/v1/users/:id/ban", requireApiKey, checkScope("security"), async (req, res) => {
    try {
      const id     = parseInt(req.params.id);
      const reason = req.body.reason as string | undefined;
      await db.update(users)
        .set({ isBanned: true, banReason: reason || "Banned via API" } as any)
        .where(eq(users.id, id));
      res.json({ success: true, userId: id, banned: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/v1/users/:id/ban", requireApiKey, checkScope("security"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db.update(users)
        .set({ isBanned: false, banReason: null } as any)
        .where(eq(users.id, id));
      res.json({ success: true, userId: id, banned: false });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/v1/security/banned", requireApiKey, checkScope("security"), async (_req, res) => {
    try {
      const banned = await db.select({
        id:          users.id,
        displayName: users.displayName,
        email:       users.email,
        banReason:   (users as any).banReason,
        createdAt:   users.createdAt,
      }).from(users).where(eq(users.isBanned, true)).orderBy(desc(users.createdAt));
      res.json({ data: banned, total: banned.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/v1/security/check-user", requireApiKey, checkScope("security"), async (req, res) => {
    try {
      const { email, userId } = req.body;
      if (!email && !userId) return res.status(400).json({ error: "Provide email or userId" });

      const condition = email ? eq(users.email, email) : eq(users.id, parseInt(userId));
      const [user] = await db.select({
        id:          users.id,
        displayName: users.displayName,
        email:       users.email,
        role:        users.role,
        isBanned:    users.isBanned,
        createdAt:   users.createdAt,
      }).from(users).where(condition).limit(1);

      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({
        ...user,
        status: user.isBanned ? "banned" : "active",
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/v1/security/audit", requireApiKey, checkScope("security"), async (_req, res) => {
    try {
      const keys = await db.select({
        id:           apiKeys.id,
        name:         apiKeys.name,
        keyPrefix:    apiKeys.keyPrefix,
        permissions:  apiKeys.permissions,
        requestCount: apiKeys.requestCount,
        lastUsedAt:   apiKeys.lastUsedAt,
        isActive:     apiKeys.isActive,
        createdAt:    apiKeys.createdAt,
      }).from(apiKeys).orderBy(desc(apiKeys.lastUsedAt));
      res.json({ data: keys });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Events ────────────────────────────────────────────────────────────────

  app.get("/api/v1/events", requireApiKey, checkScope("read"), async (req, res) => {
    try {
      const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      const rows = await db.select().from(events)
        .orderBy(desc(events.createdAt))
        .limit(limit).offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(events);

      res.json({ data: rows, total: Number(count), limit, offset });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/v1/events/:id", requireApiKey, checkScope("read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
      if (!event) return res.status(404).json({ error: "Event not found" });
      res.json(event);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Locations ─────────────────────────────────────────────────────────────

  app.get("/api/v1/locations", requireApiKey, checkScope("read"), async (req, res) => {
    try {
      const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      const rows = await db.select().from(locations)
        .orderBy(desc(locations.createdAt))
        .limit(locations as any, limit).offset(offset);
      res.json({ data: rows, limit, offset });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/v1/locations/:id", requireApiKey, checkScope("read"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [loc] = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
      if (!loc) return res.status(404).json({ error: "Location not found" });
      res.json(loc);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
