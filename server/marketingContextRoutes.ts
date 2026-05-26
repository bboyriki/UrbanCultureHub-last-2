/**
 * Marketing Brain — editable, structured knowledge base the Ads Hub AI uses
 * for every draft so it stops generating generic copy.
 *
 *   GET   /api/admin/ads/context        — load (auto-creates seeded row if missing)
 *   PATCH /api/admin/ads/context        — save edits
 *   POST  /api/admin/ads/context/reset  — restore default seed
 */
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { marketingContext } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_CONTEXT = {
  appName: "Urban Culture Hub",
  tagline: "One app for everything urban — spots, people, events, culture.",
  pitch: `Urban Culture Hub is the all-in-one app for discovering and sharing the urban side of any city. We map every interesting spot — not just dance practice rooms or skate parks, but also street-art murals, hidden restaurants, indie museums, music venues, basketball courts, hangout plazas — anything that makes a city feel alive. On top of that we connect the people behind the scene: artists, dancers, DJs, MCs, graffiti writers, photographers, and culture lovers can join crews, host cyphers and battles, share reels, build their street cred, and meet up at real events. We're a discovery tool, a community, and a creator platform in one place.`,
  features: [
    { name: "Spots Map", description: "Crowd-curated map of every urban-interesting place: dance spots, graffiti walls, restaurants, museums, music venues, basketball courts, skate spots, plazas, photo locations.", audienceFit: "Tourists, locals, culture explorers" },
    { name: "Community", description: "Profiles, follows, posts, reels, comments — like an Insta but built for the urban scene.", audienceFit: "Artists, dancers, creators, fans" },
    { name: "Crews & Groups", description: "Build or join a crew/group, manage members, post privately to your tribe.", audienceFit: "Dancers, MCs, graffiti crews, communities" },
    { name: "Cyphers & Battles", description: "Schedule and join real-life cyphers, battles, jams; see who's coming.", audienceFit: "Breakers, MCs, freestylers" },
    { name: "Events & Programme", description: "Find and host events: jams, exhibitions, workshops, parties.", audienceFit: "Everyone" },
    { name: "Beat Lab & Radio", description: "Share beats and mixes; live community radio with track logging.", audienceFit: "DJs, producers, beatmakers, listeners" },
    { name: "Graffiti Wall", description: "Tag spots on the map, share photos of your work, build a portfolio.", audienceFit: "Graffiti writers, street artists" },
    { name: "Hall of Fame", description: "Tribute to legends of the urban scene — local heroes you should know.", audienceFit: "Culture nerds, history lovers" },
    { name: "Challenges", description: "Compete in skill-based challenges, vote, win recognition.", audienceFit: "Active creators" },
    { name: "Street Cred", description: "Earn points and rank up by being active and contributing.", audienceFit: "Gamification fans" },
    { name: "AI Culture Tools", description: "Find collab matches, decode your style DNA, sync videos to beats, generate freestyles — all AI-powered.", audienceFit: "Modern creators" },
    { name: "Marketplace & Bookings", description: "Book services, sell merch, list workshops.", audienceFit: "Pros, fans" },
  ],
  uniqueValue: "There's no single app where you can find a hidden mural, the best ramen spot, an underground cypher tonight, the local breaking crew, and a Saturday workshop — all in one place. Instagram fragments it; Google Maps lacks the culture. Urban Culture Hub is purpose-built for the scene, by the scene.",
  audiencePersonas: [
    { name: "City explorer (16-35)", description: "Tourists & locals hunting for non-touristy things to do. Loves street art, music venues, hidden eats.", painPoints: ["Generic guides are boring", "Doesn't speak local scene language", "Wants real spots, not corporate ones"], motivators: ["Discover hidden gems", "Feel local", "Have an Instagram-worthy day"] },
    { name: "Urban creator (16-30)", description: "Dancer/MC/DJ/writer building a name. Wants community, gigs, visibility.", painPoints: ["Hard to find your tribe", "Events are scattered across IG groups", "No central place for the scene"], motivators: ["Get seen", "Battle/collab", "Build crew, build cred"] },
    { name: "Culture enthusiast (25-45)", description: "Loves museums, indie food, music, design — the cultured side of cities.", painPoints: ["Tired of mainstream apps", "Wants curated, not algorithmic"], motivators: ["Quality discoveries", "Support indie scenes"] },
  ],
  brandVoice: "Authentic, street-smart, warm, never corporate. Like a knowledgeable local friend showing you around. Use plain language, real names of places, real lingo where natural. No emojis in formal copy unless it fits the platform (TikTok yes, LinkedIn no). Keep it inclusive — we welcome anyone who loves urban culture, not just hardcore artists.",
  doSay: ["spots", "scene", "community", "discover", "real", "local", "your tribe", "underground", "vibe", "curated", "by the scene for the scene"],
  dontSay: ["disrupt", "platform", "users", "leverage", "ecosystem", "synergy", "Web3", "cringe", "lit (overused)", "for the boys"],
  competitors: "Instagram (too noisy/algorithmic), Google Maps (no culture), Meetup (boring/corporate), Eventbrite (just events), TripAdvisor (touristy). We sit at the intersection none of them cover.",
  geographicFocus: "Netherlands first (Amsterdam, Rotterdam, Den Haag, Utrecht, Eindhoven), then Belgium, Germany, France. Long-term: every European city.",
  languages: ["en", "nl"],
  exampleWinningCopy: "Stop scrolling Google for 'cool things to do.' Real locals already mapped Amsterdam — every mural, ramen joint, hidden record store, and Saturday cypher. Free app, by the scene, for the scene.",
};

async function ensureContext() {
  const existing = await db.select().from(marketingContext).limit(1);
  if (existing.length) return existing[0];
  const [row] = await db.insert(marketingContext).values(DEFAULT_CONTEXT as any).returning();
  return row;
}

export function loadMarketingContext() { return ensureContext(); }

export function registerMarketingContextRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: any) => void,
) {
  app.get("/api/admin/ads/context", requireAdmin, async (_req, res) => {
    const row = await ensureContext();
    res.json(row);
  });

  app.patch("/api/admin/ads/context", requireAdmin, async (req: Request, res: Response) => {
    const row = await ensureContext();
    const userId = (req as any).user?.id;
    const patch: any = { ...req.body, updatedAt: new Date(), updatedBy: userId ?? null };
    delete patch.id;
    delete patch.createdAt;
    const [updated] = await db.update(marketingContext)
      .set(patch).where(eq(marketingContext.id, row.id)).returning();
    res.json(updated);
  });

  app.post("/api/admin/ads/context/reset", requireAdmin, async (_req, res) => {
    const row = await ensureContext();
    const [updated] = await db.update(marketingContext)
      .set({ ...DEFAULT_CONTEXT as any, updatedAt: new Date() })
      .where(eq(marketingContext.id, row.id)).returning();
    res.json(updated);
  });
}
