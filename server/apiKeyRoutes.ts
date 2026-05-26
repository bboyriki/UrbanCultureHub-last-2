import { type Express, type Request, type Response, NextFunction } from "express";
import { db } from "./db";
import { apiKeys, users, events, locations } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

const PREFIX = "uch_";

function generateKey(): string {
  return PREFIX + crypto.randomBytes(24).toString("hex");
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function getPrefix(key: string): string {
  return key.slice(0, 12);
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] || "";
  const key = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : (req.query.api_key as string | undefined);
  if (!key || !key.startsWith(PREFIX)) {
    return res.status(401).json({ error: "Missing or invalid API key. Pass it as Authorization: Bearer <key> or ?api_key=<key>" });
  }
  const hash = hashKey(key);
  const [record] = await db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.isActive, true))).limit(1);
  if (!record) return res.status(401).json({ error: "API key not found or revoked." });
  if (record.expiresAt && record.expiresAt < new Date()) {
    return res.status(401).json({ error: "API key has expired." });
  }
  await db.update(apiKeys).set({ lastUsedAt: new Date(), requestCount: record.requestCount + 1 }).where(eq(apiKeys.id, record.id));
  (req as any).apiKey = record;
  next();
}

export function registerApiKeyRoutes(app: Express, requireAdmin: Function, requireAuth: any) {

  // ── Key Management (Firebase-token authenticated via requireAuth) ──────────
  // Switched off the unreliable session lookup: most clients authenticate with a
  // Firebase Bearer token and never set a session cookie, which previously made
  // these routes silently 401 for legitimate users. requireAuth populates req.user.
  const getUserId = (req: Request): number | undefined => (req as any).user?.id;

  app.post("/api/developer/keys", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { name, permissions, expiresAt } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Key name is required" });
    }

    const perms: string[] = Array.isArray(permissions) ? permissions : ["read"];
    const rawKey = generateKey();
    const hash = hashKey(rawKey);
    const prefix = getPrefix(rawKey);

    const [created] = await db.insert(apiKeys).values({
      userId,
      name: name.trim(),
      keyPrefix: prefix,
      keyHash: hash,
      permissions: perms,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
    }).returning();

    res.json({ ...created, key: rawKey, keyHash: undefined });
  });

  app.get("/api/developer/keys", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const keys = await db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      requestCount: apiKeys.requestCount,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));

    res.json(keys);
  });

  app.patch("/api/developer/keys/:id/revoke", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const id = parseInt(req.params.id);
    const [key] = await db.select().from(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId))).limit(1);
    if (!key) return res.status(404).json({ error: "Key not found" });

    await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
    res.json({ success: true });
  });

  app.delete("/api/developer/keys/:id", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const id = parseInt(req.params.id);
    const [key] = await db.select().from(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId))).limit(1);
    if (!key) return res.status(404).json({ error: "Key not found" });

    await db.delete(apiKeys).where(eq(apiKeys.id, id));
    res.json({ success: true });
  });

  // ── Admin: all keys ──────────────────────────────────────────────────────────

  app.get("/api/admin/api-keys", requireAdmin, async (req: Request, res: Response) => {
    const rows = await db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      requestCount: apiKeys.requestCount,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt,
      userId: apiKeys.userId,
      userName: users.displayName,
      userEmail: users.email,
    }).from(apiKeys)
      .leftJoin(users, eq(apiKeys.userId, users.id))
      .orderBy(desc(apiKeys.createdAt));

    res.json(rows);
  });

  app.patch("/api/admin/api-keys/:id/revoke", requireAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
    res.json({ success: true });
  });

  app.delete("/api/admin/api-keys/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
    res.json({ success: true });
  });

  // ── Public API (key-protected) ────────────────────────────────────────────────

  app.get("/api/public/events", requireApiKey, async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
    const offset = parseInt(req.query.offset as string || "0");
    const rows = await db.select({
      id: events.id,
      title: events.title,
      description: events.description,
      location: events.location,
      date: events.date,
      category: events.category,
      image: events.image,
      price: events.price,
      capacity: events.capacity,
    }).from(events).orderBy(desc(events.date)).limit(limit).offset(offset);

    res.json({ data: rows, limit, offset, count: rows.length });
  });

  app.get("/api/public/locations", requireApiKey, async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
    const offset = parseInt(req.query.offset as string || "0");
    const rows = await db.select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
      address: locations.address,
      latitude: locations.latitude,
      longitude: locations.longitude,
      type: locations.type,
      images: locations.images,
    }).from(locations).limit(limit).offset(offset);

    res.json({ data: rows, limit, offset, count: rows.length });
  });

  app.get("/api/public/artists", requireApiKey, async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
    const offset = parseInt(req.query.offset as string || "0");
    const rows = await db.select({
      id: users.id,
      displayName: users.displayName,
      bio: users.bio,
      profilePicture: users.profilePicture,
      role: users.role,
      artType: users.artType,
      location: users.location,
    }).from(users)
      .where(eq(users.role, "artist"))
      .limit(limit).offset(offset);

    res.json({ data: rows, limit, offset, count: rows.length });
  });
}
