/**
 * LinkedIn Platform Brain — deep, live, and varied knowledge of Urban Culture Hub.
 *
 * This module is the AI's "what does the platform actually do" memory.
 * It feeds every LinkedIn AI prompt (auto-post, AI Writer, Agent Mode) with:
 *
 *   1. LIVE COUNTS    — real-time numbers from the DB (spots, events, venues, users, crews)
 *   2. FEATURE GRAPH  — every major feature: what it is, how it works, who uses it,
 *                       and which other features it connects to
 *   3. POST ANGLES    — 30+ pre-defined story angles so the AI varies its topics
 *                       (map / AI Finder / culture / municipalities / artists / etc.)
 *   4. RECENT ACTIVITY— sampled live: real upcoming event names + venue names so the
 *                       AI can mention what's actually happening on the platform now
 *   5. ANGLE ROTATION — picks an angle this admin hasn't used in the last N posts
 *                       so daily content stays fresh and varied
 *
 * HOW TO ADD A NEW FEATURE:
 *   - Append an entry to FEATURE_GRAPH below (name, description, howItWorks,
 *     whoUsesIt, connectsTo, postAngles).
 *   - It will automatically appear in every LinkedIn AI prompt within 10 minutes
 *     (cache TTL) — no other code changes needed.
 *
 * Cached in-process for 10 minutes so we don't hammer the DB.
 */

import { db } from "./db";
import { events, locations, users, crews, linkedinPosts } from "../shared/schema";
import { sql, eq, desc, gte } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

// ──────────────────────────────────────────────────────────────────────────
// FEATURE KNOWLEDGE GRAPH — the AI's structured understanding of the platform
// ──────────────────────────────────────────────────────────────────────────
export interface PlatformFeature {
  id: string;
  name: string;
  description: string;     // 1-2 sentences: what it is
  howItWorks: string[];    // 3-6 concrete steps / mechanics
  whoUsesIt: string[];     // target users / roles
  connectsTo: string[];    // ids of other features this hooks into
  postAngles: string[];    // 3-6 specific LinkedIn post ideas
}

const FEATURE_GRAPH: PlatformFeature[] = [
  {
    id: "map",
    name: "Interactive Map of Urban Spots",
    description:
      "A live map of 38,000+ urban culture and sport spots across the Netherlands — graffiti walls, skate parks, dance studios, basketball courts, parkour zones, calisthenics parks, beatbox/cypher hotspots, climbing walls, and more.",
    howItWorks: [
      "Spots are aggregated from OpenStreetMap, community submissions, and admin curation",
      "Anyone can browse the map; filter by sport, culture type, distance, or amenity",
      "A user can request access/ownership of a spot (claim a venue or studio they run)",
      "An admin reviews the request and approves or rejects it",
      "Once approved, the user becomes the spot owner — they can edit info, upload photos, and add a schedule",
      "If the schedule is enabled, the public can book classes / sessions / time-slots through the spot",
    ],
    whoUsesIt: ["athletes", "artists", "coaches", "students", "tourists", "venue owners", "spot owners"],
    connectsTo: ["ai_finder", "schedules", "bookings", "spot_owner", "community", "admin_approval"],
    postAngles: [
      "We mapped 38,000+ urban spots across the Netherlands — anyone can claim and manage their own",
      "From OpenStreetMap to community-submitted: how a spot lands on the map and becomes bookable",
      "The hidden infrastructure of urban Netherlands — courts, walls, studios, parks — finally in one place",
      "Spot owners turn a dot on a map into a real bookable schedule in 3 minutes",
    ],
  },
  {
    id: "ai_finder",
    name: "AI Spot Finder",
    description:
      "Describe what you want in natural language — the AI returns the best matching spots near you, ranked by relevance, distance, and admin-promoted picks.",
    howItWorks: [
      "User types a request like 'open-air dance floor in Amsterdam after 8 PM'",
      "AI parses intent (sport, vibe, time, location, indoor/outdoor)",
      "Cross-references the live map of 38,000+ spots + venue schedules + community ratings",
      "Returns a curated shortlist with reasoning ('matches because…')",
      "Admins can promote specific spots to surface first in AI Finder results",
    ],
    whoUsesIt: ["new users", "visitors to a city", "anyone who doesn't know where to go", "tourists"],
    connectsTo: ["map", "ai_culture", "schedules", "events"],
    postAngles: [
      "Tell the AI what you want — it finds the spot. No more endless scrolling on Maps",
      "How natural-language search beats filters for finding a place to train/dance/skate",
      "AI Finder turns 38,000 spots into one perfect recommendation",
      "Why we built AI search before the rest of the app — discovery is the bottleneck",
    ],
  },
  {
    id: "schedules",
    name: "Venue & Spot Schedules",
    description:
      "Spot owners and venues publish a weekly/recurring schedule of classes, sessions, training slots, and open hours — visible to the public.",
    howItWorks: [
      "After admin-approved access, the spot owner opens their dashboard",
      "Adds recurring slots (e.g. 'Hip-hop class every Tuesday 19:00') with capacity & price",
      "The schedule appears on the spot's public page and on the map",
      "Bookable slots wire into the booking + payment flow",
    ],
    whoUsesIt: ["venue owners", "studios", "coaches", "freelance artists who teach"],
    connectsTo: ["map", "bookings", "spot_owner", "marketplace"],
    postAngles: [
      "From idle space to filled schedule — what happens when a venue plugs into Urban Culture Hub",
      "We made class scheduling so simple, dance studios actually use it",
      "One schedule, shown on the map, found by AI Finder, bookable in 2 taps",
    ],
  },
  {
    id: "bookings",
    name: "Booking & Reservation System",
    description:
      "Users discover a spot or class, reserve a slot, pay if needed (Stripe), get a QR ticket, and check in on arrival.",
    howItWorks: [
      "User picks a slot from a venue's schedule or an event listing",
      "Pays via Stripe (or marks free RSVP)",
      "Receives a QR ticket in-app and by email",
      "Venue staff scan the QR at the door for check-in",
      "All bookings appear in the user's profile and the venue's dashboard",
    ],
    whoUsesIt: ["everyone who shows up", "venues that want filled rooms"],
    connectsTo: ["schedules", "events", "back_to_the_street", "marketplace"],
    postAngles: [
      "Booking, payment, ticket, check-in — one flow, in one app",
      "Why we built our own booking layer instead of integrating yet another tool",
      "The QR-ticket moment: 38,000 spots become 38,000 doors you can actually walk through",
    ],
  },
  {
    id: "events",
    name: "Events & Ticketing",
    description:
      "Curated calendar of urban culture, sport, music, and lifestyle events across the Netherlands — with phase-based pricing and live tickets.",
    howItWorks: [
      "Events come from Ticketmaster sync, Eventbrite imports, and direct organizer submissions",
      "Each event has phase-based pricing (Early Bird → Regular → Late → At-Door)",
      "Stripe-powered checkout with QR tickets and on-site scanning",
      "Featured events get spotlight placement on the home feed",
      "Organizers see live attendance & revenue dashboards",
    ],
    whoUsesIt: ["event-goers", "organizers", "promoters", "festival makers", "municipalities"],
    connectsTo: ["bookings", "back_to_the_street", "ai_finder", "community", "marketplace"],
    postAngles: [
      "1,000+ events on tap — curated, ticketed, and findable by AI",
      "Phase-based pricing isn't gimmick — it's how organizers actually price events. We built it native",
      "Why we synced with Ticketmaster + Eventbrite + manual curation — coverage matters",
    ],
  },
  {
    id: "back_to_the_street",
    name: "Back to the Street (BTTS)",
    description:
      "Full battle-event management module built for the breakdancing & street culture community — phase-based pricing, live brackets, judge dashboards, video review.",
    howItWorks: [
      "Organizers spin up a battle: 1v1 / 2v2 / 3v3 / crews, knockout or round-robin",
      "Open registrations with tiered pricing phases",
      "Judges get a dedicated panel during the event with scoring & video review",
      "Brackets update live; spectators follow on the public event page",
      "Built-in AI Event Assistant helps with hype copy and announcements",
    ],
    whoUsesIt: ["bboys/bgirls", "battle organizers", "judges", "crews", "spectators"],
    connectsTo: ["events", "community", "crews", "culture_hub"],
    postAngles: [
      "I organized BTTS for years on spreadsheets. Now the tooling is in the app",
      "Live brackets, judge panels, phase pricing — battles run themselves",
      "Building tools for the breaking community as a former pro — what I always wished existed",
    ],
  },
  {
    id: "community",
    name: "Community Feed & Social Layer",
    description:
      "Posts, Stories, TikTok-style Reels, real-time chat (with E2E indication), WebRTC voice/video calls, group chats, follow/follower system — the city's social layer for urban culture.",
    howItWorks: [
      "Users post text/photo/video; reels get a vertical feed",
      "Real-time chat over WebSocket with read receipts and typing indicators",
      "WebRTC for 1:1 voice + video calls",
      "Follow people, crews, venues; notifications on activity",
      "Reactions, comments, share-to-Story",
    ],
    whoUsesIt: ["everyone", "creators", "crews", "venue managers"],
    connectsTo: ["culture_hub", "crews", "events", "profiles", "marketplace"],
    postAngles: [
      "Why we built our own social layer instead of just deep-linking to Instagram",
      "Reels for the urban scene — content that doesn't get buried by an algorithm built for cat videos",
      "Real-time chat + WebRTC calls: the app is the meeting place",
    ],
  },
  {
    id: "culture_hub",
    name: "Culture Hub",
    description:
      "A nine-feature set built for urban creatives: Street Cred (XP), Crews, Cyphers, Freestyle Challenges, Graffiti Wall, Beat Lab & Radio, Hall of Fame, Style Match, Style DNA, Sync to Beat.",
    howItWorks: [
      "Street Cred awards XP for activity (post, attend, win, mentor)",
      "Crews are discipline-based groups with their own feed and rep",
      "Cyphers: geolocation-based open sessions — see who's training where right now",
      "Freestyle Challenges: AI-themed video prompts; community votes",
      "Graffiti Wall: collaborative digital canvas",
      "Beat Lab + Radio: share tracks, run a community station",
      "Style Match: AI matches creatives for collabs",
      "Style DNA: AI-generated personal style profile",
      "Sync to Beat: in-app video editing tool",
    ],
    whoUsesIt: ["dancers", "rappers", "writers", "DJs", "producers", "creatives", "crews"],
    connectsTo: ["community", "crews", "ai_culture", "events"],
    postAngles: [
      "Nine features, one Culture Hub — built for the people who make the culture",
      "Cypher Finder: see who's training where, right now",
      "Style DNA — what happens when AI describes your creative identity back to you",
      "Why I built Beat Lab inside the app — community needs production tools, not just a feed",
    ],
  },
  {
    id: "ai_culture",
    name: "AI Culture (Creative Studio + In-App Assistant)",
    description:
      "AI tools embedded across the platform: Creative Studio for admins (image, copy, video prompts), in-app assistant for users (recommendations, content help), and contextual AI widgets on every major screen.",
    howItWorks: [
      "Claude Opus + GPT Image 1 power most generation flows",
      "Creative Studio: admins generate posts, images, ad creatives in seconds",
      "User assistant: 'find me a cypher tonight in Rotterdam' → real spots + people",
      "Contextual AI: smart prompts on event pages, profile pages, listing flows",
      "AI is the connective tissue — it speaks the language of the platform's data",
    ],
    whoUsesIt: ["admins", "creators", "users who want help"],
    connectsTo: ["ai_finder", "marketplace", "events", "culture_hub"],
    postAngles: [
      "AI isn't a sticker on the side — it's wired into every flow",
      "How AI Creative Studio cuts a marketing campaign from days to minutes",
      "We trained the assistant on the platform's own data, not the open web — that's the difference",
    ],
  },
  {
    id: "marketplace",
    name: "Marketplace (Gear + Services)",
    description:
      "Two-sided marketplace: secondhand & new urban gear (sneakers, decks, paint, music gear) and creative services (DJ, dancer, photographer, coach bookings) — both with AI-assisted listing wizards.",
    howItWorks: [
      "5-step AI-assisted listing wizard: AI writes the title, description, tags, suggests price",
      "Stripe-powered transactions with escrow-style protection on services",
      "Reviews + ratings on both sides",
      "Service providers manage their availability, link to schedules",
      "Featured listings can be promoted by admins",
    ],
    whoUsesIt: ["sellers", "buyers", "service providers", "freelancers", "small brands"],
    connectsTo: ["schedules", "bookings", "profiles", "ai_culture"],
    postAngles: [
      "AI-assisted listings: snap a photo, the wizard writes the rest",
      "Marketplace + services in one app — gear and the people behind it, side by side",
      "Why a culture-native marketplace beats a generic one — context turns into conversion",
    ],
  },
  {
    id: "spot_owner",
    name: "Spot Owner & Venue Tools",
    description:
      "Dedicated dashboard for venue owners and spot managers — claim a spot, manage info & photos, publish a schedule, see bookings, message customers.",
    howItWorks: [
      "Request ownership of a mapped spot (or submit a new one)",
      "Admin approves and grants the spot-owner role",
      "Owner edits the public spot page, uploads media, adds amenities",
      "Publishes a schedule (classes, sessions, private hire)",
      "Sees bookings, no-shows, revenue in a dashboard",
      "Direct chat with customers via the in-app chat",
    ],
    whoUsesIt: ["venue owners", "studio managers", "spot caretakers"],
    connectsTo: ["map", "schedules", "bookings", "admin_approval"],
    postAngles: [
      "From 'we have a studio' to 'we have a booked schedule' in one onboarding flow",
      "What changes for a venue owner the day after they get approved on Urban Culture Hub",
      "We built venue tools as a first-class product — not an afterthought",
    ],
  },
  {
    id: "profiles",
    name: "Profiles (Athletes, Artists, Crews, Venues)",
    description:
      "Multi-role profiles with customizable themes — athletes, artists, crews, venues, municipalities each have a profile shaped to what they do.",
    howItWorks: [
      "Pick role(s) on signup (you can be more than one)",
      "Each role unlocks specific fields and tools",
      "Customizable visual themes (colors, banner, layout)",
      "Verification badges for known venues, sponsored creators, city accounts",
      "Public discovery: anyone can find athletes/artists/venues by city + discipline",
    ],
    whoUsesIt: ["everyone — every user has a profile"],
    connectsTo: ["community", "marketplace", "crews", "culture_hub"],
    postAngles: [
      "Why role-based profiles beat 'one shape fits all' — your profile reflects what you actually do",
      "Verification + customizable themes — venues and creators stand out without leaving the app",
    ],
  },
  {
    id: "crews",
    name: "Crews & Groups",
    description:
      "Discipline-based groups with their own feed, members, events, and reputation score — the team layer of the platform.",
    howItWorks: [
      "Create or join a crew (open or invite-only)",
      "Crew has its own feed, chat, member list, and rep stats",
      "Crews can host events, run challenges, post collabs",
      "Crew leaderboards on the Hall of Fame",
      "Linked to BTTS battles for crew vs crew formats",
    ],
    whoUsesIt: ["dancers", "athletes", "music collectives", "skate crews", "writer crews"],
    connectsTo: ["culture_hub", "community", "back_to_the_street", "events"],
    postAngles: [
      "The crew is the unit — built features around how the scene actually organizes itself",
      "Crew leaderboards turn community into healthy competition",
    ],
  },
  {
    id: "artists",
    name: "Artist & Creator Layer",
    description:
      "First-class tools for performers, dancers, DJs, visual artists, and creators — bookable services, portfolio, performance history, fan following.",
    howItWorks: [
      "Artist profile with portfolio (video, audio, image)",
      "Bookable services (gigs, lessons, collabs)",
      "Performance history pulled from events they appeared at",
      "Followers see new posts, new gigs, new merch in their feed",
      "Style Match (Culture Hub) suggests collab partners based on style DNA",
    ],
    whoUsesIt: ["dancers", "DJs", "rappers", "visual artists", "producers", "performers"],
    connectsTo: ["marketplace", "events", "culture_hub", "profiles", "venues"],
    postAngles: [
      "Built artist tools first — without artists there's no culture to host",
      "Portfolio + bookings + collabs + fans — the full artist OS in one app",
      "How Style Match pairs creators who would never meet otherwise",
    ],
  },
  {
    id: "venues",
    name: "Venues & Spaces",
    description:
      "Public-facing venue listings with photos, schedules, capacity, amenities, reviews — discoverable by users, AI Finder, and event organizers.",
    howItWorks: [
      "Verified venue pages with rich media",
      "Live schedule + bookings",
      "Reviews & ratings from real bookings",
      "Linked to events hosted there",
      "Discoverable on the map and via AI Finder",
    ],
    whoUsesIt: ["venue owners", "users browsing", "event organizers searching for spaces"],
    connectsTo: ["map", "schedules", "bookings", "events", "spot_owner"],
    postAngles: [
      "A venue page that does work — booked classes, sold tickets, real reviews",
      "Why we treat venues as products, not just listings",
    ],
  },
  {
    id: "municipalities",
    name: "Municipalities & Public Sector",
    description:
      "Tools and dashboards built for cities, councils, and public-sector partners — talent discovery, youth program reach, cultural event organization, real-time activity heatmaps.",
    howItWorks: [
      "City accounts get a verified municipality profile",
      "Heatmap dashboard shows where urban culture is alive in their city",
      "Can publish public events and youth programs directly to the platform",
      "Reach a young, active demographic that's hard to engage via traditional channels",
      "Co-branded landing pages for city programs",
    ],
    whoUsesIt: ["aldermen", "civil servants", "cultural program managers", "youth workers"],
    connectsTo: ["events", "map", "community", "admin_approval"],
    postAngles: [
      "The first heatmap of urban culture activity per city — built for municipalities",
      "How a city reaches its young people: not through press releases. Through the app they actually use",
      "Talent discovery for public-sector cultural programs — finally indexable",
    ],
  },
  {
    id: "admin_tools",
    name: "Admin Suite",
    description:
      "Multi-admin platform control: spot/event/venue moderation, user role management, AI Creative Studio, security & privacy scanner, LinkedIn brain & auto-poster, Instagram automation, email + SMS broadcasts.",
    howItWorks: [
      "Each admin has scoped permissions (super admin vs. admin)",
      "Approve/reject spot ownership requests, venue claims, event submissions",
      "Run security scans across 9 categories (Claude-synthesized reports)",
      "Train the LinkedIn AI brain (voice rules, brand story, examples)",
      "Auto-post to LinkedIn daily — with optional approval queue",
      "Broadcast email + SMS to user segments",
    ],
    whoUsesIt: ["platform admins", "founders", "ops team"],
    connectsTo: ["ai_culture", "spot_owner", "events", "community"],
    postAngles: [
      "Building the admin suite the same way I'd want to use it as a founder",
      "What 'AI-powered admin' actually means — every moderator action backed by AI suggestions",
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// POST ANGLE LIBRARY — flat list of every post angle, tagged by feature
// Used for rotation: pick an angle this admin hasn't used recently.
// ──────────────────────────────────────────────────────────────────────────
export interface PostAngle {
  featureId: string;
  featureName: string;
  angle: string;
}

const ANGLE_LIBRARY: PostAngle[] = FEATURE_GRAPH.flatMap((f) =>
  f.postAngles.map((angle) => ({ featureId: f.id, featureName: f.name, angle })),
);

// ──────────────────────────────────────────────────────────────────────────
// TYPES & CACHE
// ──────────────────────────────────────────────────────────────────────────
export interface PlatformFacts {
  spotsCount: number;
  eventsCount: number;
  upcomingEventsCount: number;
  venuesCount: number;
  usersCount: number;
  crewsCount: number;
  features: PlatformFeature[];
  recentEventNames: string[];   // 5 newest events — concrete material for posts
  recentVenueNames: string[];   // 5 most recently active venues
  generatedAt: number;
}

let cached: PlatformFacts | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

// ── Spots count (refreshed every cache cycle so growth is reflected) ──
// Sources, in priority order:
//   1. cityspots table count (the authoritative DB-backed count, if present)
//   2. server/data/city_spots_cache.json file length (the OSM-cached snapshot)
//   3. fallback: 38000
async function loadSpotsCount(): Promise<number> {
  // 1. authoritative DB count
  try {
    const r: any = await db.execute(sql`SELECT count(*)::int AS c FROM cityspots`);
    const c = Number((r?.rows?.[0] ?? r?.[0])?.c) || 0;
    if (c > 0) return c;
  } catch { /* table may not exist or be named differently */ }

  // 2. on-disk OSM cache file
  const candidates = [
    path.join(process.cwd(), "server/data/city_spots_cache.json"),
    path.join(process.cwd(), "data/city_spots_cache.json"),
    "/tmp/city_spots_cache.json",
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : parsed?.spots;
      if (Array.isArray(arr) && arr.length > 0) return arr.length;
    } catch { /* try next */ }
  }

  // 3. fallback
  return 38000;
}

// ──────────────────────────────────────────────────────────────────────────
// LIVE FACTS — DB queries, parallel, with safe fallbacks
// ──────────────────────────────────────────────────────────────────────────
export async function getPlatformFacts(forceRefresh = false): Promise<PlatformFacts> {
  if (!forceRefresh && cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }
  const now = new Date();

  const [
    spotsCount,
    eventsRow, upcomingRow, venuesRow, usersRow, crewsRow,
    recentEvents, recentVenues,
  ] = await Promise.all([
    loadSpotsCount().catch(() => cached?.spotsCount || 38000),
    db.select({ c: sql<number>`count(*)::int` }).from(events).then(r => r[0]).catch(() => ({ c: cached?.eventsCount || 0 })),
    db.select({ c: sql<number>`count(*)::int` }).from(events).where(sql`${events.date} >= ${now}`).then(r => r[0]).catch(() => ({ c: cached?.upcomingEventsCount || 0 })),
    db.select({ c: sql<number>`count(*)::int` }).from(locations).then(r => r[0]).catch(() => ({ c: cached?.venuesCount || 0 })),
    db.select({ c: sql<number>`count(*)::int` }).from(users).then(r => r[0]).catch(() => ({ c: cached?.usersCount || 0 })),
    db.select({ c: sql<number>`count(*)::int` }).from(crews).then(r => r[0]).catch(() => ({ c: cached?.crewsCount || 0 })),
    db.select({ title: events.title }).from(events).where(sql`${events.date} >= ${now}`).orderBy(events.date).limit(5).catch(() => []),
    db.select({ name: locations.name }).from(locations).orderBy(desc(locations.id)).limit(5).catch(() => []),
  ]);

  cached = {
    spotsCount,
    eventsCount: Number(eventsRow.c) || 0,
    upcomingEventsCount: Number(upcomingRow.c) || 0,
    venuesCount: Number(venuesRow.c) || 0,
    usersCount: Number(usersRow.c) || 0,
    crewsCount: Number(crewsRow.c) || 0,
    features: FEATURE_GRAPH,
    recentEventNames: (recentEvents || []).map((e: any) => e.title).filter(Boolean).slice(0, 5),
    recentVenueNames: (recentVenues || []).map((v: any) => v.name).filter(Boolean).slice(0, 5),
    generatedAt: Date.now(),
  };
  cachedAt = Date.now();
  return cached;
}

// ──────────────────────────────────────────────────────────────────────────
// FORMAT helpers
// ──────────────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)},000+`;
  if (n >= 1000) return `${(Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, "")}k+`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`;
  return String(n);
}

// ──────────────────────────────────────────────────────────────────────────
// ANGLE ROTATION — pick a post angle this admin hasn't used in their last N posts
// Looks at the postType + content of recent linkedinPosts to avoid repetition.
// ──────────────────────────────────────────────────────────────────────────
export async function pickRotatingAngle(adminUserId: number, lookbackPosts = 8): Promise<PostAngle> {
  let recentFeatureIds: Set<string> = new Set();
  try {
    // Use the explicit feature_id tag set at generation time. We only count
    // posts that were actually published or are awaiting approval — drafts /
    // rejects / failures shouldn't poison rotation.
    const recent = await db.select({
      featureId: linkedinPosts.featureId,
      content: linkedinPosts.content,
    })
      .from(linkedinPosts)
      .where(sql`${linkedinPosts.adminUserId} = ${adminUserId} AND ${linkedinPosts.status} IN ('published', 'publishing', 'pending_approval')`)
      .orderBy(desc(linkedinPosts.id))
      .limit(lookbackPosts);

    for (const r of recent) {
      // Primary source of truth: explicit featureId column
      if (r.featureId) {
        recentFeatureIds.add(r.featureId);
        continue;
      }
      // Fallback for older posts written before tagging existed: use a stricter
      // word-boundary substring match on the feature's full name only (the loose
      // id-based match was too greedy — words like "map" hit too often).
      const lower = (r.content || "").toLowerCase();
      for (const f of FEATURE_GRAPH) {
        const name = f.name.toLowerCase();
        // require the full feature name to appear, not just a partial token
        if (name.length >= 8 && lower.includes(name)) {
          recentFeatureIds.add(f.id);
        }
      }
    }
  } catch {
    /* best-effort — if it fails, we just don't filter */
  }

  // Prefer angles whose feature hasn't been touched recently
  const fresh = ANGLE_LIBRARY.filter((a) => !recentFeatureIds.has(a.featureId));
  const pool = fresh.length > 0 ? fresh : ANGLE_LIBRARY;
  // Random pick from the freshest pool
  return pool[Math.floor(Math.random() * pool.length)];
}

// ──────────────────────────────────────────────────────────────────────────
// PROMPT BLOCK — injected into every LinkedIn AI generation
//
// Returns BOTH the prompt text AND the suggested featureId, so callers can:
//   - inject the text into the AI prompt
//   - tag the resulting linkedin_posts row with the chosen featureId for rotation
//
// Backwards-compat note: the returned object has a custom toString() that yields
// the prompt text, so older callers using string concatenation still work.
// ──────────────────────────────────────────────────────────────────────────
export interface FactsBlock {
  text: string;
  suggestedFeatureId: string | null;
  toString(): string;
}

export async function buildFactsBlock(opts?: { adminUserId?: number; suggestAngle?: boolean }): Promise<FactsBlock> {
  const f = await getPlatformFacts();

  // Pick a rotating angle (only when an admin context is available)
  let angleBlock = "";
  let suggestedFeatureId: string | null = null;
  if (opts?.adminUserId && opts?.suggestAngle !== false) {
    try {
      const angle = await pickRotatingAngle(opts.adminUserId);
      suggestedFeatureId = angle.featureId;
      angleBlock = `

═══════════════ TODAY'S SUGGESTED ANGLE (rotate topics — don't repeat last week's) ═══════════════
FEATURE TO HIGHLIGHT: ${angle.featureName}
SUGGESTED ANGLE: "${angle.angle}"
(You can deviate, but the post should focus on a *different* feature than the last 5 posts.)
══════════════════════════════════════════════════════════════════════════════════════════════════`;
    } catch { /* best-effort */ }
  }

  // Compress the feature graph for the prompt — name + 1-line description + how-it-works summary
  const featureLines = f.features.map((feat) => {
    const how = feat.howItWorks.slice(0, 3).join("; ");
    const connects = feat.connectsTo.length ? ` → connects to: ${feat.connectsTo.join(", ")}` : "";
    return `• ${feat.name}: ${feat.description}
  HOW: ${how}${connects}
  USED BY: ${feat.whoUsesIt.join(", ")}`;
  }).join("\n\n");

  const recentEventsLine = f.recentEventNames.length
    ? `📅 RECENT/UPCOMING EVENTS (real titles you can mention): ${f.recentEventNames.map(t => `"${t}"`).join(", ")}`
    : "";
  const recentVenuesLine = f.recentVenueNames.length
    ? `🏛 RECENTLY ACTIVE VENUES (real names you can mention): ${f.recentVenueNames.map(v => `"${v}"`).join(", ")}`
    : "";

  const text = `
═══════════════ LIVE PLATFORM FACTS (use these — never invent numbers) ═══════════════
URBAN CULTURE HUB — current real numbers, pulled live from the platform:

📍 SPOTS ON THE MAP:    ${fmt(f.spotsCount)} mapped urban culture & sport spots across the Netherlands
📅 EVENTS:              ${fmt(f.eventsCount)} events in the database (${fmt(f.upcomingEventsCount)} upcoming)
🏛  VENUES:              ${fmt(f.venuesCount)} curated venues with bookings
👥 USERS:               ${fmt(f.usersCount)} registered members
🤝 CREWS:               ${fmt(f.crewsCount)} active crews / groups
${recentEventsLine}
${recentVenuesLine}

═══════════════ PLATFORM FEATURE GRAPH (deep knowledge — use to vary topics) ═══════════════
The platform isn't one thing — it's a connected system. Each post should pick ONE angle and go deep.

${featureLines}
${angleBlock}

WEBSITES & APPS:
- Web: urbanculturehub.nl
- iOS app: available on the App Store

STRICT RULES (non-negotiable):
- NEVER invent numbers. Use ONLY the live counts above (e.g. "${fmt(f.spotsCount)} spots", not "500 spots").
- NEVER invent features. Use ONLY the feature graph above.
- VARY THE TOPIC — each post should highlight a DIFFERENT feature than the last 5 posts.
  The "Today's Suggested Angle" above tells you which feature is fresh — start there unless you have a strong reason not to.
- When you mention a feature, show you understand HOW it works (use the HOW line) and WHO uses it.
- When relevant, mention real upcoming events or venues from the lists above for concreteness.
- If unsure about a fact, say "the platform" generically rather than guessing.
═════════════════════════════════════════════════════════════════════════════════════════════
`;

  return {
    text,
    suggestedFeatureId,
    toString() { return text; },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// UI READ — for the Brain tab's Live Platform Facts panel
// Returns:
//   - stats[]    : compact list for the small stat-card grid
//   - features[] : the full feature graph (for the "What the AI knows" panel)
//   - recents    : recent event + venue names the AI can mention
//   - meta       : counts of features + post angles in the brain
// ──────────────────────────────────────────────────────────────────────────
export async function getPlatformFactsForDisplay() {
  const f = await getPlatformFacts();
  const stats = [
    { label: "Spots", value: fmt(f.spotsCount), detail: "on the map" },
    { label: "Events", value: fmt(f.eventsCount), detail: `${fmt(f.upcomingEventsCount)} upcoming` },
    { label: "Venues", value: fmt(f.venuesCount), detail: "with bookings" },
    { label: "Users", value: fmt(f.usersCount), detail: "registered" },
    { label: "Crews", value: fmt(f.crewsCount), detail: "active groups" },
    { label: "Features", value: String(FEATURE_GRAPH.length), detail: "in AI brain" },
    { label: "Post Angles", value: String(ANGLE_LIBRARY.length), detail: "for variety" },
  ];
  // Build an id→name lookup so we can resolve connectsTo IDs to human-readable names
  const idToName = new Map<string, string>(f.features.map((x) => [x.id, x.name]));
  return {
    stats,
    features: f.features.map((feat) => ({
      id: feat.id,
      name: feat.name,
      description: feat.description,
      whoUsesIt: feat.whoUsesIt,
      connectsTo: feat.connectsTo.map((cid) => idToName.get(cid) || cid),
      anglesCount: feat.postAngles.length,
    })),
    recents: {
      events: f.recentEventNames,
      venues: f.recentVenueNames,
    },
    formatted: {
      spots: fmt(f.spotsCount),
      events: fmt(f.eventsCount),
      upcomingEvents: fmt(f.upcomingEventsCount),
      venues: fmt(f.venuesCount),
      users: fmt(f.usersCount),
      crews: fmt(f.crewsCount),
    },
    meta: {
      featureCount: FEATURE_GRAPH.length,
      angleLibrarySize: ANGLE_LIBRARY.length,
    },
    lastUpdated: f.generatedAt,
  };
}

// Exported for debugging / admin UI
export { FEATURE_GRAPH, ANGLE_LIBRARY };
