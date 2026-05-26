/**
 * Culture Tools routes — backs the four AI tools on the public Culture Tools page:
 *   POST /api/style-match         — find collab matches from real members
 *   POST /api/style-dna           — generate the user's style DNA profile
 *   POST /api/sync-to-beat        — calculate beat-aligned cut points (pure math)
 *   POST /api/freestyle-generator — AI-generated freestyle bars
 *
 * All AI calls go through the central aiRouter (`content` role) so the admin
 * can swap providers/models from the AI Control panel.
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { ne, sql } from "drizzle-orm";
import { aiChat } from "./aiRouter";

function tryParseJson(text: string): any | null {
  if (!text) return null;
  // Strip ```json fences if present
  const cleaned = text.replace(/```json\s*/i, "").replace(/```\s*$/m, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  // Fall back: extract first {...} block
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

export function registerCultureToolsRoutes(app: Express) {
  // ── POST /api/style-match ─────────────────────────────────────────────────
  app.post("/api/style-match", async (req: Request, res: Response) => {
    try {
      const { discipline, skills, bio, lookingFor } = req.body ?? {};
      if (!discipline) return res.status(400).json({ error: "discipline is required" });

      // Pull a pool of public artists from DB (visible, not the requester)
      const userId = (req as any).user?.id;
      const pool = await db
        .select({
          id: users.id,
          name: users.displayName,
          avatarUrl: users.profilePicture,
          artType: users.artType,
          bio: users.bio,
          location: users.location,
        })
        .from(users)
        .where(sql`${users.isHiddenInCommunity} IS NOT TRUE AND ${users.status} = 'active'${userId ? sql` AND ${users.id} <> ${userId}` : sql``}`)
        .limit(40);

      if (pool.length === 0) {
        return res.json({ matches: [] });
      }

      const candidates = pool.map(p => ({
        id: p.id,
        name: p.name,
        discipline: p.artType || "artist",
        bio: (p.bio || "").slice(0, 200),
        location: p.location || "",
      }));

      const system = `You are an urban-culture collaboration matchmaker. Pick the 5 BEST candidates from the list whose style best complements the user's discipline and goals. Score 60-99. Return STRICT JSON only: {"matches":[{"userId":number,"matchScore":number,"reason":"short reason"}]}.`;
      const userMsg = `User profile:
- Discipline: ${discipline}
- Skills: ${skills || "(none)"}
- Bio: ${bio || "(none)"}
- Looking for: ${lookingFor || "(open)"}

Candidates (JSON):
${JSON.stringify(candidates)}

Respond with JSON only. Pick at most 5 ids that exist in the list.`;

      let parsed: any = null;
      try {
        const r = await aiChat({
          role: "content",
          system,
          messages: [{ role: "user", content: userMsg }],
          temperature: 0.4,
          maxTokens: 700,
          jsonMode: true,
        });
        parsed = tryParseJson(r.text);
      } catch (e: any) {
        console.warn("[style-match] AI failed, falling back to discipline overlap:", e?.message);
      }

      // Fallback: simple overlap by artType
      if (!parsed?.matches?.length) {
        const ranked = candidates
          .map(c => ({
            userId: c.id,
            matchScore: c.discipline?.toLowerCase().includes(String(discipline).toLowerCase()) ? 78 : 65,
            reason: `Active ${c.discipline} artist${c.location ? ` in ${c.location}` : ""}.`,
          }))
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 5);
        parsed = { matches: ranked };
      }

      const byId = new Map(pool.map(p => [p.id, p]));
      const matches = (parsed.matches || [])
        .filter((m: any) => byId.has(Number(m.userId)))
        .map((m: any) => {
          const u = byId.get(Number(m.userId))!;
          return {
            userId: u.id,
            name: u.name,
            avatarUrl: u.avatarUrl,
            discipline: u.artType || discipline,
            matchScore: Math.max(60, Math.min(99, Number(m.matchScore) || 75)),
            reason: String(m.reason || "Strong stylistic complement.").slice(0, 220),
          };
        });

      res.json({ matches });
    } catch (err: any) {
      console.error("[style-match] error:", err);
      res.status(500).json({ error: err.message || "Style match failed" });
    }
  });

  // ── POST /api/style-dna ───────────────────────────────────────────────────
  app.post("/api/style-dna", async (req: Request, res: Response) => {
    try {
      const { discipline, bio, skills, favoriteMoves, influences, yearsActive } = req.body ?? {};
      if (!discipline) return res.status(400).json({ error: "discipline is required" });

      const system = `You are an urban-culture style analyst. Decode an artist's style into a unique "Style DNA" profile. Return STRICT JSON only with this shape:
{
  "styleTitle": "short 2-4 word title",
  "dnaStrands": ["3-5 short tags"],
  "description": "1-2 sentence vivid description",
  "breakdown": {"power": 0-100, "musicality": 0-100, "creativity": 0-100, "technicalPrecision": 0-100, "footwork": 0-100, "freezeGame": 0-100},
  "comparisons": ["2-3 known artists this style echoes"],
  "growthTip": "one concrete actionable tip"
}
Adapt the breakdown keys to the discipline if it isn't breaking (e.g. for DJing use mixing, selection, scratching, crowd-read, technique, originality). Always keep 6 numeric keys.`;

      const userMsg = `Discipline: ${discipline}
Years active: ${yearsActive || "unknown"}
Bio: ${bio || "(none)"}
Signature moves/techniques: ${skills || favoriteMoves || "(none)"}
Influences: ${influences || "(none)"}

Respond with JSON only.`;

      const r = await aiChat({
        role: "content",
        system,
        messages: [{ role: "user", content: userMsg }],
        temperature: 0.7,
        maxTokens: 800,
        jsonMode: true,
      });
      const parsed = tryParseJson(r.text);
      if (!parsed) return res.status(502).json({ error: "AI returned unreadable response" });

      // Clamp numbers
      if (parsed.breakdown && typeof parsed.breakdown === "object") {
        for (const k of Object.keys(parsed.breakdown)) {
          const v = Number(parsed.breakdown[k]);
          parsed.breakdown[k] = isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 50;
        }
      }
      res.json(parsed);
    } catch (err: any) {
      console.error("[style-dna] error:", err);
      res.status(500).json({ error: err.message || "Style DNA failed" });
    }
  });

  // ── POST /api/sync-to-beat (pure math, no AI) ────────────────────────────
  app.post("/api/sync-to-beat", async (req: Request, res: Response) => {
    try {
      const bpm = Math.max(40, Math.min(220, Number(req.body?.bpm) || 90));
      const duration = Math.max(5, Math.min(600, Number(req.body?.videoDuration) || 30));
      const genre = String(req.body?.genre || "hip-hop");

      const beatLen = 60 / bpm;          // seconds per beat
      const barLen = beatLen * 4;        // assume 4/4
      const phraseLen = barLen * 4;      // 16-beat phrase = good cut point

      const points: { time: number; beat: number; label: string }[] = [];
      let beat = 0;
      for (let t = 0; t <= duration + 0.001; t += beatLen) {
        const time = Math.round(t * 100) / 100;
        if (time > duration) break;
        let label = "beat";
        if (beat === 0) label = "start";
        else if (beat % 16 === 0) label = "phrase";
        else if (beat % 8 === 0) label = "drop";
        else if (beat % 4 === 0) label = "bar";
        if (label !== "beat") points.push({ time, beat, label });
        beat++;
      }
      // Always include the final cut
      if (!points.find(p => Math.abs(p.time - duration) < 0.05)) {
        points.push({ time: Math.round(duration * 100) / 100, beat, label: "end" });
      }

      const tip = `${bpm} BPM ${genre}: cut on the ${barLen.toFixed(2)}s bars and ${phraseLen.toFixed(2)}s phrases for max impact.`;
      res.json({ bpm, duration, genre, syncPoints: points.slice(0, 32), tip });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Sync failed" });
    }
  });

  // ── POST /api/freestyle-generator ─────────────────────────────────────────
  app.post("/api/freestyle-generator", async (req: Request, res: Response) => {
    try {
      const { topic, mood = "hype", style = "battle rap", bars = "8" } = req.body ?? {};
      if (!topic || !String(topic).trim()) return res.status(400).json({ error: "topic is required" });
      const numBars = Math.max(2, Math.min(16, parseInt(String(bars)) || 8));

      const system = `You are a skilled freestyle MC writing for the Urban Culture Hub community. Write authentic, punchy bars. Keep it clean enough for general audiences (no slurs, no hateful content). Always respond in STRICT JSON: {"lyrics":"line1\\nline2\\n...","rhymeScheme":"e.g. AABB / ABAB / multi-syllable","tip":"one short flow tip"}.`;
      const userMsg = `Write ${numBars} bars of ${style}, mood: ${mood}, topic: ${topic}.
Each bar should land hard. Use internal rhymes and wordplay where natural.
Respond with JSON only.`;

      const r = await aiChat({
        role: "content",
        system,
        messages: [{ role: "user", content: userMsg }],
        temperature: 0.9,
        maxTokens: 700,
        jsonMode: true,
      });
      const parsed = tryParseJson(r.text);
      if (!parsed?.lyrics) return res.status(502).json({ error: "AI returned unreadable response" });
      res.json({
        lyrics: String(parsed.lyrics),
        rhymeScheme: parsed.rhymeScheme ? String(parsed.rhymeScheme) : undefined,
        tip: parsed.tip ? String(parsed.tip) : undefined,
      });
    } catch (err: any) {
      console.error("[freestyle-generator] error:", err);
      res.status(500).json({ error: err.message || "Freestyle generation failed" });
    }
  });
}
