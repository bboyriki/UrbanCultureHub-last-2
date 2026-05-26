import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { db } from "./db";
import { sql, eq, desc, and, gte, lte, ilike, or } from "drizzle-orm";
import {
  credTransactions, crews, crewMembers, freestyleChallenges, challengeEntries,
  challengeVotes, cyphers, graffitiTags, beats, radioSubmissions, hallOfFame,
  users, events
} from "@shared/schema";
import { aiChat } from "./aiRouter";

const router = Router();
// Migrated to central aiRouter. Anthropic SDK no longer used directly here.

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please wait a moment before trying again." },
  keyGenerator: (req) => {
    const userId = (req as any).user?.id;
    if (userId) return `user:${userId}`;
    return ipKeyGenerator(req);
  },
});

function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function sanitizeText(text: string | undefined | null, maxLength = 500): string {
  if (!text) return "";
  return String(text).slice(0, maxLength).trim();
}

// ─── Helper: Award Cred ──────────────────────────────────────────────────────
async function awardCred(userId: number, amount: number, reason: string, referenceId?: number, referenceType?: string) {
  await db.insert(credTransactions).values({ userId, amount, reason, referenceId, referenceType });
  await db.execute(sql`UPDATE users SET cred_score = cred_score + ${amount} WHERE id = ${userId}`);
}

// ─── Street Cred Score ───────────────────────────────────────────────────────
router.get("/cred/leaderboard", async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, display_name, profile_picture as avatar_url, cred_score, art_type as discipline
      FROM users
      WHERE cred_score > 0
      ORDER BY cred_score DESC
      LIMIT 50
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/cred/my-score", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const user = await db.execute(sql`SELECT cred_score FROM users WHERE id = ${req.user.id}`);
    const txns = await db.select().from(credTransactions)
      .where(eq(credTransactions.userId, req.user.id))
      .orderBy(desc(credTransactions.createdAt))
      .limit(20);
    res.json({ score: (user.rows[0] as any)?.cred_score ?? 0, transactions: txns });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Crews ───────────────────────────────────────────────────────────────────
router.get("/crews", async (req, res) => {
  try {
    const { discipline, search } = req.query as any;
    let q = db.select({
      crew: crews,
      founder: { id: users.id, displayName: users.displayName, avatarUrl: users.profilePicture },
    }).from(crews).leftJoin(users, eq(crews.founderId, users.id));
    const rows = await q.orderBy(desc(crews.createdAt));
    const crewsWithMembers = await Promise.all(rows.map(async (r) => {
      const members = await db.select({ count: sql<number>`count(*)` }).from(crewMembers)
        .where(eq(crewMembers.crewId, r.crew.id));
      return { ...r.crew, founder: r.founder, memberCount: Number(members[0]?.count ?? 0) };
    }));
    let result = crewsWithMembers;
    if (discipline) result = result.filter(c => c.discipline === discipline);
    if (search) result = result.filter(c => c.name.toLowerCase().includes((search as string).toLowerCase()));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/crews/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [crew] = await db.select().from(crews).where(eq(crews.id, id));
    if (!crew) return res.status(404).json({ error: "Crew not found" });
    const members = await db.execute(sql`
      SELECT cm.id, cm.role, cm.joined_at, u.id as user_id, u.display_name, u.profile_picture as avatar_url, u.email, u.art_type as discipline, u.cred_score
      FROM crew_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.crew_id = ${id}
      ORDER BY cm.joined_at ASC
    `);
    res.json({ ...crew, members: members.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/crews", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const name = sanitizeText(req.body.name, 100);
    const description = sanitizeText(req.body.description, 1000);
    const discipline = sanitizeText(req.body.discipline, 50);
    const city = sanitizeText(req.body.city, 100);
    const country = sanitizeText(req.body.country, 100);
    const foundedYear = req.body.foundedYear ? Number(req.body.foundedYear) : undefined;
    const instagram = sanitizeText(req.body.instagram, 100);
    const logoUrl = req.body.logoUrl;
    const bannerUrl = req.body.bannerUrl;
    if (!name) return res.status(400).json({ error: "Crew name is required" });
    if (!isSafeUrl(logoUrl)) return res.status(400).json({ error: "Invalid logo URL" });
    if (!isSafeUrl(bannerUrl)) return res.status(400).json({ error: "Invalid banner URL" });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();
    const [crew] = await db.insert(crews).values({
      name, slug, description, discipline: discipline || "breaking",
      city, country: country || "Netherlands", foundedYear, instagram,
      logoUrl, bannerUrl, founderId: req.user.id, isPublic: true
    }).returning();
    await db.insert(crewMembers).values({ crewId: crew.id, userId: req.user.id, role: "founder" });
    await awardCred(req.user.id, 50, "Created a crew", crew.id, "crew");
    res.json(crew);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/crews/:id", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const [crew] = await db.select().from(crews).where(eq(crews.id, id));
    if (!crew) return res.status(404).json({ error: "Not found" });
    if (crew.founderId !== req.user.id && req.user.role !== "admin" && req.user.role !== "super_admin")
      return res.status(403).json({ error: "Forbidden" });
    const { name, description, discipline, city, country, foundedYear, instagram, logoUrl, bannerUrl } = req.body;
    const [updated] = await db.update(crews).set({
      name, description, discipline, city, country, foundedYear, instagram, logoUrl, bannerUrl
    }).where(eq(crews.id, id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/crews/:id", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const [crew] = await db.select().from(crews).where(eq(crews.id, id));
    if (!crew) return res.status(404).json({ error: "Not found" });
    if (crew.founderId !== req.user.id && req.user.role !== "admin" && req.user.role !== "super_admin")
      return res.status(403).json({ error: "Forbidden" });
    await db.delete(crews).where(eq(crews.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/crews/:id/join", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const crewId = parseInt(req.params.id);
    const existing = await db.select().from(crewMembers)
      .where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.userId, req.user.id)));
    if (existing.length > 0) return res.status(400).json({ error: "Already a member" });
    await db.insert(crewMembers).values({ crewId, userId: req.user.id, role: "member" });
    await awardCred(req.user.id, 10, "Joined a crew", crewId, "crew");
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/crews/:id/leave", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const crewId = parseInt(req.params.id);
    await db.delete(crewMembers)
      .where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.userId, req.user.id)));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/crews/:id/members/:userId", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const crewId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const [crew] = await db.select().from(crews).where(eq(crews.id, crewId));
    if (!crew) return res.status(404).json({ error: "Not found" });
    if (crew.founderId !== req.user.id && req.user.role !== "admin" && req.user.role !== "super_admin")
      return res.status(403).json({ error: "Forbidden" });
    await db.delete(crewMembers).where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.userId, userId)));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Freestyle Challenges ─────────────────────────────────────────────────────
router.get("/challenges", async (req, res) => {
  try {
    const all = await db.select().from(freestyleChallenges).orderBy(desc(freestyleChallenges.createdAt));
    res.json(all);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/challenges/active", async (req, res) => {
  try {
    const now = new Date();
    const [active] = await db.select().from(freestyleChallenges)
      .where(and(eq(freestyleChallenges.status, "active"), lte(freestyleChallenges.startDate, now), gte(freestyleChallenges.endDate, now)))
      .orderBy(desc(freestyleChallenges.createdAt));
    res.json(active ?? null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/challenges", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  if (!["admin", "super_admin"].includes(req.user.role)) return res.status(403).json({ error: "Admin only" });
  try {
    const { title, description, theme, discipline, startDate, endDate } = req.body;
    const [ch] = await db.insert(freestyleChallenges).values({
      title, description, theme, discipline: discipline || "breaking",
      startDate: new Date(startDate), endDate: new Date(endDate),
      createdBy: req.user.id, status: "active"
    }).returning();
    res.json(ch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/challenges/:id/entries", async (req, res) => {
  try {
    const challengeId = parseInt(req.params.id);
    const entries = await db.execute(sql`
      SELECT ce.*, u.display_name, u.profile_picture as avatar_url, u.email
      FROM challenge_entries ce JOIN users u ON u.id = ce.user_id
      WHERE ce.challenge_id = ${challengeId}
      ORDER BY ce.vote_count DESC, ce.created_at ASC
    `);
    res.json(entries.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/challenges/:id/entries", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const challengeId = parseInt(req.params.id);
    const videoUrl = req.body.videoUrl;
    const caption = sanitizeText(req.body.caption, 500);
    if (!videoUrl || !isSafeUrl(videoUrl)) return res.status(400).json({ error: "A valid video URL is required" });
    const [entry] = await db.insert(challengeEntries).values({
      challengeId, userId: req.user.id, videoUrl, caption
    }).returning();
    await awardCred(req.user.id, 25, "Submitted a challenge entry", entry.id, "challenge_entry");
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/challenges/entries/:entryId/vote", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const entryId = parseInt(req.params.entryId);
    const existing = await db.select().from(challengeVotes)
      .where(and(eq(challengeVotes.entryId, entryId), eq(challengeVotes.userId, req.user.id)));
    if (existing.length > 0) {
      // Unvote
      await db.delete(challengeVotes).where(and(eq(challengeVotes.entryId, entryId), eq(challengeVotes.userId, req.user.id)));
      await db.execute(sql`UPDATE challenge_entries SET vote_count = vote_count - 1 WHERE id = ${entryId}`);
      return res.json({ voted: false });
    }
    await db.insert(challengeVotes).values({ entryId, userId: req.user.id });
    await db.execute(sql`UPDATE challenge_entries SET vote_count = vote_count + 1 WHERE id = ${entryId}`);
    // Award cred to entry author
    const [entry] = await db.select().from(challengeEntries).where(eq(challengeEntries.id, entryId));
    if (entry && entry.userId !== req.user.id)
      await awardCred(entry.userId, 5, "Received a vote on challenge entry", entryId, "challenge_vote");
    res.json({ voted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cyphers ─────────────────────────────────────────────────────────────────
router.get("/cyphers", async (req, res) => {
  try {
    const { lat, lon, radius } = req.query as any;
    const cyph = await db.execute(sql`
      SELECT c.*, u.display_name as host_name, u.profile_picture as host_avatar, u.email as host_username
      FROM cyphers c JOIN users u ON u.id = c.host_id
      WHERE c.is_active = true AND c.ends_at > NOW()
      ORDER BY c.starts_at ASC
    `);
    let result = cyph.rows as any[];
    if (lat && lon && radius) {
      const R = 6371;
      const maxDist = parseFloat(radius) || 10;
      result = result.filter((c: any) => {
        const dLat = (c.lat - parseFloat(lat)) * Math.PI / 180;
        const dLon = (c.lon - parseFloat(lon)) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(parseFloat(lat)*Math.PI/180) * Math.cos(c.lat*Math.PI/180) * Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= maxDist;
      });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/cyphers", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const { title, discipline, description, lat, lon, locationName, startsAt, endsAt } = req.body;
    const [cyph] = await db.insert(cyphers).values({
      hostId: req.user.id, title, discipline: discipline || "breaking",
      description, lat: parseFloat(lat), lon: parseFloat(lon),
      locationName, startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : undefined, isActive: true
    }).returning();
    await awardCred(req.user.id, 20, "Started a cypher", cyph.id, "cypher");
    res.json(cyph);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/cyphers/:id", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    await db.update(cyphers).set({ isActive: false }).where(eq(cyphers.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/cyphers/:id/attend", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    await db.execute(sql`UPDATE cyphers SET attendee_count = attendee_count + 1 WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Graffiti Wall ────────────────────────────────────────────────────────────
router.get("/graffiti", async (req, res) => {
  try {
    const tags = await db.execute(sql`
      SELECT gt.*, u.display_name, u.profile_picture as avatar_url, u.email
      FROM graffiti_tags gt JOIN users u ON u.id = gt.user_id
      ORDER BY gt.layer ASC, gt.created_at ASC
      LIMIT 200
    `);
    res.json(tags.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/graffiti", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const type = sanitizeText(req.body.type, 20);
    const imageUrl = req.body.imageUrl;
    const text = sanitizeText(req.body.text, 200);
    const color = /^#[0-9a-fA-F]{3,8}$/.test(req.body.color ?? "") ? req.body.color : "#ffffff";
    const posX = isFinite(Number(req.body.posX)) ? Number(req.body.posX) : 0;
    const posY = isFinite(Number(req.body.posY)) ? Number(req.body.posY) : 0;
    const rotation = isFinite(Number(req.body.rotation)) ? Number(req.body.rotation) : 0;
    const scale = isFinite(Number(req.body.scale)) ? Math.min(Math.max(Number(req.body.scale), 0.1), 10) : 1;
    if (imageUrl && !isSafeUrl(imageUrl)) return res.status(400).json({ error: "Invalid image URL" });
    const lastTag = await db.execute(sql`SELECT MAX(layer) as max_layer FROM graffiti_tags`);
    const maxLayer = (lastTag.rows[0] as any)?.max_layer ?? 0;
    const [tag] = await db.insert(graffitiTags).values({
      userId: req.user.id, type: type || "sticker", imageUrl, text,
      color, posX, posY, rotation, scale, layer: maxLayer + 1
    }).returning();
    await awardCred(req.user.id, 5, "Added to the Graffiti Wall", tag.id, "graffiti_tag");
    res.json(tag);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/graffiti/:id", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const [tag] = await db.select().from(graffitiTags).where(eq(graffitiTags.id, id));
    if (!tag) return res.status(404).json({ error: "Not found" });
    if (tag.userId !== req.user.id && req.user.role !== "admin" && req.user.role !== "super_admin")
      return res.status(403).json({ error: "Forbidden" });
    await db.delete(graffitiTags).where(eq(graffitiTags.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Beat Lab ─────────────────────────────────────────────────────────────────
router.get("/beats", async (req, res) => {
  try {
    const { genre, search } = req.query as any;
    const all = await db.execute(sql`
      SELECT b.*, u.display_name, u.profile_picture as avatar_url, u.email
      FROM beats b JOIN users u ON u.id = b.user_id
      WHERE b.is_public = true
      ORDER BY b.created_at DESC
      LIMIT 100
    `);
    let result = all.rows as any[];
    if (genre) result = result.filter((b: any) => b.genre === genre);
    if (search) result = result.filter((b: any) => b.title.toLowerCase().includes(search.toLowerCase()));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/beats", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const title = sanitizeText(req.body.title, 150);
    const genre = sanitizeText(req.body.genre, 50);
    const rawBpm = Number(req.body.bpm);
    const bpm = isFinite(rawBpm) && rawBpm > 0 && rawBpm <= 300 ? rawBpm : 90;
    const audioUrl = req.body.audioUrl;
    const coverUrl = req.body.coverUrl;
    const rawDuration = Number(req.body.duration);
    const duration = isFinite(rawDuration) && rawDuration > 0 ? rawDuration : undefined;
    const tags = Array.isArray(req.body.tags) ? req.body.tags.slice(0, 10).map((t: any) => sanitizeText(String(t), 30)) : [];
    if (!title) return res.status(400).json({ error: "Beat title is required" });
    if (!audioUrl || !isSafeUrl(audioUrl)) return res.status(400).json({ error: "A valid audio URL is required" });
    if (!isSafeUrl(coverUrl)) return res.status(400).json({ error: "Invalid cover URL" });
    const [beat] = await db.insert(beats).values({
      userId: req.user.id, title, genre: genre || "hip-hop",
      bpm, audioUrl, coverUrl, duration,
      tags, isPublic: true
    }).returning();
    await awardCred(req.user.id, 30, "Shared a beat in Beat Lab", beat.id, "beat");
    res.json(beat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/beats/:id", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const [beat] = await db.select().from(beats).where(eq(beats.id, id));
    if (!beat) return res.status(404).json({ error: "Not found" });
    if (beat.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    const { title, genre, bpm, coverUrl, tags, isPublic } = req.body;
    const [updated] = await db.update(beats).set({ title, genre, bpm, coverUrl, tags, isPublic }).where(eq(beats.id, id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/beats/:id", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const id = parseInt(req.params.id);
    const [beat] = await db.select().from(beats).where(eq(beats.id, id));
    if (!beat) return res.status(404).json({ error: "Not found" });
    if (beat.userId !== req.user.id && req.user.role !== "admin" && req.user.role !== "super_admin")
      return res.status(403).json({ error: "Forbidden" });
    await db.delete(beats).where(eq(beats.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/beats/:id/play", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.execute(sql`UPDATE beats SET play_count = play_count + 1 WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Community Radio ──────────────────────────────────────────────────────────
router.get("/radio", async (req, res) => {
  try {
    const { all: showAll } = req.query;
    const whereClause = showAll && ["admin","super_admin"].includes(req.user?.role ?? "") ? sql`1=1` : sql`rs.status = 'approved'`;
    const playlist = await db.execute(sql`
      SELECT rs.*, u.display_name, u.profile_picture as avatar_url, u.email
      FROM radio_submissions rs JOIN users u ON u.id = rs.user_id
      WHERE ${whereClause}
      ORDER BY rs.sort_order ASC, rs.created_at ASC
    `);
    res.json(playlist.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/radio", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const title = sanitizeText(req.body.title, 150);
    const artist = sanitizeText(req.body.artist, 100);
    const genre = sanitizeText(req.body.genre, 50);
    const rawDuration = Number(req.body.duration);
    const duration = isFinite(rawDuration) && rawDuration > 0 ? rawDuration : undefined;
    const audioUrl = req.body.audioUrl;
    const coverUrl = req.body.coverUrl;
    if (!title) return res.status(400).json({ error: "Track title is required" });
    if (!audioUrl || !isSafeUrl(audioUrl)) return res.status(400).json({ error: "A valid audio URL is required" });
    if (!isSafeUrl(coverUrl)) return res.status(400).json({ error: "Invalid cover URL" });
    const isAdmin = ["admin","super_admin"].includes(req.user.role);
    const [sub] = await db.insert(radioSubmissions).values({
      userId: req.user.id, title, artist, genre: genre || "hip-hop",
      duration, audioUrl, coverUrl, status: isAdmin ? "approved" : "pending"
    }).returning();
    await awardCred(req.user.id, 20, "Submitted to Community Radio", sub.id, "radio");
    res.json(sub);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/radio/:id", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  if (!["admin","super_admin"].includes(req.user.role)) return res.status(403).json({ error: "Admin only" });
  try {
    const id = parseInt(req.params.id);
    const { status, sortOrder } = req.body;
    const [updated] = await db.update(radioSubmissions).set({ status, sortOrder }).where(eq(radioSubmissions.id, id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/radio/:id/play", async (req, res) => {
  try {
    await db.execute(sql`UPDATE radio_submissions SET play_count = play_count + 1 WHERE id = ${parseInt(req.params.id)}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Hall of Fame ─────────────────────────────────────────────────────────────
router.get("/hall-of-fame", async (req, res) => {
  try {
    const entries = await db.select().from(hallOfFame).orderBy(hallOfFame.sortOrder, desc(hallOfFame.createdAt));
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/hall-of-fame", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  if (!["admin","super_admin"].includes(req.user.role)) return res.status(403).json({ error: "Admin only" });
  try {
    const { userId, name, discipline, city, country, bio, achievement, year, imageUrl, instagramHandle, sortOrder } = req.body;
    const [entry] = await db.insert(hallOfFame).values({
      userId, name, discipline, city, country: country || "Netherlands",
      bio, achievement, year, imageUrl, instagramHandle,
      sortOrder: sortOrder || 0, addedBy: req.user.id
    }).returning();
    if (userId) await awardCred(userId, 100, "Inducted into the Hall of Fame", entry.id, "hall_of_fame");
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/hall-of-fame/:id", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  if (!["admin","super_admin"].includes(req.user.role)) return res.status(403).json({ error: "Admin only" });
  try {
    const id = parseInt(req.params.id);
    const { name, discipline, city, country, bio, achievement, year, imageUrl, instagramHandle, sortOrder } = req.body;
    const [updated] = await db.update(hallOfFame).set({
      name, discipline, city, country, bio, achievement, year, imageUrl, instagramHandle, sortOrder
    }).where(eq(hallOfFame.id, id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/hall-of-fame/:id", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  if (!["admin","super_admin"].includes(req.user.role)) return res.status(403).json({ error: "Admin only" });
  try {
    await db.delete(hallOfFame).where(eq(hallOfFame.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Style Match (AI) ─────────────────────────────────────────────────────────
router.post("/style-match", aiLimiter, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const discipline = sanitizeText(req.body.discipline, 100);
    const skills = sanitizeText(req.body.skills, 300);
    const bio = sanitizeText(req.body.bio, 500);
    const lookingFor = sanitizeText(req.body.lookingFor, 300);
    // Get sample of other users to match against
    const others = await db.execute(sql`
      SELECT id, display_name, profile_picture as avatar_url, art_type as discipline, bio, home_city as city, cred_score
      FROM users
      WHERE id != ${req.user.id} AND art_type IS NOT NULL
      ORDER BY cred_score DESC
      LIMIT 50
    `);
    const prompt = `You are a collab matchmaker for the urban culture community (breaking, DJing, graffiti, etc).

User looking for collaborators:
- Discipline: ${discipline || "unspecified"}
- Skills: ${skills || "unspecified"}
- Bio: ${bio || "no bio"}
- Looking for: ${lookingFor || "collaborators"}

Available community members (JSON):
${JSON.stringify(others.rows.slice(0, 30))}

Return a JSON array of the top 5 matches with this structure:
[{"userId": number, "name": string, "username": string, "avatarUrl": string|null, "discipline": string, "matchScore": number (0-100), "reason": string (1-2 sentences why they match)}]

Only return valid JSON, no explanation.`;

    const response = await aiChat({ role: "community", maxTokens: 1000, messages: [{ role: "user", content: prompt }] });
    const raw = response.text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const matches = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    res.json({ matches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Style DNA (AI) ───────────────────────────────────────────────────────────
router.post("/style-dna", aiLimiter, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const discipline = sanitizeText(req.body.discipline, 100);
    const bio = sanitizeText(req.body.bio, 500);
    const skills = sanitizeText(req.body.skills, 300);
    const favoriteMoves = sanitizeText(req.body.favoriteMoves, 300);
    const influences = sanitizeText(req.body.influences, 300);
    const yearsActive = sanitizeText(req.body.yearsActive, 20);

    const prompt = `You are a style analyst for urban culture (breaking, DJing, graffiti, freestyle, etc).

Analyze this dancer/artist profile and generate their Style DNA:
- Discipline: ${discipline || "breaking"}
- Bio: ${bio || "no bio provided"}
- Skills/Moves: ${skills || "not specified"}
- Favorite moves/techniques: ${favoriteMoves || "not specified"}
- Influences: ${influences || "not specified"}
- Years active: ${yearsActive || "unknown"}

Generate a Style DNA report as JSON:
{
  "styleTitle": "string (creative 3-5 word title for their style, e.g. 'Power Groove Architect')",
  "dnaStrands": ["string", ...] (4-6 key style traits, e.g. ["Power", "Musicality", "Creativity"]),
  "breakdown": {
    "power": number (0-100),
    "musicality": number (0-100),
    "creativity": number (0-100),
    "technicalPrecision": number (0-100),
    "footwork": number (0-100),
    "freezeGame": number (0-100)
  },
  "description": "string (2-3 sentence poetic description of their style)",
  "comparisons": ["string", ...] (2-3 legendary artists/dancers their style echoes),
  "growthTip": "string (one specific actionable tip to develop their style further)"
}

Only return valid JSON.`;

    const response = await aiChat({ role: "content", maxTokens: 800, messages: [{ role: "user", content: prompt }] });
    const raw = response.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const dna = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    res.json(dna);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Sync to Beat helper ──────────────────────────────────────────────────────
router.post("/sync-to-beat", aiLimiter, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const rawBpm = Number(req.body.bpm);
    const rawDuration = Number(req.body.videoDuration);
    const bpm = isFinite(rawBpm) && rawBpm > 0 && rawBpm <= 300 ? rawBpm : 90;
    const videoDuration = isFinite(rawDuration) && rawDuration > 0 && rawDuration <= 600 ? rawDuration : 30;
    const genre = sanitizeText(req.body.genre, 50);
    const beatInterval = 60 / bpm;
    const beats8 = beatInterval * 8;
    const timestamps: number[] = [];
    for (let t = 0; t < (videoDuration || 30); t += beats8) {
      timestamps.push(Math.round(t * 100) / 100);
    }
    const syncPoints = timestamps.map((t, i) => ({
      time: t, label: `Bar ${i + 1}`, beat: i * 8 + 1
    }));
    res.json({ bpm, beatInterval, syncPoints, tip: `Cut every ${beats8.toFixed(1)}s for 8-count sync` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Freestyle Generator (AI) ────────────────────────────────────────────────
router.post("/freestyle-generator", aiLimiter, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const topic = sanitizeText(req.body.topic, 200);
    const mood = sanitizeText(req.body.mood, 50);
    const style = sanitizeText(req.body.style, 100);
    const bars = Math.min(Math.max(parseInt(req.body.bars) || 8, 4), 16);

    const prompt = `You are a skilled hip-hop lyricist specializing in urban culture freestyle rap. Generate ${bars} bars of rap lyrics.

Topic/Theme: ${topic || "street life and urban culture"}
Mood/Vibe: ${mood || "hype"}
Style: ${style || "battle rap"}
Number of bars: ${bars}

Requirements:
- Strong rhyme scheme (AABB, ABAB, or ABCB)
- Urban culture references (breaking, graffiti, DJing, street art)
- Authentic street vocabulary
- Rhythmic and punchy lines
- Internal rhymes where possible

Return as JSON:
{
  "lyrics": "string (the ${bars} bars, each bar on its own line)",
  "rhymeScheme": "string (e.g. AABB, ABAB)",
  "tip": "string (one performance tip for delivering these bars with flow)"
}

Only return valid JSON.`;

    const response = await aiChat({ role: "content", maxTokens: 600, messages: [{ role: "user", content: prompt }] });
    const raw = response.text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { lyrics: raw, rhymeScheme: "AABB", tip: "Keep it tight and rhythmic." };
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Spot Discovery ────────────────────────────────────────────────────────
router.post("/ai/spot-discovery", aiLimiter, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const lat = parseFloat(req.body.lat);
    const lng = parseFloat(req.body.lng);
    const city = sanitizeText(req.body.city, 100) || "Netherlands";
    const interests = sanitizeText(req.body.interests, 300) || "breaking, street art, hip-hop";
    const category = sanitizeText(req.body.category, 50) || "all";

    const prompt = `You are an urban culture expert in the Netherlands. Recommend 5 real, specific places for someone interested in: ${interests}.

Location context: ${city} (near ${isNaN(lat) ? "Netherlands" : `${lat.toFixed(3)},${lng.toFixed(3)}`})
Category focus: ${category}

Provide genuine, real venues/spots that actually exist in the Netherlands. Include a mix of:
- Dance studios / rehearsal spaces
- Street art walls / legal graffiti spots
- Music venues / clubs with hip-hop nights
- Skate parks
- Community centres with urban culture programmes

Return as JSON array of 5 spots:
[{
  "name": "string (real venue name)",
  "city": "string (Dutch city)",
  "category": "string (dance|skate|graffiti|music|community)",
  "description": "string (2 sentences about why it's relevant for urban culture)",
  "tip": "string (insider tip about visiting or the scene there)",
  "website": "string (URL if known, else null)"
}]

Only return valid JSON.`;

    const response = await aiChat({ role: "spot_description", maxTokens: 1200, messages: [{ role: "user", content: prompt }] });
    const raw = response.text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const spots = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    res.json({ spots, city, interests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Events on Map (schedule panel) ───────────────────────────────────
router.get("/admin/map-schedule", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  const role = (req.user as any).role;
  if (!["admin", "super_admin"].includes(role)) return res.status(403).json({ error: "Forbidden" });
  try {
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const rows = await db.execute(sql`
      SELECT id, title, location, city, latitude, longitude, date, end_date,
             status, category, image_url, organizer_name, capacity, attendee_count,
             is_featured, is_trending, created_at
      FROM events
      WHERE date >= ${now.toISOString().split("T")[0]}
        AND date <= ${twoWeeksLater.toISOString().split("T")[0]}
      ORDER BY date ASC, status ASC
      LIMIT 200
    `);
    res.json({ events: rows.rows, fetchedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: Quick approve/reject event from map ───────────────────────────────
router.patch("/admin/events/:id/quick-status", async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Not authenticated" });
  const role = (req.user as any).role;
  if (!["admin", "super_admin"].includes(role)) return res.status(403).json({ error: "Forbidden" });
  try {
    const eventId = parseInt(req.params.id);
    const status = req.body.status;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const [updated] = await db.update(events).set({ status } as any).where(eq(events.id, eventId)).returning();
    res.json({ event: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
