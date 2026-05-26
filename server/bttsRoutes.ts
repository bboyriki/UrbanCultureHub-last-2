import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { appSettings, bttsRegistrations, bttsJudges, bttsTickets, bttsTicketPurchases, bttsLineup, bttsBattles, users } from "@shared/schema";
import { eq, desc, sql, and, asc, or, inArray, not, notInArray } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { verifyFirebaseToken } from "./firebase";
import QRCode from "qrcode";
import { sendBttsTicketEmail, BttsTicketInfo } from "./bttsEmail";

/** Generate a scannable QR code image (base64 data URL) for a BTTS ticket purchase */
async function generateBttsQRCode(purchaseId: number, extra?: Record<string, any>): Promise<string> {
  const payload = JSON.stringify({ type: "btts_ticket", purchaseId, timestamp: Date.now(), ...extra });
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "H", margin: 1, width: 300,
    color: { dark: "#000000", light: "#FFFFFF" } });
}

const router = Router();

// ── One-time startup: purge stale pending_payment records (> 2 hours old) ─────
// Cleans up abandoned checkouts from testing / dev that would otherwise show
// "Complete Payment" to users who never actually started paying.
(async () => {
  try {
    const result = await db.delete(bttsTicketPurchases).where(
      sql`${bttsTicketPurchases.status} = 'pending_payment' AND ${bttsTicketPurchases.createdAt} < NOW() - INTERVAL '2 hours'`
    ).returning({ id: bttsTicketPurchases.id });
    if (result.length > 0) {
      console.log(`[BTTS] Cleaned up ${result.length} stale pending_payment record(s) on startup`);
    }
  } catch (_) {}
})();

const SETTINGS_KEYS = {
  youtubeUrl:      "bttsYoutubeUrl",
  videoEnabled:    "bttsVideoEnabled",
  videoMuted:      "bttsVideoMuted",      // "true" | "false" — whether video plays with sound
  videoMode:       "bttsVideoMode",       // "background" | "silent" | "sound"
  registrationOpen:"bttsRegistrationOpen",
  bracketPublic:   "bttsBracketPublic",
  judgeCount:      "bttsJudgeCount",
  activeFormat:    "bttsActiveFormat",
  eventDate:       "bttsEventDate",
  eventYear:       "bttsEventYear",
  eventVenue:      "bttsEventVenue",
  eventCity:       "bttsEventCity",
  ticketUrl:       "bttsTicketUrl",
  eventTitle:      "bttsEventTitle",
  ctaBadge:        "bttsCtaBadge",        // e.g. "Free Entry" — shown in the bottom CTA section
  ctaTitle:        "bttsCtaTitle",        // CTA headline
  ctaDesc:         "bttsCtaDesc",         // CTA body text
  eventDescription:"bttsEventDescription",// Main event description shown in hero
};

// Resolves admin status via all 3 auth layers (does NOT send a 403 itself)
const resolveIsAdmin = async (req: Request): Promise<boolean> => {
  // 1. req.user set by authenticateJWT middleware
  const user = (req as any).user;
  if (user?.role === "admin" || user?.role === "super_admin") return true;

  // 2. Session-based role
  const sessionUserId = (req.session as any)?.userId;
  const sessionRole   = (req.session as any)?.userRole;
  if (sessionUserId && (sessionRole === "admin" || sessionRole === "super_admin")) return true;

  // 3. Firebase ID token in Authorization header (always sent by apiRequest)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const decoded = await verifyFirebaseToken(token);
      const firebaseUser = await storage.getUserByFirebaseUid(decoded.uid);
      if (firebaseUser && (firebaseUser.role === "admin" || firebaseUser.role === "super_admin")) {
        (req as any).user = firebaseUser;
        return true;
      }
    } catch { /* invalid token */ }
  }

  return false;
};

const isAdmin = async (req: Request, res: Response): Promise<boolean> => {
  if (await resolveIsAdmin(req)) return true;
  res.status(403).json({ error: "Forbidden" });
  return false;
};

/**
 * Soft-auth middleware — populates req.user for authenticated users without
 * blocking anonymous requests. Applied to every BTTS route.
 */
const resolveCurrentUser = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // 1. Session auth (most reliable — set by /api/auth/login)
    const sessionUserId = (req.session as any)?.userId;
    const sessionRole   = (req.session as any)?.userRole;
    if (sessionUserId) {
      const dbUser = await storage.getUser(sessionUserId).catch(() => null);
      if (dbUser) { (req as any).user = dbUser; return next(); }
      // Fallback with session data only — always coerce id to number
      const numericId = Number(sessionUserId);
      (req as any).user = { id: isNaN(numericId) ? null : numericId, role: sessionRole };
      return next();
    }

    // 2. Firebase Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await verifyFirebaseToken(authHeader.slice(7));
        const firebaseUser = await storage.getUserByFirebaseUid(decoded.uid);
        if (firebaseUser) { (req as any).user = firebaseUser; return next(); }
      } catch { /* invalid or expired token — continue as anonymous */ }
    }
  } catch { /* ignore auth errors — treat as anonymous */ }
  return next();
};

/**
 * Notify all admin users about a new battle spot reservation (non-blocking).
 */
async function notifyAdminsOfBattleSpot(
  holderName: string,
  ticketName: string,
  battleFormat: string | null,
  purchaseId: number,
): Promise<void> {
  try {
    const adminUsers = await db.select({ id: users.id })
      .from(users)
      .where(sql`${users.role} IN ('admin','super_admin')`);

    const format = battleFormat ? ` (${battleFormat})` : "";
    const message = `🥊 ${holderName} reserved a battle spot — ${ticketName}${format}. Purchase #${purchaseId}`;

    for (const adminUser of adminUsers) {
      await storage.createAdminNotification({
        toUserId:   adminUser.id,
        title:      "New Battle Spot Reserved",
        message,
        type:       "info",
        actionLink: "/admin/back-to-the-street",
        actionText: "View Registrations",
      }).catch(() => {});
    }
    console.log(`[BTTS] Admin notifications sent — ${adminUsers.length} admin(s) notified`);
  } catch (e) {
    console.error("[BTTS] Failed to notify admins:", e);
  }
}

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return row?.value ?? null;
}

async function getBttsEventMeta() {
  const keys = [
    SETTINGS_KEYS.eventTitle,
    SETTINGS_KEYS.eventYear,
    SETTINGS_KEYS.eventVenue,
    SETTINGS_KEYS.eventDate,
  ];
  const rows = await db.select().from(appSettings)
    .where(sql`${appSettings.key} = ANY(ARRAY[${sql.join(keys.map((k) => sql`${k}`), sql`, `)}])`);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    eventTitle: map[SETTINGS_KEYS.eventTitle] ?? "Back to the Street",
    eventYear:  map[SETTINGS_KEYS.eventYear]  ?? "",
    eventVenue: map[SETTINGS_KEYS.eventVenue] ?? "",
    eventDate:  map[SETTINGS_KEYS.eventDate]  ?? "",
  };
}

async function upsertSetting(key: string, value: string, label: string, description = "") {
  const [ex] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (ex) await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
  else     await db.insert(appSettings).values({ key, value, label, description });
}

// ── Soft-auth on every BTTS route ────────────────────────────────────────────
// Populates req.user for logged-in visitors without blocking public access.
router.use(resolveCurrentUser);

// ── Program ──────────────────────────────────────────────────────────────────
router.get("/program", async (_req, res) => {
  try { res.json(await storage.getBttsProgram()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post("/program", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { res.status(201).json(await storage.createBttsProgramItem(req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.patch("/program/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { res.json(await storage.updateBttsProgramItem(Number(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete("/program/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { await storage.deleteBttsProgramItem(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Lineup ───────────────────────────────────────────────────────────────────
router.get("/lineup", async (_req, res) => {
  try { res.json(await storage.getBttsLineup()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post("/lineup", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { res.status(201).json(await storage.createBttsLineupMember(req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.patch("/lineup/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { res.json(await storage.updateBttsLineupMember(Number(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete("/lineup/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { await storage.deleteBttsLineupMember(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Battles ──────────────────────────────────────────────────────────────────
router.get("/battles", async (_req, res) => {
  try { res.json(await storage.getBttsBattles()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post("/battles", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { res.status(201).json(await storage.createBttsBattle(req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.patch("/battles/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { res.json(await storage.updateBttsBattle(Number(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete("/battles/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { await storage.deleteBttsBattle(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Gallery ───────────────────────────────────────────────────────────────────
router.get("/gallery", async (_req, res) => {
  try { res.json(await storage.getBttsGallery()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post("/gallery", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const rawGalleryUserId = (req as any).user?.id;
    const userId: number | null = rawGalleryUserId ? (Number(rawGalleryUserId) || null) : null;
    res.status(201).json(await storage.createBttsGalleryItem({ ...req.body, uploadedBy: userId ?? null }));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.patch("/gallery/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { res.json(await storage.updateBttsGalleryItem(Number(req.params.id), req.body)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.delete("/gallery/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try { await storage.deleteBttsGalleryItem(Number(req.params.id)); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Video settings (public GET, admin PATCH) ──────────────────────────────
router.get("/video-settings", async (_req, res) => {
  try {
    const [url, enabled, muted, mode] = await Promise.all([
      getSetting(SETTINGS_KEYS.youtubeUrl),
      getSetting(SETTINGS_KEYS.videoEnabled),
      getSetting(SETTINGS_KEYS.videoMuted),
      getSetting(SETTINGS_KEYS.videoMode),
    ]);
    res.json({
      url: url ?? "",
      enabled: enabled === "true",
      muted: muted !== "false",       // default: muted
      mode: mode ?? "background",     // "background" | "silent" | "sound"
    });
  } catch { res.json({ url: "", enabled: false, muted: true, mode: "background" }); }
});

router.patch("/video-settings", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  const { url, enabled, muted, mode } = req.body;
  try {
    if (typeof url === "string")
      await upsertSetting(SETTINGS_KEYS.youtubeUrl, url, "BTTS Background Video URL", "YouTube video used as ambient background on the BTTS hero section");
    if (typeof enabled === "boolean")
      await upsertSetting(SETTINGS_KEYS.videoEnabled, enabled ? "true" : "false", "BTTS Video Background Enabled", "Whether the ambient video background is shown on the BTTS hero");
    if (typeof muted === "boolean")
      await upsertSetting(SETTINGS_KEYS.videoMuted, muted ? "true" : "false", "BTTS Video Muted", "Whether the ambient video plays silently");
    if (typeof mode === "string" && ["background", "silent", "sound"].includes(mode))
      await upsertSetting(SETTINGS_KEYS.videoMode, mode, "BTTS Video Mode", "How the video behaves: background=visual only, silent=muted play, sound=audio on");
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Event settings (public GET, admin PATCH) ──────────────────────────────
// Returns: registrationOpen, bracketPublic, judgeCount, activeFormat
router.get("/settings", async (_req, res) => {
  try {
    const [regOpen, bracketPub, judgeCount, activeFormat, eventDate, eventYear, eventVenue, eventCity, ticketUrl, eventTitle, ctaBadge, ctaTitle, ctaDesc, eventDescription] = await Promise.all([
      getSetting(SETTINGS_KEYS.registrationOpen),
      getSetting(SETTINGS_KEYS.bracketPublic),
      getSetting(SETTINGS_KEYS.judgeCount),
      getSetting(SETTINGS_KEYS.activeFormat),
      getSetting(SETTINGS_KEYS.eventDate),
      getSetting(SETTINGS_KEYS.eventYear),
      getSetting(SETTINGS_KEYS.eventVenue),
      getSetting(SETTINGS_KEYS.eventCity),
      getSetting(SETTINGS_KEYS.ticketUrl),
      getSetting(SETTINGS_KEYS.eventTitle),
      getSetting(SETTINGS_KEYS.ctaBadge),
      getSetting(SETTINGS_KEYS.ctaTitle),
      getSetting(SETTINGS_KEYS.ctaDesc),
      getSetting(SETTINGS_KEYS.eventDescription),
    ]);
    res.json({
      registrationOpen: regOpen === "true",
      bracketPublic:    bracketPub === "true",
      judgeCount:       Number(judgeCount ?? "5"),
      activeFormat:     activeFormat ?? "1v1",
      eventDate:        eventDate  ?? "",
      eventYear:        eventYear  ?? "2026",
      eventVenue:       eventVenue ?? "",
      eventCity:        eventCity  ?? "Netherlands",
      ticketUrl:        ticketUrl  ?? "",
      eventTitle:       eventTitle ?? "Back to the Street",
      ctaBadge:         ctaBadge   ?? "Free Entry",
      ctaTitle:         ctaTitle   ?? "Join the Movement",
      ctaDesc:          ctaDesc    ?? "Back to the Street is free. No tickets, no barriers — just show up and feel the energy.",
      eventDescription: eventDescription ?? "",
    });
  } catch { res.json({ registrationOpen: false, bracketPublic: true, judgeCount: 5, activeFormat: "1v1", eventDate: "", eventYear: "2026", eventVenue: "", eventCity: "Netherlands", ticketUrl: "", eventTitle: "Back to the Street", ctaBadge: "Free Entry", ctaTitle: "Join the Movement", ctaDesc: "", eventDescription: "" }); }
});

router.patch("/settings", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  const { registrationOpen, bracketPublic, judgeCount, activeFormat, eventDate, eventYear, eventVenue, eventCity, ticketUrl, eventTitle, ctaBadge, ctaTitle, ctaDesc, eventDescription } = req.body;
  try {
    if (typeof registrationOpen === "boolean")
      await upsertSetting(SETTINGS_KEYS.registrationOpen, registrationOpen ? "true" : "false", "BTTS Registration Open", "Whether battle registration is open to the public");
    if (typeof bracketPublic === "boolean")
      await upsertSetting(SETTINGS_KEYS.bracketPublic, bracketPublic ? "true" : "false", "BTTS Bracket Public", "Whether the battle bracket is visible to the public");
    if (typeof judgeCount === "number")
      await upsertSetting(SETTINGS_KEYS.judgeCount, String(judgeCount), "BTTS Judge Count", "Number of judges for battles (3, 5, 7, 9)");
    if (typeof activeFormat === "string")
      await upsertSetting(SETTINGS_KEYS.activeFormat, activeFormat, "BTTS Active Format", "Active battle format: 1v1, 2v2, 3v3, crew, 7-to-smoke");
    if (typeof eventDate === "string")
      await upsertSetting(SETTINGS_KEYS.eventDate, eventDate, "BTTS Event Date", "The date of the Back to the Street event");
    if (typeof eventYear === "string")
      await upsertSetting(SETTINGS_KEYS.eventYear, eventYear, "BTTS Event Year", "The year shown publicly for the Back to the Street event");
    if (typeof eventVenue === "string")
      await upsertSetting(SETTINGS_KEYS.eventVenue, eventVenue, "BTTS Event Venue", "Venue name where the event takes place");
    if (typeof eventCity === "string")
      await upsertSetting(SETTINGS_KEYS.eventCity, eventCity, "BTTS Event City", "City where the event takes place");
    if (typeof ticketUrl === "string")
      await upsertSetting(SETTINGS_KEYS.ticketUrl, ticketUrl, "BTTS Ticket URL", "Link to purchase tickets for the event");
    if (typeof eventTitle === "string")
      await upsertSetting(SETTINGS_KEYS.eventTitle, eventTitle, "BTTS Event Title", "Display title for the event");
    if (typeof ctaBadge === "string")
      await upsertSetting(SETTINGS_KEYS.ctaBadge, ctaBadge, "BTTS CTA Badge", "Badge text in the CTA section e.g. 'Free Entry' or '€5 Entry'");
    if (typeof ctaTitle === "string")
      await upsertSetting(SETTINGS_KEYS.ctaTitle, ctaTitle, "BTTS CTA Title", "CTA section headline text");
    if (typeof ctaDesc === "string")
      await upsertSetting(SETTINGS_KEYS.ctaDesc, ctaDesc, "BTTS CTA Description", "CTA section body description text");
    if (typeof eventDescription === "string")
      await upsertSetting(SETTINGS_KEYS.eventDescription, eventDescription, "BTTS Event Description", "Main event description shown on the page");
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Registrations (GET all admin / POST public / PATCH admin / DELETE admin) ─
router.get("/registrations", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const rows = await db.select().from(bttsRegistrations).orderBy(desc(bttsRegistrations.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Public: authenticated user registers
router.post("/registrations", async (req: Request, res: Response) => {
  // Check admin first — resolveIsAdmin may set (req as any).user via Firebase token
  const isAdminUser = await resolveIsAdmin(req);

  // Re-read user AFTER resolveIsAdmin so Firebase-resolved user is captured
  const user = (req as any).user;
  const sessionUserId = (req.session as any)?.userId;
  const rawRegUserId = user?.id ?? sessionUserId;
  const userId: number | null = rawRegUserId ? Number(rawRegUserId) || null : null;
  if (!isAdminUser) {
    const open = await getSetting(SETTINGS_KEYS.registrationOpen);
    if (open !== "true") return res.status(403).json({ error: "Registration is currently closed" });

    // If there are active tickets, require a confirmed purchase before allowing registration
    const [activeTicket] = await db
      .select()
      .from(bttsTickets)
      .where(eq(bttsTickets.isActive, true))
      .limit(1);

    if (activeTicket) {
      if (!userId) {
        return res.status(403).json({ error: "Please log in and purchase a ticket to register for the battle." });
      }
      const [purchase] = await db
        .select()
        .from(bttsTicketPurchases)
        .where(and(eq(bttsTicketPurchases.userId, userId), eq(bttsTicketPurchases.status, "confirmed")))
        .limit(1);
      if (!purchase) {
        return res.status(403).json({ error: "A valid ticket is required to register. Please purchase a ticket first." });
      }
    }
  }

  try {
    const { crewName, battleType, category, notes, guestName } = req.body;
    const [row] = await db.insert(bttsRegistrations).values({
      userId: userId ?? null,
      guestName: guestName ?? null,
      crewName:  crewName  ?? null,
      battleType: battleType ?? "1v1",
      category:   category   ?? "Breaking",
      status: "pending",
      paid: false,
      notes: notes ?? null,
      addedBy: isAdminUser ? "admin" : "self",
    }).returning();
    res.status(201).json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/registrations/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const { status, paid, notes, crewName, battleType, category, guestName } = req.body;
    const [row] = await db.update(bttsRegistrations)
      .set({ ...(status     !== undefined && { status }),
             ...(paid       !== undefined && { paid }),
             ...(notes      !== undefined && { notes }),
             ...(crewName   !== undefined && { crewName }),
             ...(battleType !== undefined && { battleType }),
             ...(category   !== undefined && { category }),
             ...(guestName  !== undefined && { guestName }),
           })
      .where(eq(bttsRegistrations.id, Number(req.params.id)))
      .returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/registrations/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    await db.delete(bttsRegistrations).where(eq(bttsRegistrations.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Bracket auto-generation ─────────────────────────────────────────────────

/** Smallest power of 2 >= n (minimum 2) */
function nextPow2(n: number): number {
  if (n <= 2) return 2;
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

/**
 * Human-readable round name.
 * roundIdx 1 = earliest round, totalRounds = Final.
 */
function getRoundName(roundIdx: number, totalRounds: number): string {
  const fromEnd = totalRounds - roundIdx; // 0 = Final
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-Final";
  if (fromEnd === 2) return "Quarter-Final";
  // Earlier: "Top N"
  const battlesInRound = Math.pow(2, fromEnd - 1);
  return `Top ${battlesInRound * 2}`;
}

/**
 * POST /api/btts/bracket/generate
 * Body: { battleType, category, forceRegen? }
 * Generates / updates a bracket from confirmed registrations.
 * forceRegen=true clears completed battles too (full rebuild).
 */
router.post("/bracket/generate", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const { battleType = "1v1", category = "Breaking", forceRegen = false } = req.body;

    // All confirmed registrations for this format, oldest first (seeding order)
    const confirmed = await db
      .select()
      .from(bttsRegistrations)
      .where(and(
        eq(bttsRegistrations.status, "confirmed"),
        eq(bttsRegistrations.battleType, battleType),
      ))
      .orderBy(bttsRegistrations.createdAt);

    // ── 7-to-Smoke: linear champion-vs-challengers chain ─────────────────
    if (battleType === "7smoke") {
      if (confirmed.length < 2)
        return res.json({ generated: 0, message: "Need at least 2 confirmed for 7-to-Smoke." });

      if (forceRegen) await db.delete(bttsBattles).where(eq(bttsBattles.battleType, "7smoke"));
      else await db.delete(bttsBattles).where(and(eq(bttsBattles.battleType, "7smoke"), eq(bttsBattles.status, "upcoming")));

      const champion    = confirmed[0];
      const challengers = confirmed.slice(1);
      const rows = challengers.map((c, i) => ({
        battleType: "7smoke",
        category,
        round: "7-to-smoke",
        position: i + 1,
        participant1: champion.guestName ?? "Champion",
        participant2: c.guestName ?? `Challenger ${i + 1}`,
        status: "upcoming",
        addedByAi: false,
      }));
      if (rows.length) await db.insert(bttsBattles).values(rows);
      return res.json({ generated: rows.length, size: rows.length, type: "7smoke" });
    }

    // ── Standard single-elimination bracket ──────────────────────────────
    if (confirmed.length < 2)
      return res.json({ generated: 0, message: "Need at least 2 confirmed participants." });

    const bracketSize = nextPow2(confirmed.length);
    const totalRounds = Math.log2(bracketSize);

    // Clear existing battles for this format (keep completed if not forceRegen)
    if (forceRegen) {
      await db.delete(bttsBattles).where(eq(bttsBattles.battleType, battleType));
    } else {
      await db.delete(bttsBattles).where(
        and(eq(bttsBattles.battleType, battleType), eq(bttsBattles.status, "upcoming")),
      );
    }

    const rows: any[] = [];

    // Round 1 — fill with confirmed participants; BYE if count < bracketSize
    for (let i = 0; i < bracketSize / 2; i++) {
      const p1 = confirmed[i * 2];
      const p2 = confirmed[i * 2 + 1];
      const isBye = p1 && !p2;
      rows.push({
        battleType,
        category,
        round: getRoundName(1, totalRounds),
        position: i + 1,
        participant1: p1?.guestName ?? null,
        participant2: p2?.guestName ?? null,
        winner: isBye ? p1.guestName : null,
        status: isBye ? "completed" : "upcoming",
        addedByAi: false,
      });
    }

    // Upper rounds — empty slots, winners advance into these
    for (let r = 2; r <= totalRounds; r++) {
      const count = bracketSize / Math.pow(2, r);
      for (let i = 0; i < count; i++) {
        rows.push({
          battleType,
          category,
          round: getRoundName(r, totalRounds),
          position: i + 1,
          participant1: null,
          participant2: null,
          status: "upcoming",
          addedByAi: false,
        });
      }
    }

    if (rows.length) await db.insert(bttsBattles).values(rows);

    return res.json({
      generated: rows.length,
      size: bracketSize,
      participants: confirmed.length,
      rounds: totalRounds,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/**
 * GET /api/btts/bracket/confirmed-counts
 * Returns confirmed participant counts per battle type (for bracket planning UI).
 */
router.get("/bracket/confirmed-counts", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const rows = await db
      .select({
        battleType: bttsRegistrations.battleType,
        count: sql<number>`count(*)::int`,
      })
      .from(bttsRegistrations)
      .where(eq(bttsRegistrations.status, "confirmed"))
      .groupBy(bttsRegistrations.battleType);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Judges (GET public / POST admin / DELETE admin) ───────────────────────
router.get("/judges", async (_req, res) => {
  try {
    const rows = await db.select().from(bttsJudges).orderBy(bttsJudges.judgeNumber);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/judges", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const { userId, guestName, specialty, judgeNumber, category, avatarUrl } = req.body;
    const [row] = await db.insert(bttsJudges).values({
      userId:      userId      ?? null,
      guestName:   guestName   ?? null,
      specialty:   specialty   ?? null,
      judgeNumber: judgeNumber ?? 1,
      category:    category    ?? "Breaking",
      avatarUrl:   avatarUrl   ?? null,
    }).returning();
    res.status(201).json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/judges/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const { guestName, specialty, judgeNumber, category, avatarUrl } = req.body;
    const [row] = await db.update(bttsJudges)
      .set({ ...(guestName   !== undefined && { guestName }),
             ...(specialty   !== undefined && { specialty }),
             ...(judgeNumber !== undefined && { judgeNumber }),
             ...(category    !== undefined && { category }),
             ...(avatarUrl   !== undefined && { avatarUrl }),
           })
      .where(eq(bttsJudges.id, Number(req.params.id)))
      .returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/judges/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    await db.delete(bttsJudges).where(eq(bttsJudges.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Tickets — GET (public with counts) / POST / PATCH / DELETE (admin) ───────
router.get("/tickets", async (_req, res) => {
  try {
    const tickets = await db.select().from(bttsTickets).orderBy(bttsTickets.sortOrder, bttsTickets.id);
    // claimedCount = only CONFIRMED purchases (pending_payment = not paid, cancelled = void)
    const withCounts = await Promise.all(tickets.map(async (t) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bttsTicketPurchases)
        .where(sql`${bttsTicketPurchases.ticketId} = ${t.id} AND ${bttsTicketPurchases.status} = 'confirmed'`);
      return { ...t, claimedCount: count };
    }));
    res.json(withCounts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/tickets", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const { name, description, price, currency, type, battleFormat, totalSpots, isActive, sortOrder, phase, phaseGroup, ageGroup } = req.body;
    const [row] = await db.insert(bttsTickets).values({
      name,
      description:   description   ?? null,
      price:         price         ?? 0,
      currency:      currency      ?? "EUR",
      type:          type          ?? "general",
      battleFormat:  battleFormat  ?? null,
      totalSpots:    totalSpots    ?? 0,
      isActive:      isActive      ?? true,
      sortOrder:     sortOrder     ?? 0,
      phase:         phase         ?? null,
      phaseGroup:    phaseGroup    ?? null,
      ageGroup:      ageGroup      ?? null,
    } as any).returning();
    res.status(201).json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/tickets/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const { name, description, price, currency, type, battleFormat, totalSpots, isActive, sortOrder, phase, phaseGroup, ageGroup } = req.body;
    const [row] = await db.update(bttsTickets)
      .set({
        ...(name         !== undefined && { name }),
        ...(description  !== undefined && { description }),
        ...(price        !== undefined && { price }),
        ...(currency     !== undefined && { currency }),
        ...(type         !== undefined && { type }),
        ...(battleFormat !== undefined && { battleFormat }),
        ...(totalSpots   !== undefined && { totalSpots }),
        ...(isActive     !== undefined && { isActive }),
        ...(sortOrder    !== undefined && { sortOrder }),
        ...(phase        !== undefined && { phase }),
        ...(phaseGroup   !== undefined && { phaseGroup }),
        ...(ageGroup     !== undefined && { ageGroup }),
      } as any)
      .where(eq(bttsTickets.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Ticket not found" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/tickets/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    await db.delete(bttsTicketPurchases).where(eq(bttsTicketPurchases.ticketId, Number(req.params.id)));
    await db.delete(bttsTickets).where(eq(bttsTickets.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Reset ALL ticket types + all purchases (admin bulk wipe) ──────────────────
router.delete("/tickets", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    await db.delete(bttsTicketPurchases);
    await db.delete(bttsTickets);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Ticket Purchases — claim (public) / list (admin) / patch / delete ────────
router.post("/tickets/:id/claim", async (req: Request, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const [ticket] = await db.select().from(bttsTickets).where(eq(bttsTickets.id, ticketId));
    if (!ticket || !ticket.isActive) return res.status(404).json({ error: "Ticket not found or inactive" });

    // Check capacity — only count confirmed purchases (same as claimedCount displayed to users)
    if (ticket.totalSpots > 0) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bttsTicketPurchases)
        .where(sql`${bttsTicketPurchases.ticketId} = ${ticketId} AND ${bttsTicketPurchases.status} = 'confirmed'`);
      if (count >= ticket.totalSpots) {
        return res.status(409).json({ error: "No spots remaining — this ticket is sold out." });
      }
    }

    const { guestName, guestEmail, notes } = req.body;
    if (!guestName?.trim()) return res.status(400).json({ error: "Name is required" });
    const rawUserId = (req as any).user?.id;
    const userId: number | null = rawUserId ? Number(rawUserId) || null : null;
    const claimerIsAdmin = await resolveIsAdmin(req);

    // Battle spot restriction: each person can only hold ONE spot ticket (by userId OR email)
    // Admins are exempt so they can purchase spot tickets multiple times for testing.
    if (ticket.type === "spot" && !claimerIsAdmin) {
      const allSpotTicketIds = await db.select({ id: bttsTickets.id }).from(bttsTickets).where(eq(bttsTickets.type, "spot"));
      const spotIds = allSpotTicketIds.map(t => t.id);
      if (spotIds.length > 0) {
        const activeStatusFilter = notInArray(bttsTicketPurchases.status, ["cancelled", "pending_payment"]);

        // Check by userId (logged-in user)
        if (userId) {
          const [{ existing }] = await db
            .select({ existing: sql<number>`count(*)::int` })
            .from(bttsTicketPurchases)
            .where(and(
              eq(bttsTicketPurchases.userId, userId),
              inArray(bttsTicketPurchases.ticketId, spotIds),
              activeStatusFilter,
            ));
          if (existing > 0) {
            return res.status(409).json({ error: "You already have a battle spot for this event. Each dancer can only hold one battle spot." });
          }
        }

        // Check by email (catches guest purchases for the same email)
        const checkEmail = guestEmail?.trim() || (req as any).user?.email;
        if (checkEmail) {
          const [{ existingEmail }] = await db
            .select({ existingEmail: sql<number>`count(*)::int` })
            .from(bttsTicketPurchases)
            .where(and(
              sql`lower(${bttsTicketPurchases.guestEmail}) = lower(${checkEmail})`,
              inArray(bttsTicketPurchases.ticketId, spotIds),
              activeStatusFilter,
            ));
          if (existingEmail > 0) {
            return res.status(409).json({ error: "A battle spot is already reserved for this email address. Each dancer can only hold one battle spot." });
          }
        }
      }
    }

    // Cancel any existing pending_payment purchases from this user for this same ticket type
    // (so retrying payment doesn't accumulate stale pending records)
    if (userId) {
      const sameTypeTicketIds = ticket.type === "spot"
        ? (await db.select({ id: bttsTickets.id }).from(bttsTickets).where(eq(bttsTickets.type, "spot"))).map(t => t.id)
        : [ticketId];
      if (sameTypeTicketIds.length > 0) {
        await db.update(bttsTicketPurchases)
          .set({ status: "cancelled" })
          .where(and(
            eq(bttsTicketPurchases.userId, userId),
            eq(bttsTicketPurchases.status, "pending_payment"),
            inArray(bttsTicketPurchases.ticketId, sameTypeTicketIds),
          ));
      }
    }

    // Auto-cleanup stale pending_payment purchases older than 2 hours for this ticket
    await db.delete(bttsTicketPurchases).where(
      sql`${bttsTicketPurchases.ticketId} = ${ticketId} AND ${bttsTicketPurchases.status} = 'pending_payment' AND ${bttsTicketPurchases.createdAt} < NOW() - INTERVAL '2 hours'`
    );

    // Assign next spot number
    const [{ maxSpot }] = await db
      .select({ maxSpot: sql<number>`coalesce(max(${bttsTicketPurchases.spotNumber}),0)::int` })
      .from(bttsTicketPurchases)
      .where(eq(bttsTicketPurchases.ticketId, ticketId));

    const isFree = !ticket.price || ticket.price === 0;

    if (isFree) {
      // Free ticket → confirm immediately and auto-create battle registration
      let registrationId: number | null = null;
      if (ticket.type === "spot") {
        try {
          const [reg] = await db.insert(bttsRegistrations).values({
            userId,
            guestName: guestName ?? null,
            crewName: null,
            battleType: ticket.battleFormat ?? "1v1",
            category: "Breaking",
            status: "confirmed",     // confirmed immediately for free spots
            paid: false,
            notes: `Auto-registered via free spot ticket #${ticketId}`,
            addedBy: userId ? "self" : "guest",
          }).returning();
          registrationId = reg.id;
        } catch (_) {}
      }
      const [purchase] = await db.insert(bttsTicketPurchases).values({
        ticketId,
        userId,
        guestName:      guestName ?? null,
        guestEmail:     guestEmail ?? null,
        spotNumber:     maxSpot + 1,
        status:         "confirmed",
        registrationId: registrationId ?? null,
        notes:          notes ?? null,
      }).returning();
      // Generate QR code for in-app scanning
      let claimQrCode: string | undefined;
      try {
        claimQrCode = await generateBttsQRCode(purchase.id, {
          ticketType: ticket.type,
          ticketName: ticket.name,
          holderName: guestName ?? null,
        });
        await db.update(bttsTicketPurchases).set({ qrCode: claimQrCode }).where(eq(bttsTicketPurchases.id, purchase.id));
        purchase.qrCode = claimQrCode;
      } catch (_) {}

      // Resolve the best email address: explicit guestEmail → logged-in user's email
      const emailAddr = guestEmail?.trim() || (req as any).user?.email || null;

      // Send confirmation email (best-effort, non-blocking)
      if (emailAddr && claimQrCode) {
        getBttsEventMeta().then((meta) => {
          const emailInfo: BttsTicketInfo = {
            purchaseId:   purchase.id,
            holderName:   guestName ?? "Guest",
            holderEmail:  emailAddr,
            ticketName:   ticket.name,
            ticketType:   ticket.type,
            spotNumber:   purchase.spotNumber ?? null,
            battleFormat: ticket.battleFormat ?? null,
            amountPaid:   0,
            qrCode:       claimQrCode!,
            ...meta,
          };
          sendBttsTicketEmail(emailInfo).catch((e) =>
            console.error("[BTTS email] free claim send error:", e)
          );
        }).catch(() => {});
      }

      // Notify admins about new battle spot (non-blocking, spot tickets only)
      if (ticket.type === "spot") {
        notifyAdminsOfBattleSpot(guestName ?? "Guest", ticket.name, ticket.battleFormat ?? null, purchase.id).catch(() => {});
      }

      return res.status(201).json({ purchase: { ...purchase, ticket }, requiresPayment: false });
    }

    // Paid ticket
    const { getUncachableStripeClient } = await import('./stripeClient');
    const stripe = await getUncachableStripeClient();
    const priceInCents = Math.round(ticket.price * 100);

    const ticketLabel = ticket.type === "spot" ? "Battle Spot" : ticket.type === "guest" ? "Guest Pass" : "Entry Ticket";
    const embedded = req.body.embedded === true;

    if (embedded) {
      // ── In-app PaymentIntent (no iframe, no redirect for card payments) ─────
      const paymentIntent = await stripe.paymentIntents.create({
        amount: priceInCents,
        currency: "eur",
        payment_method_types: ["card", "ideal"],
        description: `${ticket.name} — ${ticketLabel}`,
        metadata: {
          type: "btts_ticket_claim",
          ticketId: String(ticketId),
          userId: userId ? String(userId) : "",
          guestName: guestName ?? "",
          guestEmail: guestEmail ?? "",
          notes: notes ?? "",
          spotNumber: String(maxSpot + 1),
        },
        ...(guestEmail ? { receipt_email: guestEmail } : {}),
      });

      const [purchase] = await db.insert(bttsTicketPurchases).values({
        ticketId,
        userId,
        guestName:       guestName ?? null,
        guestEmail:      guestEmail ?? null,
        spotNumber:      maxSpot + 1,
        status:          "pending_payment",
        stripeSessionId: paymentIntent.id,   // store PI id in same field
        notes:           notes ?? null,
      }).returning();

      return res.status(201).json({
        purchase: { ...purchase, ticket },
        requiresPayment: true,
        clientSecret:    paymentIntent.client_secret,
        purchaseId:      purchase.id,
        isPaymentIntent: true,
      });
    }

    // ── External Checkout Session (fallback for non-embedded flow) ─────────────
    const proto  = ((req.headers['x-forwarded-proto'] as string) || 'https').split(',')[0].trim();
    const host   = (req.headers['x-forwarded-host'] as string) || (req.headers['host'] as string) || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
    const origin = `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "ideal"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `${ticket.name} — ${ticketLabel}`,
            description: [
              ticket.battleFormat ? `Format: ${ticket.battleFormat}` : null,
              ticket.description || null,
            ].filter(Boolean).join(" · ") || undefined,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      metadata: {
        type: "btts_ticket_claim",
        ticketId: String(ticketId),
        userId: userId ? String(userId) : "",
        guestName: guestName ?? "",
        guestEmail: guestEmail ?? "",
        notes: notes ?? "",
        spotNumber: String(maxSpot + 1),
      },
      customer_email: guestEmail || undefined,
      success_url: `${origin}/back-to-the-street?btts_payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/back-to-the-street?btts_payment=cancelled`,
    });

    const [purchase] = await db.insert(bttsTicketPurchases).values({
      ticketId,
      userId,
      guestName:       guestName ?? null,
      guestEmail:      guestEmail ?? null,
      spotNumber:      maxSpot + 1,
      status:          "pending_payment",
      stripeSessionId: session.id,
      notes:           notes ?? null,
    }).returning();

    return res.status(201).json({ purchase: { ...purchase, ticket }, requiresPayment: true, checkoutUrl: session.url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Confirm BTTS ticket purchase after Stripe checkout ────────────────────────
router.get("/ticket-claim/activate", async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.session_id as string;
    if (!sessionId) return res.status(400).json({ error: "Missing session_id" });

    const { getUncachableStripeClient } = await import('./stripeClient');
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return res.status(400).json({ error: "Payment not completed" });

    // Find the pending purchase by stripeSessionId
    const [purchase] = await db.select().from(bttsTicketPurchases)
      .where(eq(bttsTicketPurchases.stripeSessionId, sessionId))
      .limit(1);
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    // Link userId from currently logged-in user if purchase was made as guest
    const rawCurrentUserId = (req as any).user?.id;
    const currentUserId: number | null = rawCurrentUserId ? Number(rawCurrentUserId) || null : null;
    if (currentUserId && !purchase.userId) {
      await db.update(bttsTicketPurchases).set({ userId: currentUserId }).where(eq(bttsTicketPurchases.id, purchase.id));
      (purchase as any).userId = currentUserId;
    }

    if (purchase.status === "confirmed") {
      const [ticket] = await db.select().from(bttsTickets).where(eq(bttsTickets.id, purchase.ticketId!));
      return res.json({ success: true, purchase: { ...purchase, ticket }, alreadyConfirmed: true });
    }

    // Generate QR code for this purchase
    let qrCode: string | undefined;
    try {
      const [ticketRow] = await db.select().from(bttsTickets).where(eq(bttsTickets.id, purchase.ticketId!));
      qrCode = await generateBttsQRCode(purchase.id, {
        ticketType: ticketRow?.type,
        ticketName: ticketRow?.name,
        holderName: purchase.guestName ?? null,
      });
    } catch (_) {}

    // Confirm the purchase
    const [updated] = await db.update(bttsTicketPurchases)
      .set({ status: "confirmed", amountPaid: String(session.amount_total ? session.amount_total / 100 : 0), ...(qrCode ? { qrCode } : {}) })
      .where(eq(bttsTicketPurchases.id, purchase.id))
      .returning();

    // Auto-create battle registration for spot tickets (now that payment is confirmed)
    const [ticket] = await db.select().from(bttsTickets).where(eq(bttsTickets.id, purchase.ticketId!));
    let registrationId = purchase.registrationId;
    if (ticket?.type === "spot" && !registrationId) {
      try {
        const [reg] = await db.insert(bttsRegistrations).values({
          userId: purchase.userId ?? null,
          guestName: purchase.guestName ?? null,
          crewName: null,
          battleType: ticket.battleFormat ?? "1v1",
          category: "Breaking",
          status: "confirmed",    // confirmed — payment verified
          paid: true,
          notes: `Auto-registered after Stripe payment — ticket #${purchase.ticketId}`,
          addedBy: purchase.userId ? "self" : "guest",
        }).returning();
        registrationId = reg.id;
        await db.update(bttsTicketPurchases).set({ registrationId: reg.id }).where(eq(bttsTicketPurchases.id, purchase.id));
      } catch (_) {}
    }

    // Resolve the best email address: explicit guestEmail → logged-in user's email
    const activateEmailAddr =
      updated.guestEmail?.trim() ||
      purchase.guestEmail?.trim() ||
      ((req as any).user?.email as string | undefined) ||
      null;

    // Send confirmation email (best-effort, non-blocking)
    if (qrCode && activateEmailAddr) {
      const amountPaid = session.amount_total ? session.amount_total / 100 : 0;
      getBttsEventMeta().then((meta) => {
        const emailInfo: BttsTicketInfo = {
          purchaseId:   purchase.id,
          holderName:   purchase.guestName ?? "Guest",
          holderEmail:  activateEmailAddr,
          ticketName:   ticket?.name ?? "BTTS Ticket",
          ticketType:   ticket?.type ?? "general",
          spotNumber:   purchase.spotNumber ?? null,
          battleFormat: ticket?.battleFormat ?? null,
          amountPaid,
          qrCode:       qrCode!,
          ...meta,
        };
        sendBttsTicketEmail(emailInfo).catch((e) =>
          console.error("[BTTS email] paid activate send error:", e)
        );
      }).catch(() => {});
    }

    // Notify admins about new paid battle spot (non-blocking, spot tickets only)
    if (ticket?.type === "spot") {
      notifyAdminsOfBattleSpot(
        purchase.guestName ?? "Guest",
        ticket.name,
        ticket.battleFormat ?? null,
        purchase.id,
      ).catch(() => {});
    }

    res.json({ success: true, purchase: { ...updated, ticket } });
  } catch (e: any) {
    console.error("BTTS ticket activate error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── Confirm in-app PaymentIntent after stripe.confirmPayment() succeeds ────────
router.post("/ticket-purchases/:id/confirm-payment", async (req: Request, res: Response) => {
  try {
    const purchaseId = Number(req.params.id);
    const { paymentIntentId } = req.body;
    if (!purchaseId || !paymentIntentId) return res.status(400).json({ error: "Missing purchaseId or paymentIntentId" });

    const { getUncachableStripeClient } = await import('./stripeClient');
    const stripe = await getUncachableStripeClient();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") return res.status(400).json({ error: "Payment not completed yet" });

    const [purchase] = await db.select().from(bttsTicketPurchases).where(eq(bttsTicketPurchases.id, purchaseId)).limit(1);
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });
    if (purchase.stripeSessionId !== paymentIntentId) return res.status(400).json({ error: "Payment mismatch" });

    if (purchase.status === "confirmed") {
      const [ticket] = await db.select().from(bttsTickets).where(eq(bttsTickets.id, purchase.ticketId!));
      return res.json({ success: true, purchase: { ...purchase, ticket }, alreadyConfirmed: true });
    }

    const [ticketRow] = await db.select().from(bttsTickets).where(eq(bttsTickets.id, purchase.ticketId!));
    let qrCode: string | undefined;
    try {
      qrCode = await generateBttsQRCode(purchase.id, {
        ticketType: ticketRow?.type,
        ticketName: ticketRow?.name,
        holderName: purchase.guestName ?? null,
      });
    } catch (_) {}

    const amountPaid = pi.amount_received ? pi.amount_received / 100 : 0;
    const [updated] = await db.update(bttsTicketPurchases)
      .set({ status: "confirmed", amountPaid: String(amountPaid), ...(qrCode ? { qrCode } : {}) })
      .where(eq(bttsTicketPurchases.id, purchase.id))
      .returning();

    // Auto-register for spot tickets
    if (ticketRow?.type === "spot" && !purchase.registrationId) {
      try {
        const [reg] = await db.insert(bttsRegistrations).values({
          userId: purchase.userId ?? null,
          guestName: purchase.guestName ?? null,
          crewName: null,
          battleType: ticketRow.battleFormat ?? "1v1",
          category: "Breaking",
          status: "confirmed",
          paid: true,
          notes: `Auto-registered after in-app payment — ticket #${purchase.ticketId}`,
          addedBy: purchase.userId ? "self" : "guest",
        }).returning();
        await db.update(bttsTicketPurchases).set({ registrationId: reg.id }).where(eq(bttsTicketPurchases.id, purchase.id));
      } catch (_) {}
    }

    // Send confirmation email
    const emailAddr = updated.guestEmail?.trim() || ((req as any).user?.email as string | undefined) || null;
    if (qrCode && emailAddr) {
      getBttsEventMeta().then((meta) => {
        const emailInfo: BttsTicketInfo = {
          purchaseId:   purchase.id,
          holderName:   purchase.guestName ?? "Guest",
          holderEmail:  emailAddr,
          ticketName:   ticketRow?.name ?? "BTTS Ticket",
          ticketType:   ticketRow?.type ?? "general",
          spotNumber:   purchase.spotNumber ?? null,
          battleFormat: ticketRow?.battleFormat ?? null,
          amountPaid,
          qrCode:       qrCode!,
          ...meta,
        };
        sendBttsTicketEmail(emailInfo).catch((e) => console.error("[BTTS email] in-app confirm error:", e));
      }).catch(() => {});
    }

    if (ticketRow?.type === "spot") {
      notifyAdminsOfBattleSpot(
        purchase.guestName ?? "Guest",
        ticketRow.name,
        ticketRow.battleFormat ?? null,
        purchase.id,
      ).catch(() => {});
    }

    res.json({ success: true, purchase: { ...updated, ticket: ticketRow } });
  } catch (e: any) {
    console.error("BTTS confirm-payment error:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/ticket-purchases", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const purchases = await db.select().from(bttsTicketPurchases).orderBy(desc(bttsTicketPurchases.createdAt));
    const tickets   = await db.select().from(bttsTickets);
    const ticketMap = Object.fromEntries(tickets.map(t => [t.id, t]));
    res.json(purchases.map(p => ({ ...p, ticket: ticketMap[p.ticketId!] ?? null })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/my-spots", async (req: Request, res: Response) => {
  try {
    const rawSpotsUserId = (req as any).user?.id;
    const userId: number | undefined = rawSpotsUserId ? (Number(rawSpotsUserId) || undefined) : undefined;
    const userEmail = (req as any).user?.email as string | undefined;

    // Require authentication — never return data without a verified user identity
    if (!userId) return res.json([]);

    // Auto-cancel stale pending_payment records for this user (older than 1 hour)
    // Prevents "Complete Payment" showing forever after an abandoned checkout
    await db.update(bttsTicketPurchases)
      .set({ status: "cancelled" })
      .where(and(
        eq(bttsTicketPurchases.userId, userId),
        eq(bttsTicketPurchases.status, "pending_payment"),
        sql`${bttsTicketPurchases.createdAt} < NOW() - INTERVAL '1 hour'`,
      ));

    // Fetch only this user's purchases (by userId only — email matching is too broad and
    // can leak other users' data if they share or type the same email address)
    const purchases = await db.select().from(bttsTicketPurchases)
      .where(and(
        eq(bttsTicketPurchases.userId, userId),
        notInArray(bttsTicketPurchases.status, ["cancelled"]),
      ))
      .orderBy(desc(bttsTicketPurchases.createdAt));

    const ticketRows = await db.select().from(bttsTickets);
    const ticketMap  = Object.fromEntries(ticketRows.map(t => [t.id, t]));

    // Strip QR codes from non-confirmed purchases (they shouldn't have them anyway,
    // but strip as a safety measure to prevent leaking draft/pending QR data)
    const sanitized = purchases.map(p => ({
      ...p,
      qrCode: p.status === "confirmed" ? p.qrCode : null,
      ticket: ticketMap[p.ticketId!] ?? null,
    }));

    res.json(sanitized);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/ticket-purchases/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const { status, notes } = req.body;
    const [row] = await db.update(bttsTicketPurchases)
      .set({ ...(status !== undefined && { status }), ...(notes !== undefined && { notes }) })
      .where(eq(bttsTicketPurchases.id, Number(req.params.id)))
      .returning();
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/ticket-purchases/:id", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    await db.delete(bttsTicketPurchases).where(eq(bttsTicketPurchases.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Reset a BTTS ticket check-in (admin only) — clears checkedIn, checkedInAt, and scanCount
router.post("/ticket-purchases/:id/reset-checkin", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const id = Number(req.params.id);
    const [row] = await db.update(bttsTicketPurchases)
      .set({ checkedIn: false, checkedInAt: null, scanCount: 0 })
      .where(eq(bttsTicketPurchases.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Purchase not found" });
    res.json({ success: true, purchase: row });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Look up a BTTS purchase by ID for manual admin check-in
router.get("/ticket-purchases/:id/lookup", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const id = Number(req.params.id);
    const [purchase] = await db.select().from(bttsTicketPurchases)
      .where(eq(bttsTicketPurchases.id, id)).limit(1);
    if (!purchase) return res.status(404).json({ error: "Not found" });
    const [ticket] = await db.select().from(bttsTickets).where(eq(bttsTickets.id, purchase.ticketId!)).limit(1);
    res.json({ purchase, ticket: ticket ?? null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── AI Event Assistant ────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getBttsContext() {
  const [settings, tickets, purchases, registrations, judges, lineup, battles, program] = await Promise.all([
    (async () => {
      const keys = Object.values(SETTINGS_KEYS);
      const rows = await db.select().from(appSettings).where(sql`${appSettings.key} = ANY(ARRAY[${sql.join(keys.map(k => sql`${k}`), sql`, `)}])`);
      return Object.fromEntries(rows.map(r => [r.key, r.value]));
    })(),
    db.select().from(bttsTickets).orderBy(desc(bttsTickets.createdAt)),
    db.select().from(bttsTicketPurchases).orderBy(desc(bttsTicketPurchases.createdAt)),
    db.select().from(bttsRegistrations).orderBy(desc(bttsRegistrations.createdAt)),
    db.select().from(bttsJudges).orderBy(bttsJudges.judgeNumber),
    storage.getBttsLineup(),
    storage.getBttsBattles(),
    storage.getBttsProgram(),
  ]);
  return { settings, tickets, purchases, registrations, judges, lineup, battles, program };
}

function buildHealthScore(ctx: Awaited<ReturnType<typeof getBttsContext>>) {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const s = ctx.settings;
  if (!s[SETTINGS_KEYS.eventTitle]) { issues.push("No event title set"); score -= 10; }
  if (!s[SETTINGS_KEYS.eventDate])  { issues.push("No event date set"); score -= 10; }
  if (!s[SETTINGS_KEYS.eventVenue]) { issues.push("No venue set"); score -= 5; }
  if (ctx.tickets.length === 0)     { issues.push("No ticket types created"); score -= 15; suggestions.push("Create at least one ticket or battle spot type"); }
  if (ctx.registrations.length === 0) { suggestions.push("No battle registrations yet — make sure registration is open"); }
  if (ctx.judges.length === 0)      { issues.push("No judges added"); score -= 10; suggestions.push("Add judges for the event — at least 3 is recommended"); }
  if (ctx.lineup.length === 0)      { suggestions.push("Lineup is empty — add DJs, MCs, or hosts"); score -= 5; }
  if (ctx.battles.length === 0)     { suggestions.push("No battles in the bracket yet"); score -= 5; }
  if (ctx.program.length === 0)     { suggestions.push("Event program/schedule is empty"); score -= 5; }
  if (!s[SETTINGS_KEYS.registrationOpen]) { suggestions.push("Battle registration is closed — open it when ready"); }

  return { score: Math.max(0, score), issues, suggestions };
}

router.get("/ai/health", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const ctx = await getBttsContext();
    res.json(buildHealthScore(ctx));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

const BTTS_TOOLS: Anthropic.Tool[] = [
  {
    name: "update_event_settings",
    description: "Update one or more BTTS event settings such as title, date, venue, city, registration status, active battle format, or ticket URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        eventTitle:       { type: "string",  description: "Event title" },
        eventDate:        { type: "string",  description: "Event date (human-readable, e.g. 'June 21 2026')" },
        eventYear:        { type: "string",  description: "Event year" },
        eventVenue:       { type: "string",  description: "Venue name" },
        eventCity:        { type: "string",  description: "City" },
        registrationOpen: { type: "boolean", description: "Whether battle registration is open" },
        activeFormat:     { type: "string",  description: "Active battle format e.g. '1v1', '2v2'" },
        ticketUrl:        { type: "string",  description: "External ticket purchase URL" },
      },
      required: [],
    },
  },
  {
    name: "create_ticket_type",
    description: "Create a new ticket or battle spot type for the event. Supports phase-based pricing where the same group has early_bird → regular → late phases that activate automatically as each sells out.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:         { type: "string",  description: "Ticket name, e.g. '1v1 Battle Spot — Early Bird'" },
        description:  { type: "string",  description: "Short description" },
        price:        { type: "number",  description: "Price in whole euros (0 = free)" },
        type:         { type: "string",  enum: ["spot", "general", "guest"], description: "'spot' = battle entry, 'general' = standard event entry, 'guest' = normal guest/visitor pass" },
        battleFormat: { type: "string",  description: "Battle format this spot is for, e.g. '1v1'" },
        totalSpots:   { type: "number",  description: "Total available spots (0 = unlimited)" },
        isActive:     { type: "boolean", description: "Whether to activate immediately (only first phase should be active)" },
        phase:        { type: "string",  enum: ["early_bird", "regular", "late"], description: "Phase name for tiered pricing. First phase starts active, later phases auto-activate." },
        phaseGroup:   { type: "string",  description: "Group key tying phases together, e.g. 'guest_adult' or 'battle_1v1'. All phases in a group share this key." },
        ageGroup:     { type: "string",  enum: ["adult", "youth", "child"], description: "Age group qualifier for the ticket" },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "update_event_cta",
    description: "Update the CTA (call-to-action) section shown at the bottom of the BTTS page. Controls the badge text (e.g. 'Free Entry'), headline, and description.",
    input_schema: {
      type: "object" as const,
      properties: {
        ctaBadge: { type: "string", description: "Short badge label, e.g. 'Free Entry' or '€5 Entry'" },
        ctaTitle: { type: "string", description: "CTA section headline, e.g. 'Join the Movement'" },
        ctaDesc:  { type: "string", description: "CTA body text explaining what visitors can expect" },
      },
    },
  },
  {
    name: "update_video_behavior",
    description: "Control how the hero background video behaves on the BTTS page.",
    input_schema: {
      type: "object" as const,
      properties: {
        mode:    { type: "string", enum: ["background", "silent", "sound"], description: "'background' = visual only (no audio controls shown), 'silent' = muted but user can unmute, 'sound' = plays with audio by default" },
        muted:   { type: "boolean", description: "Whether the video starts muted. Defaults to true." },
        enabled: { type: "boolean", description: "Whether to show the video at all. Set false to show a static hero instead." },
      },
    },
  },
  {
    name: "set_phase_sold_out",
    description: "Mark a ticket phase as sold out (deactivates it) and optionally activate the next phase in the same group.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticketId:       { type: "number", description: "ID of the ticket to mark sold out" },
        activateNextId: { type: "number", description: "ID of the next phase ticket to activate (optional — if omitted, just deactivates current)" },
      },
      required: ["ticketId"],
    },
  },
  {
    name: "add_judge",
    description: "Add a judge to the BTTS event. For well-known figures in breaking culture, write a rich bio drawing on your knowledge. Always mark as added_by_ai.",
    input_schema: {
      type: "object" as const,
      properties: {
        guestName:   { type: "string", description: "Judge's name or b-boy/b-girl alias" },
        specialty:   { type: "string", description: "What they judge or are known for, e.g. 'Breaking — Toprock & Footwork'" },
        bio:         { type: "string", description: "Rich biography: their background, titles, achievements, and style. Write from your knowledge for public figures." },
        category:    { type: "string", description: "Dance style category e.g. 'Breaking'" },
        judgeNumber: { type: "number", description: "Position/number (1, 2, 3…)" },
        avatarUrl:   { type: "string", description: "URL to profile image if available" },
      },
      required: ["guestName"],
    },
  },
  {
    name: "bulk_add_judges",
    description: "Add multiple judges at once in a single call. Use this when asked to set up a judging panel, add several judges, or populate judges for an event.",
    input_schema: {
      type: "object" as const,
      properties: {
        judges: {
          type: "array",
          description: "Array of judge objects to add",
          items: {
            type: "object",
            properties: {
              guestName:   { type: "string" },
              specialty:   { type: "string" },
              bio:         { type: "string", description: "Rich bio from your knowledge if they are a public figure" },
              category:    { type: "string" },
              judgeNumber: { type: "number" },
            },
            required: ["guestName"],
          },
        },
      },
      required: ["judges"],
    },
  },
  {
    name: "add_lineup_member",
    description: "Add a performer, DJ, MC, host, or artist to the BTTS lineup.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:      { type: "string", description: "Person's name or alias" },
        role:      { type: "string", description: "Their role at the event e.g. 'DJ', 'MC', 'Host'" },
        category:  { type: "string", enum: ["performer", "dj", "host", "mc", "guest", "other"], description: "Category" },
        bio:       { type: "string", description: "Short biography or description — use your knowledge for public figures" },
        instagram: { type: "string", description: "Instagram handle (without @)" },
        featured:  { type: "boolean", description: "Whether to feature them prominently" },
      },
      required: ["name", "role"],
    },
  },
  {
    name: "create_battle",
    description: "Add a single battle entry to the BTTS bracket.",
    input_schema: {
      type: "object" as const,
      properties: {
        battleType:    { type: "string", description: "e.g. '1v1', '2v2'" },
        category:      { type: "string", description: "Dance category e.g. 'Breaking'" },
        round:         { type: "string", description: "e.g. 'Final', 'Semi Final', 'Quarter Final', 'Round of 16', 'Prelim'" },
        participant1:  { type: "string", description: "First competitor name" },
        participant2:  { type: "string", description: "Second competitor name" },
        position:      { type: "number", description: "Position in the bracket" },
      },
      required: ["battleType", "round"],
    },
  },
  {
    name: "bulk_create_bracket",
    description: "Create a complete bracket structure with multiple battles at once. Use this when setting up a full event bracket.",
    input_schema: {
      type: "object" as const,
      properties: {
        battles: {
          type: "array",
          description: "Array of battle objects",
          items: {
            type: "object",
            properties: {
              battleType: { type: "string" },
              category:   { type: "string" },
              round:      { type: "string" },
              participant1: { type: "string" },
              participant2: { type: "string" },
              position:   { type: "number" },
            },
            required: ["battleType", "round"],
          },
        },
      },
      required: ["battles"],
    },
  },
  {
    name: "suggest_bracket_structure",
    description: "Suggest a bracket structure based on the number of registered participants and battle format. Returns a suggested setup without creating anything.",
    input_schema: {
      type: "object" as const,
      properties: {
        format:       { type: "string", description: "Battle format e.g. '1v1'" },
        participants: { type: "number", description: "Expected or registered participant count" },
      },
      required: ["format", "participants"],
    },
  },
  {
    name: "delete_ai_items",
    description: "Delete all AI-generated items of a specific type. Use when asked to clear, undo, or remove AI-added content.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["judges", "lineup", "battles", "all"], description: "Which type of AI-added items to delete" },
      },
      required: ["type"],
    },
  },
  {
    name: "update_battle",
    description: "Update an existing battle by its ID. Use to change participant names, round, status, winner, or scheduled time.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:           { type: "number", description: "The battle ID to update" },
        battleType:   { type: "string", description: "e.g. '1v1', '2v2'" },
        category:     { type: "string", description: "Dance category" },
        round:        { type: "string", description: "e.g. 'Final', 'Semi Final', 'Quarter Final'" },
        participant1: { type: "string", description: "First competitor name" },
        participant2: { type: "string", description: "Second competitor name" },
        winner:       { type: "string", description: "Winner name (leave empty if not decided)" },
        scheduledTime:{ type: "string", description: "Scheduled time e.g. '15:00'" },
        status:       { type: "string", enum: ["upcoming","live","completed"], description: "Battle status" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_battle",
    description: "Delete a specific battle by ID. Use when the admin asks to remove a specific battle.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The battle ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_lineup_member",
    description: "Update an existing lineup member by ID. Use to change name, role, bio, featured status, or category.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:        { type: "number", description: "Lineup member ID to update" },
        name:      { type: "string" },
        role:      { type: "string" },
        category:  { type: "string", enum: ["performer", "dj", "host", "mc", "guest", "other"] },
        bio:       { type: "string" },
        instagram: { type: "string" },
        featured:  { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_lineup_member",
    description: "Delete a specific lineup member by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "Lineup member ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_judge",
    description: "Update an existing judge by ID. Use to change name, specialty, bio, or category.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:        { type: "number", description: "Judge ID to update" },
        guestName: { type: "string" },
        specialty: { type: "string" },
        bio:       { type: "string" },
        category:  { type: "string" },
        avatarUrl: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "add_program_item",
    description: "Add a new item to the event program/schedule.",
    input_schema: {
      type: "object" as const,
      properties: {
        time:        { type: "string", description: "Start time e.g. '14:00'" },
        endTime:     { type: "string", description: "End time e.g. '15:30'" },
        title:       { type: "string", description: "Program item title" },
        artist:      { type: "string", description: "Performer or artist name" },
        stage:       { type: "string", description: "Stage or location name" },
        type:        { type: "string", enum: ["battle","dj","performance","special"], description: "Type of program item" },
        description: { type: "string", description: "Short description" },
        isHighlight: { type: "boolean", description: "Mark as a highlight" },
        sortOrder:   { type: "number", description: "Sort position" },
      },
      required: ["time", "title"],
    },
  },
  {
    name: "update_program_item",
    description: "Update an existing program item by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:          { type: "number", description: "Program item ID to update" },
        time:        { type: "string" },
        endTime:     { type: "string" },
        title:       { type: "string" },
        artist:      { type: "string" },
        stage:       { type: "string" },
        type:        { type: "string", enum: ["battle","dj","performance","special"] },
        description: { type: "string" },
        isHighlight: { type: "boolean" },
        sortOrder:   { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_program_item",
    description: "Delete a specific program item by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "Program item ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_ticket_type",
    description: "Update an existing ticket type by ID. Use to change name, price, description, availability, or active status.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:          { type: "number", description: "Ticket type ID to update" },
        name:        { type: "string" },
        description: { type: "string" },
        price:       { type: "number", description: "Price in euros" },
        totalSpots:  { type: "number", description: "Total spots (0 = unlimited)" },
        isActive:    { type: "boolean", description: "Whether the ticket is on sale" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_ticket_type",
    description: "Delete a ticket type by ID. Only works if there are no purchases against it.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "Ticket type ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "bulk_create_lineup",
    description: "Create multiple lineup members in one call. Ideal for populating an entire lineup quickly (DJs, MCs, breakers, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        members: {
          type: "array",
          description: "Array of lineup members to create",
          items: {
            type: "object",
            properties: {
              name:      { type: "string", description: "Artist name or alias" },
              role:      { type: "string", description: "e.g. DJ, MC, B-Boy, B-Girl, Host, Graffiti Artist" },
              category:  { type: "string", description: "performer | dj | mc | host | graffiti | other" },
              bio:       { type: "string", description: "Short bio or background (optional)" },
              instagram: { type: "string", description: "Instagram handle without @ (optional)" },
              featured:  { type: "boolean", description: "Whether to feature this person prominently (optional)" },
            },
            required: ["name", "role"],
          },
        },
      },
      required: ["members"],
    },
  },
  {
    name: "set_battle_winner",
    description: "Quickly set the winner of a battle and update its status to 'completed'. Faster than update_battle when you only need to record a result.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:     { type: "number", description: "Battle ID" },
        winner: { type: "string", description: "Name of the winner" },
        notes:  { type: "string", description: "Optional notes or score details" },
      },
      required: ["id", "winner"],
    },
  },
  {
    name: "get_event_summary",
    description: "Get a concise text summary of the entire event state — settings, ticket sales, registrations, lineup count, bracket progress. Use before planning bulk changes or to answer status questions.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "update_event_description",
    description: "Update the main event description text shown in the hero section and event info cards. This is the longer narrative paragraph about the event.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "The event description text (can be multiple sentences)" },
      },
      required: ["description"],
    },
  },
  {
    name: "set_registration_status",
    description: "Open or close battle registrations. Optionally schedule an auto-close time and add a status message visible to users.",
    input_schema: {
      type: "object" as const,
      properties: {
        open:    { type: "boolean", description: "true = open registrations, false = close them" },
        message: { type: "string", description: "Optional message shown to users (e.g. 'Registration closes August 1')" },
      },
      required: ["open"],
    },
  },
  {
    name: "reorder_program",
    description: "Reorder program items by providing a new sort order. Useful after adding multiple items out of sequence.",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          description: "Array of {id, sortOrder} pairs",
          items: {
            type: "object",
            properties: {
              id:        { type: "number" },
              sortOrder: { type: "number" },
              time:      { type: "string", description: "Optional — also update the time string" },
            },
            required: ["id", "sortOrder"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "bulk_update_lineup_bios",
    description: "Update bios for multiple lineup members or judges at once. Useful for enriching profiles after a bulk add.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["lineup", "judges"], description: "Which collection to update" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id:  { type: "number" },
              bio: { type: "string" },
            },
            required: ["id", "bio"],
          },
        },
      },
      required: ["type", "updates"],
    },
  },
];

async function executeToolCall(toolName: string, toolInput: any): Promise<string> {
  try {
    if (toolName === "update_event_settings") {
      const mapping: Record<string, string> = {
        eventTitle: SETTINGS_KEYS.eventTitle, eventDate: SETTINGS_KEYS.eventDate,
        eventYear: SETTINGS_KEYS.eventYear, eventVenue: SETTINGS_KEYS.eventVenue,
        eventCity: SETTINGS_KEYS.eventCity, ticketUrl: SETTINGS_KEYS.ticketUrl,
        registrationOpen: SETTINGS_KEYS.registrationOpen, activeFormat: SETTINGS_KEYS.activeFormat,
      };
      const labels: Record<string, string> = {
        eventTitle: "BTTS Event Title", eventDate: "BTTS Event Date", eventYear: "BTTS Event Year",
        eventVenue: "BTTS Event Venue", eventCity: "BTTS Event City", ticketUrl: "BTTS Ticket URL",
        registrationOpen: "BTTS Registration Open", activeFormat: "BTTS Active Format",
      };
      const updated: string[] = [];
      for (const [k, v] of Object.entries(toolInput)) {
        if (mapping[k]) {
          await upsertSetting(mapping[k], String(v), labels[k] ?? k);
          updated.push(k);
        }
      }
      return `Updated settings: ${updated.join(", ")}`;
    }

    if (toolName === "update_event_cta") {
      const { ctaBadge, ctaTitle, ctaDesc } = toolInput;
      if (typeof ctaBadge === "string") await upsertSetting(SETTINGS_KEYS.ctaBadge, ctaBadge, "BTTS CTA Badge", "CTA badge label");
      if (typeof ctaTitle === "string") await upsertSetting(SETTINGS_KEYS.ctaTitle, ctaTitle, "BTTS CTA Title", "CTA headline");
      if (typeof ctaDesc === "string")  await upsertSetting(SETTINGS_KEYS.ctaDesc, ctaDesc, "BTTS CTA Description", "CTA body text");
      return `Updated CTA section — badge: "${ctaBadge ?? "unchanged"}", title: "${ctaTitle ?? "unchanged"}"`;
    }

    if (toolName === "update_video_behavior") {
      const { mode, muted, enabled } = toolInput;
      if (typeof mode === "string" && ["background", "silent", "sound"].includes(mode))
        await upsertSetting(SETTINGS_KEYS.videoMode, mode, "BTTS Video Mode", "Video behavior mode");
      if (typeof muted === "boolean")
        await upsertSetting(SETTINGS_KEYS.videoMuted, muted ? "true" : "false", "BTTS Video Muted", "Whether video starts muted");
      if (typeof enabled === "boolean")
        await upsertSetting(SETTINGS_KEYS.videoEnabled, enabled ? "true" : "false", "BTTS Video Enabled", "Whether video is shown");
      return `Updated video behavior — mode: ${mode ?? "unchanged"}, muted: ${muted ?? "unchanged"}, enabled: ${enabled ?? "unchanged"}`;
    }

    if (toolName === "set_phase_sold_out") {
      const { ticketId, activateNextId } = toolInput;
      await db.update(bttsTickets).set({ isActive: false } as any).where(eq(bttsTickets.id, Number(ticketId)));
      if (activateNextId) {
        await db.update(bttsTickets).set({ isActive: true } as any).where(eq(bttsTickets.id, Number(activateNextId)));
        return `Phase ticket #${ticketId} marked sold out. Next phase #${activateNextId} is now active.`;
      }
      return `Phase ticket #${ticketId} marked sold out. No next phase activated.`;
    }

    if (toolName === "create_ticket_type") {
      const [row] = await db.insert(bttsTickets).values({
        name:         toolInput.name,
        description:  toolInput.description ?? "",
        price:        toolInput.price ?? 0,
        currency:     "EUR",
        type:         toolInput.type ?? "general",
        battleFormat: toolInput.battleFormat ?? null,
        totalSpots:   toolInput.totalSpots ?? 0,
        isActive:     toolInput.isActive !== false,
        phase:        toolInput.phase ?? null,
        phaseGroup:   toolInput.phaseGroup ?? null,
        ageGroup:     toolInput.ageGroup ?? null,
      } as any).returning();
      return `Created ticket type "${row.name}" (ID ${row.id})${toolInput.phase ? ` — phase: ${toolInput.phase}, group: ${toolInput.phaseGroup ?? "none"}` : ""}`;
    }

    if (toolName === "add_judge") {
      const existing = await db.select().from(bttsJudges).orderBy(desc(bttsJudges.judgeNumber)).limit(1);
      const nextNum = toolInput.judgeNumber ?? ((existing[0]?.judgeNumber ?? 0) + 1);
      const [row] = await db.insert(bttsJudges).values({
        guestName: toolInput.guestName,
        specialty: toolInput.specialty ?? "",
        bio: toolInput.bio ?? "",
        category: toolInput.category ?? "Breaking",
        judgeNumber: nextNum,
        avatarUrl: toolInput.avatarUrl ?? "",
        addedByAi: true,
      }).returning();
      return `Added judge "${row.guestName}" (#${row.judgeNumber}) with bio`;
    }

    if (toolName === "bulk_add_judges") {
      const existing = await db.select().from(bttsJudges).orderBy(desc(bttsJudges.judgeNumber)).limit(1);
      let nextNum = (existing[0]?.judgeNumber ?? 0) + 1;
      const judges: any[] = toolInput.judges ?? [];
      const results: string[] = [];
      for (const j of judges) {
        const [row] = await db.insert(bttsJudges).values({
          guestName: j.guestName,
          specialty: j.specialty ?? "",
          bio: j.bio ?? "",
          category: j.category ?? "Breaking",
          judgeNumber: j.judgeNumber ?? nextNum++,
          avatarUrl: j.avatarUrl ?? "",
          addedByAi: true,
        }).returning();
        results.push(`"${row.guestName}" (#${row.judgeNumber})`);
      }
      return `Added ${results.length} judges: ${results.join(", ")}`;
    }

    if (toolName === "add_lineup_member") {
      const row = await storage.createBttsLineupMember({
        name: toolInput.name,
        role: toolInput.role,
        category: toolInput.category ?? "performer",
        bio: toolInput.bio ?? "",
        instagram: toolInput.instagram ?? "",
        imageUrl: "",
        featured: toolInput.featured ?? false,
        sortOrder: 0,
        addedByAi: true,
      });
      return `Added lineup member "${row.name}" as ${row.role}`;
    }

    if (toolName === "create_battle") {
      const row = await storage.createBttsBattle({
        battleType: toolInput.battleType ?? "1v1",
        category: toolInput.category ?? "Breaking",
        round: toolInput.round,
        position: toolInput.position ?? 1,
        participant1: toolInput.participant1 ?? "TBD",
        participant2: toolInput.participant2 ?? "TBD",
        winner: "",
        scheduledTime: "",
        status: "upcoming",
        addedByAi: true,
      });
      return `Created battle in "${toolInput.round}" — ${toolInput.participant1 ?? "TBD"} vs ${toolInput.participant2 ?? "TBD"}`;
    }

    if (toolName === "bulk_create_bracket") {
      const battles: any[] = toolInput.battles ?? [];
      let created = 0;
      for (const b of battles) {
        await storage.createBttsBattle({
          battleType: b.battleType ?? "1v1",
          category: b.category ?? "Breaking",
          round: b.round,
          position: b.position ?? created + 1,
          participant1: b.participant1 ?? "TBD",
          participant2: b.participant2 ?? "TBD",
          winner: "",
          scheduledTime: "",
          status: "upcoming",
          addedByAi: true,
        });
        created++;
      }
      return `Created ${created} battles in the bracket`;
    }

    if (toolName === "suggest_bracket_structure") {
      const { format, participants } = toolInput;
      const n = Number(participants);
      let rounds: string[] = [];
      if (n <= 2)  rounds = ["Final"];
      else if (n <= 4)  rounds = ["Semi Final", "Final"];
      else if (n <= 8)  rounds = ["Quarter Final", "Semi Final", "Final"];
      else if (n <= 16) rounds = ["Round of 16", "Quarter Final", "Semi Final", "Final"];
      else              rounds = ["Prelim", "Round of 16", "Quarter Final", "Semi Final", "Final"];
      return `Suggested bracket for ${format} with ${n} participants:\nRounds: ${rounds.join(" → ")}\nTotal battles: ${n - 1}`;
    }

    if (toolName === "delete_ai_items") {
      const { type } = toolInput;
      const counts: string[] = [];
      if (type === "judges" || type === "all") {
        const res = await db.delete(bttsJudges).where(eq(bttsJudges.addedByAi, true)).returning();
        counts.push(`${res.length} judges`);
      }
      if (type === "lineup" || type === "all") {
        const res = await db.delete(bttsLineup).where(eq(bttsLineup.addedByAi, true)).returning();
        counts.push(`${res.length} lineup members`);
      }
      if (type === "battles" || type === "all") {
        const res = await db.delete(bttsBattles).where(eq(bttsBattles.addedByAi, true)).returning();
        counts.push(`${res.length} battles`);
      }
      return `Deleted AI-added items: ${counts.join(", ")}`;
    }

    if (toolName === "update_battle") {
      const { id, ...fields } = toolInput;
      const patch: Record<string,any> = {};
      if (fields.battleType   !== undefined) patch.battleType    = fields.battleType;
      if (fields.category     !== undefined) patch.category      = fields.category;
      if (fields.round        !== undefined) patch.round         = fields.round;
      if (fields.participant1 !== undefined) patch.participant1  = fields.participant1;
      if (fields.participant2 !== undefined) patch.participant2  = fields.participant2;
      if (fields.winner       !== undefined) patch.winner        = fields.winner || "";
      if (fields.scheduledTime!== undefined) patch.scheduledTime = fields.scheduledTime;
      if (fields.status       !== undefined) patch.status        = fields.status;
      await db.update(bttsBattles).set(patch).where(eq(bttsBattles.id, Number(id)));
      return `Updated battle #${id}`;
    }

    if (toolName === "delete_battle") {
      await db.delete(bttsBattles).where(eq(bttsBattles.id, Number(toolInput.id)));
      return `Deleted battle #${toolInput.id}`;
    }

    if (toolName === "update_lineup_member") {
      const { id, ...fields } = toolInput;
      const patch: Record<string,any> = {};
      if (fields.name      !== undefined) patch.name      = fields.name;
      if (fields.role      !== undefined) patch.role      = fields.role;
      if (fields.category  !== undefined) patch.category  = fields.category;
      if (fields.bio       !== undefined) patch.bio       = fields.bio;
      if (fields.instagram !== undefined) patch.instagram = fields.instagram;
      if (fields.featured  !== undefined) patch.featured  = fields.featured;
      await db.update(bttsLineup).set(patch).where(eq(bttsLineup.id, Number(id)));
      return `Updated lineup member #${id}`;
    }

    if (toolName === "delete_lineup_member") {
      await db.delete(bttsLineup).where(eq(bttsLineup.id, Number(toolInput.id)));
      return `Deleted lineup member #${toolInput.id}`;
    }

    if (toolName === "update_judge") {
      const { id, ...fields } = toolInput;
      const patch: Record<string,any> = {};
      if (fields.guestName !== undefined) patch.guestName = fields.guestName;
      if (fields.specialty !== undefined) patch.specialty = fields.specialty;
      if (fields.bio       !== undefined) patch.bio       = fields.bio;
      if (fields.category  !== undefined) patch.category  = fields.category;
      if (fields.avatarUrl !== undefined) patch.avatarUrl = fields.avatarUrl;
      await db.update(bttsJudges).set(patch).where(eq(bttsJudges.id, Number(id)));
      return `Updated judge #${id}`;
    }

    if (toolName === "add_program_item") {
      const row = await storage.createBttsProgramItem({
        time:        toolInput.time,
        endTime:     toolInput.endTime ?? "",
        title:       toolInput.title,
        artist:      toolInput.artist ?? "",
        stage:       toolInput.stage ?? "",
        type:        toolInput.type ?? "performance",
        description: toolInput.description ?? "",
        isHighlight: toolInput.isHighlight ?? false,
        sortOrder:   toolInput.sortOrder ?? 0,
      });
      return `Added program item "${toolInput.title}" at ${toolInput.time}`;
    }

    if (toolName === "update_program_item") {
      const { id, ...fields } = toolInput;
      const patch: Record<string,any> = {};
      if (fields.time        !== undefined) patch.time        = fields.time;
      if (fields.endTime     !== undefined) patch.endTime     = fields.endTime;
      if (fields.title       !== undefined) patch.title       = fields.title;
      if (fields.artist      !== undefined) patch.artist      = fields.artist;
      if (fields.stage       !== undefined) patch.stage       = fields.stage;
      if (fields.type        !== undefined) patch.type        = fields.type;
      if (fields.description !== undefined) patch.description = fields.description;
      if (fields.isHighlight !== undefined) patch.isHighlight = fields.isHighlight;
      if (fields.sortOrder   !== undefined) patch.sortOrder   = fields.sortOrder;
      await storage.updateBttsProgramItem(Number(id), patch);
      return `Updated program item #${id}`;
    }

    if (toolName === "delete_program_item") {
      await storage.deleteBttsProgramItem(Number(toolInput.id));
      return `Deleted program item #${toolInput.id}`;
    }

    if (toolName === "update_ticket_type") {
      const { id, ...fields } = toolInput;
      const patch: Record<string,any> = {};
      if (fields.name        !== undefined) patch.name        = fields.name;
      if (fields.description !== undefined) patch.description = fields.description;
      if (fields.price       !== undefined) patch.price       = fields.price;
      if (fields.totalSpots  !== undefined) patch.totalSpots  = fields.totalSpots;
      if (fields.isActive    !== undefined) patch.isActive    = fields.isActive;
      if (fields.phase       !== undefined) patch.phase       = fields.phase;
      if (fields.phaseGroup  !== undefined) patch.phaseGroup  = fields.phaseGroup;
      if (fields.ageGroup    !== undefined) patch.ageGroup    = fields.ageGroup;
      await db.update(bttsTickets).set(patch as any).where(eq(bttsTickets.id, Number(id)));
      return `Updated ticket type #${id}`;
    }

    if (toolName === "delete_ticket_type") {
      const tid = Number(toolInput.id);
      // Cascade: delete purchases first to avoid orphaned records
      await db.delete(bttsTicketPurchases).where(eq(bttsTicketPurchases.ticketId, tid));
      await db.delete(bttsTickets).where(eq(bttsTickets.id, tid));
      return `Deleted ticket type #${tid} and its associated purchases`;
    }

    if (toolName === "bulk_create_lineup") {
      const members: any[] = toolInput.members ?? [];
      const results: string[] = [];
      for (const m of members) {
        const row = await storage.createBttsLineupMember({
          name:      m.name,
          role:      m.role,
          category:  m.category ?? "performer",
          bio:       m.bio ?? "",
          instagram: m.instagram ?? "",
          imageUrl:  "",
          featured:  m.featured ?? false,
          sortOrder: 0,
          addedByAi: true,
        });
        results.push(`"${row.name}" (${row.role})`);
      }
      return `Created ${results.length} lineup members: ${results.join(", ")}`;
    }

    if (toolName === "set_battle_winner") {
      const { id, winner, notes } = toolInput;
      const patch: any = { winner, status: "completed" };
      if (notes) patch.notes = notes;
      await db.update(bttsBattles).set(patch).where(eq(bttsBattles.id, Number(id)));
      return `Set winner of battle #${id} to "${winner}" — status: completed${notes ? ` (notes: ${notes})` : ""}`;
    }

    if (toolName === "get_event_summary") {
      const ctx = await getBttsContext();
      const s = ctx.settings ?? {};
      const tickets = ctx.tickets ?? [];
      const regs = ctx.registrations ?? [];
      const lineup = ctx.lineup ?? [];
      const judges = ctx.judges ?? [];
      const battles = ctx.battles ?? [];
      const prog = ctx.program ?? [];
      const completedBattles = (battles as any[]).filter((b: any) => b.status === "completed").length;
      const totalSpots = (tickets as any[]).reduce((sum: number, t: any) => sum + (Number(t.totalSpots) || 0), 0);
      const soldSpots  = (tickets as any[]).reduce((sum: number, t: any) => sum + (Number(t.soldSpots)  || 0), 0);
      return [
        `## BTTS Event Summary`,
        `**Event:** ${s[SETTINGS_KEYS.eventTitle] ?? "Back to the Street"} (${s[SETTINGS_KEYS.eventYear] ?? "2026"})`,
        `**Date:** ${s[SETTINGS_KEYS.eventDate] ?? "TBD"} @ ${s[SETTINGS_KEYS.eventVenue] ?? "TBD"}, ${s[SETTINGS_KEYS.eventCity] ?? "Netherlands"}`,
        `**Registration:** ${s[SETTINGS_KEYS.registrationOpen] === "true" ? "OPEN" : "CLOSED"}`,
        `**CTA Badge:** "${s[SETTINGS_KEYS.ctaBadge] ?? "Free Entry"}"`,
        `**Video Mode:** ${s[SETTINGS_KEYS.videoMode] ?? "background"}`,
        `**Lineup:** ${(lineup as any[]).length} members (${(lineup as any[]).filter((l: any) => l.featured).length} featured)`,
        `**Judges:** ${(judges as any[]).length} total`,
        `**Battles:** ${(battles as any[]).length} total, ${completedBattles} completed`,
        `**Program:** ${(prog as any[]).length} items`,
        `**Ticket Types:** ${(tickets as any[]).length} types | Spots sold: ${soldSpots}/${totalSpots > 0 ? totalSpots : "∞"}`,
        `**Registrations:** ${(regs as any[]).length} submitted`,
      ].join("\n");
    }

    if (toolName === "update_event_description") {
      await upsertSetting(SETTINGS_KEYS.eventDescription, toolInput.description, "BTTS Event Description", "Event narrative paragraph");
      return `Updated event description (${toolInput.description.length} chars)`;
    }

    if (toolName === "set_registration_status") {
      const { open, message } = toolInput;
      await upsertSetting(SETTINGS_KEYS.registrationOpen, open ? "true" : "false", "BTTS Registration Open", "Whether battle registration is open");
      let result = `Battle registrations ${open ? "OPENED" : "CLOSED"}`;
      if (message) result += `. Message: "${message}"`;
      return result;
    }

    if (toolName === "reorder_program") {
      const items: any[] = toolInput.items ?? [];
      let updated = 0;
      for (const item of items) {
        const patch: any = { sortOrder: item.sortOrder };
        if (item.time) patch.time = item.time;
        await storage.updateBttsProgramItem(Number(item.id), patch);
        updated++;
      }
      return `Reordered ${updated} program items`;
    }

    if (toolName === "bulk_update_lineup_bios") {
      const { type, updates } = toolInput;
      let count = 0;
      for (const u of updates ?? []) {
        if (type === "lineup") {
          await db.update(bttsLineup).set({ bio: u.bio }).where(eq(bttsLineup.id, Number(u.id)));
        } else if (type === "judges") {
          await db.update(bttsJudges).set({ bio: u.bio }).where(eq(bttsJudges.id, Number(u.id)));
        }
        count++;
      }
      return `Updated bios for ${count} ${type}`;
    }

    return `Unknown tool: ${toolName}`;
  } catch (e: any) {
    return `Error executing ${toolName}: ${e.message}`;
  }
}

router.post("/ai/chat", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message required" });

    const ctx = await getBttsContext();
    const health = buildHealthScore(ctx);

    const aiJudgeCount = (ctx.judges as any[]).filter((j: any) => j.addedByAi).length;
    const aiLineupCount = (ctx.lineup as any[]).filter((l: any) => l.addedByAi).length;
    const aiBattleCount = (ctx.battles as any[]).filter((b: any) => b.addedByAi).length;

    const systemPrompt = `You are the AI Event Assistant for "Back to the Street" (BTTS) — a premier Dutch urban culture and breakdancing event produced by Urban Culture Hub. You live inside the admin panel used by the event organizer.

## Who you're working with
Riki Almouti is the organizer. He builds events in the Dutch urban culture scene — breaking, b-boy/b-girl battles, hip-hop culture. BTTS is his flagship event.

## Breaking Culture Knowledge
You are deeply knowledgeable about breaking (breakdancing) culture. You know:
- The difference between toprock, downrock, freezes, and power moves
- Major world breaking events: Red Bull BC One, Battle of the Year (BOTY), Silverback Open, UK B-Boy Championships, Flying Steps Open, Freestyle Session
- Famous b-boys and b-girls: Menno (Netherlands — legendary footwork), Victor (France — freezes), Hong10 (Korea — power), Lilou (France — style), Roxrite (USA), Neguin (Brazil), Logistx (USA — first female Red Bull BC One champion), Luigi (Netherlands)
- Famous breaking DJs: Rafik, Toni Varga, Fleg
- Dutch breaking scene specifics: Menno is from the Netherlands, there's a strong scene in Amsterdam and Rotterdam
- Judging criteria: technique, musicality, creativity, vocabulary (variety of moves), battle mentality
- Battle formats: 1v1, 2v2 (duo), crew battles (4v4, 5v5), judge-based (usually 3-5 judges), cypher format

## Current Event State
**Event Settings:**
${JSON.stringify({
  title: ctx.settings[SETTINGS_KEYS.eventTitle] || null,
  date: ctx.settings[SETTINGS_KEYS.eventDate] || null,
  year: ctx.settings[SETTINGS_KEYS.eventYear] || null,
  venue: ctx.settings[SETTINGS_KEYS.eventVenue] || null,
  city: ctx.settings[SETTINGS_KEYS.eventCity] || null,
  registrationOpen: ctx.settings[SETTINGS_KEYS.registrationOpen],
  activeFormat: ctx.settings[SETTINGS_KEYS.activeFormat] || "1v1",
  ticketUrl: ctx.settings[SETTINGS_KEYS.ticketUrl] || null,
}, null, 2)}

**Video Settings:** mode=${ctx.settings[SETTINGS_KEYS.videoMode] ?? "background"}, muted=${ctx.settings[SETTINGS_KEYS.videoMuted] ?? "true"}, enabled=${ctx.settings[SETTINGS_KEYS.videoEnabled] ?? "false"}
**CTA Badge:** ${ctx.settings[SETTINGS_KEYS.ctaBadge] ?? "Free Entry"} | Title: ${ctx.settings[SETTINGS_KEYS.ctaTitle] ?? "Join the Movement"} | Desc: ${ctx.settings[SETTINGS_KEYS.ctaDesc] ? ctx.settings[SETTINGS_KEYS.ctaDesc].slice(0, 80) + "…" : "(default)"}

**Tickets (${ctx.tickets.length}):** ${ctx.tickets.length === 0 ? "None created yet" : JSON.stringify(ctx.tickets.map((t:any) => ({ id: t.id, name: t.name, type: t.type, price: `€${t.price}`, spots: t.totalSpots === 0 ? "unlimited" : t.totalSpots, active: t.isActive, phase: (t as any).phase ?? null, phaseGroup: (t as any).phaseGroup ?? null })))}

**Ticket Claims:** ${ctx.purchases.length} total purchases/registrations

**Battle Registrations (${ctx.registrations.length}):** ${ctx.registrations.length === 0 ? "None yet" : JSON.stringify(ctx.registrations.slice(0, 15).map((r:any) => ({ name: r.guestName, type: r.battleType, category: r.category, status: r.status })))}

**Judges (${ctx.judges.length} — ${aiJudgeCount} AI-added):** ${ctx.judges.length === 0 ? "No judges yet" : JSON.stringify((ctx.judges as any[]).map((j:any) => ({ id: j.id, name: j.guestName, specialty: j.specialty, hasBio: !!j.bio, aiAdded: j.addedByAi })))}

**Lineup (${(ctx.lineup as any[]).length} — ${aiLineupCount} AI-added):** ${(ctx.lineup as any[]).length === 0 ? "Empty" : JSON.stringify((ctx.lineup as any[]).map((l:any) => ({ id: l.id, name: l.name, role: l.role, category: l.category, featured: l.featured, aiAdded: l.addedByAi })))}

**Bracket / Battles (${(ctx.battles as any[]).length} — ${aiBattleCount} AI-added):** ${(ctx.battles as any[]).length === 0 ? "No battles yet" : JSON.stringify((ctx.battles as any[]).slice(0, 20).map((b:any) => ({ id: b.id, round: b.round, type: b.battleType, p1: b.participant1, p2: b.participant2, status: b.status, aiAdded: b.addedByAi })))}

**Program items (${(ctx.program as any[]).length})**

## Event Health: ${health.score}/100
${health.issues.length > 0 ? `Issues: ${health.issues.join("; ")}` : "No critical issues."}
${health.suggestions.length > 0 ? `Suggestions: ${health.suggestions.join("; ")}` : ""}

## What you can do

### Create & Setup
- **update_event_settings** — set title, date, venue, city, open/close registration, set format, set ticket URL, event description
- **create_ticket_type** — create battle spots or general entry tickets with optional phase-based pricing (early_bird → regular → late phases per phaseGroup). Only the first phase should be isActive=true.
- **add_judge** — add a single judge with rich bio from your breaking culture knowledge
- **bulk_add_judges** — add multiple judges at once (preferred when setting up a full panel)
- **add_lineup_member** — add a DJ, MC, host, performer to the event lineup
- **add_program_item** — add an item to the event schedule/program
- **create_battle** — add a single battle to the bracket
- **bulk_create_bracket** — create a full bracket structure at once (preferred for setting up multiple rounds)
- **suggest_bracket_structure** — analyze registrations and recommend a bracket shape (read-only)

### Page Appearance & CTA
- **update_event_cta** — edit the bottom CTA section: badge text (e.g. "Free Entry" or "€5 Entry"), headline, and body description shown to visitors. Note: the badge also appears in the hero info pills.
- **update_event_description** — update the main event narrative paragraph shown in the hero/info cards
- **update_video_behavior** — control the hero background video: mode ("background" = visual only, "silent" = muted with unmute option, "sound" = audio on), muted (bool), enabled (bool)

### Ticket Phase Management
- **set_phase_sold_out** — mark a phase as sold out (deactivates it) and optionally activate the next phase in the same phaseGroup by ID
- **set_registration_status** — open or close battle registrations with an optional status message

### Batch / Bulk Tools (saves time for large setups)
- **bulk_create_lineup** — create multiple lineup members in one call (array of name/role/bio/instagram/featured)
- **bulk_add_judges** — create multiple judges in one call
- **bulk_update_lineup_bios** — update bios for multiple lineup or judge entries at once
- **bulk_create_bracket** — create an entire bracket of battles at once

### Quick Actions
- **set_battle_winner** — instantly set the winner and status="completed" on a battle
- **get_event_summary** — read a concise snapshot of the entire event state (settings, registrations, lineup, bracket, tickets) — call this before planning bulk changes

### Edit (update existing items by ID)
- **update_battle** — change participant names, round, winner, status, or scheduled time for any battle
- **update_lineup_member** — edit name, role, bio, featured status, or category for a lineup member
- **update_judge** — edit name, specialty, bio, or category for a judge
- **update_program_item** — update time, title, artist, stage, or type for a program item
- **update_ticket_type** — change name, price, spots available, active status, phase, phaseGroup, or ageGroup of a ticket
- **reorder_program** — reorder program items by sortOrder (and optionally update their time strings)

### Delete (remove by ID)
- **delete_battle** — remove a specific battle from the bracket
- **delete_lineup_member** — remove a specific lineup member
- **delete_program_item** — remove a specific program item
- **delete_ticket_type** — remove a ticket type (only if no purchases exist)
- **delete_ai_items** — bulk-remove all AI-added judges, lineup members, or battles at once

## Behaviour Rules
1. **Always use tools to act.** If asked to add something, call the tool — don't just describe what to do.
2. **Be proactive.** If you notice the event is missing judges, a bracket, or key settings, mention it after completing the request.
3. **Write rich bios.** For any public figure in breaking culture, use your knowledge to write a proper bio. Don't write placeholder text.
4. **Prefer bulk tools.** When adding 2+ judges or battles, use bulk_add_judges or bulk_create_bracket in a single call.
5. **Auto-number judges.** When adding judges, automatically assign the next available judgeNumber.
6. **Be concise.** After action, give a short confirmation. Don't repeat all the data back at length.
7. **Speak the culture.** Use breaking terminology naturally. You're speaking to a scene insider.
8. **Phase ticketing.** When creating phased tickets for a group (e.g. early_bird/regular/late for 'guest_adult'), create all phases in one go. Only the first phase is isActive=true. Use the same phaseGroup string across all phases in the group.`;

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h: any) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: message },
    ];

    const { getResolvedRole } = await import("./aiRouter");
    const resolvedBtts = await getResolvedRole("btts");
    const bttsModel = resolvedBtts.provider === "anthropic" ? resolvedBtts.model : "claude-sonnet-4-6";

    let response = await anthropic.messages.create({
      model: bttsModel,
      max_tokens: 2048,
      system: systemPrompt,
      tools: BTTS_TOOLS,
      messages,
    });

    const actionsPerformed: { tool: string; result: string }[] = [];

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        const result = await executeToolCall(block.name, block.input as any);
        actionsPerformed.push({ tool: block.name, result });
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: bttsModel,
        max_tokens: 2048,
        system: systemPrompt,
        tools: BTTS_TOOLS,
        messages,
      });
    }

    const replyText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("\n");

    res.json({ reply: replyText, actions: actionsPerformed, health });
  } catch (e: any) {
    console.error("BTTS AI chat error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── AI Items Management ────────────────────────────────────────────────────────

router.get("/ai/items", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const [judges, lineup, battles] = await Promise.all([
      db.select().from(bttsJudges).where(eq(bttsJudges.addedByAi, true)).orderBy(asc(bttsJudges.judgeNumber)),
      db.select().from(bttsLineup).where(eq(bttsLineup.addedByAi, true)).orderBy(asc(bttsLineup.sortOrder)),
      db.select().from(bttsBattles).where(eq(bttsBattles.addedByAi, true)).orderBy(asc(bttsBattles.position)),
    ]);
    res.json({ judges, lineup, battles, total: judges.length + lineup.length + battles.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/ai/items", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;
  try {
    const type = (req.query.type as string) ?? "all";
    const counts: Record<string, number> = {};
    if (type === "judges" || type === "all") {
      const res2 = await db.delete(bttsJudges).where(eq(bttsJudges.addedByAi, true)).returning();
      counts.judges = res2.length;
    }
    if (type === "lineup" || type === "all") {
      const res2 = await db.delete(bttsLineup).where(eq(bttsLineup.addedByAi, true)).returning();
      counts.lineup = res2.length;
    }
    if (type === "battles" || type === "all") {
      const res2 = await db.delete(bttsBattles).where(eq(bttsBattles.addedByAi, true)).returning();
      counts.battles = res2.length;
    }
    res.json({ success: true, deleted: counts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export function registerBttsRoutes(app: import("express").Express) {
  app.use("/api/btts", router);
}
