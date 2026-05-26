/**
 * Eventbrite API v3 Integration
 * Fetches real events from Eventbrite for the Netherlands
 * Requires EVENTBRITE_API_KEY secret in environment
 *
 * To set up: Add EVENTBRITE_API_KEY to your secrets
 * Get your key at: https://www.eventbrite.com/platform/api-keys
 */

import { db } from "./db";
import { events } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const EVENTBRITE_BASE = "https://www.eventbriteapi.com/v3";
const getToken = () =>
  process.env.EVENTBRITE_PRIVATE_TOKEN ||
  process.env.EVENTBRITE_API_KEY ||
  process.env.EVENTBRITE_TOKEN;

// ── Category mappings ─────────────────────────────────────────────────────────
// Eventbrite category IDs → our category + musicGenre
const EB_CATEGORY_MAP: Record<string, { category: string; musicGenre?: string }> = {
  "103": { category: "music" },           // Music (broad)
  "105": { category: "art" },             // Performing & Visual Arts
  "108": { category: "sports" },          // Sports & Fitness
  "110": { category: "food" },            // Food & Drink
  "113": { category: "community" },       // Community & Culture
  "115": { category: "workshop" },        // Science & Tech → workshop
  "119": { category: "cultural" },        // Hobbies → cultural
  "199": { category: "festival" },        // Other (default)
};

// Eventbrite subcategory IDs → musicGenre
const EB_SUBCATEGORY_GENRE: Record<string, string> = {
  "1001": "classical",
  "1002": "folk",
  "1003": "world",
  "1005": "hiphop",
  "1006": "jazz",
  "1007": "latin",
  "1008": "electronic",
  "1009": "reggae",
  "1010": "latin",
  "1011": "pop",
  "1012": "rnb",
  "1013": "rock",
  "1014": "rock",
  "1015": "folk",
  "1016": "pop",
  "1017": "world",
  "3001": "afrobeats",
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface EventbriteSyncResult {
  synced: number;
  skipped: number;
  errors: string[];
  isConfigured: boolean;
  message: string;
}

interface EBEvent {
  id: string;
  name: { text: string };
  description: { text: string };
  start: { local: string; utc: string };
  end: { local: string; utc: string };
  url: string;
  is_free: boolean;
  status: string;
  listed: boolean;
  category_id: string;
  subcategory_id: string;
  logo?: { url: string; original?: { url: string } };
  venue?: {
    name: string;
    address: { localized_address_display: string; city: string };
    latitude?: string;
    longitude?: string;
  };
  ticket_availability?: {
    minimum_ticket_price?: { major_value: string };
    maximum_ticket_price?: { major_value: string };
    is_sold_out: boolean;
  };
}

// ── Verify token by calling /users/me/ ────────────────────────────────────────
export async function verifyEventbriteToken(): Promise<{ valid: boolean; name?: string; id?: string }> {
  const token = getToken();
  if (!token) return { valid: false };
  try {
    const res = await fetch(`${EVENTBRITE_BASE}/users/me/`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok) return { valid: false };
    const data = await res.json() as { id?: string; name?: string; error?: string };
    if (data.error) return { valid: false };
    return { valid: true, name: data.name, id: data.id };
  } catch {
    return { valid: false };
  }
}

// ── Main sync function ────────────────────────────────────────────────────────
// NOTE: Eventbrite deprecated their public event search API (/v3/events/search/)
// in 2023. Private tokens can only access user profile data.
// This function verifies the token is valid, then returns a helpful status.
export async function syncEventbriteEvents(options: {
  cities?: string[];
  categories?: string[];
  maxResults?: number;
  organizerId?: number;
}): Promise<EventbriteSyncResult> {
  if (!getToken()) {
    return {
      synced: 0, skipped: 0, errors: [],
      isConfigured: false,
      message: "Eventbrite API sleutel niet geconfigureerd. Voeg EVENTBRITE_API_KEY toe aan je secrets.",
    };
  }

  // Verify token validity
  const tokenCheck = await verifyEventbriteToken();
  if (!tokenCheck.valid) {
    return {
      synced: 0, skipped: 0, errors: ["Token verificatie mislukt"],
      isConfigured: false,
      message: "Eventbrite token is ongeldig of verlopen. Genereer een nieuwe private token op eventbrite.com.",
    };
  }

  console.log(`✅ Eventbrite token geldig voor: ${tokenCheck.name} (ID: ${tokenCheck.id})`);
  console.log(`⚠️ Eventbrite heeft hun publieke zoek-API (events/search) verwijderd in 2023. Handmatige import via URL is de enige optie.`);

  // Eventbrite's public search API was removed in 2023.
  // Return informative status — token is valid but search isn't available.
  return {
    synced: 0,
    skipped: 0,
    errors: [],
    isConfigured: true,
    message: `✅ Token geldig (${tokenCheck.name}). Gebruik de URL-import in het admin-dashboard om Eventbrite events toe te voegen — de automatische zoek-API is in 2023 stopgezet door Eventbrite.`,
  };

  // ── Legacy code below (kept for reference when API returns) ──────────────────
  const NL_CITIES = [
    { name: "Amsterdam",  lat: 52.3676, lon: 4.9041 },
    { name: "Rotterdam",  lat: 51.9225, lon: 4.4792 },
  ];
  const organizerId = options.organizerId || 4;
  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const city of NL_CITIES) {
    try {
      const ebEvents: EBEvent[] = [];

      for (const ebEvent of ebEvents) {
        if (seenIds.has(ebEvent.id)) continue;
        seenIds.add(ebEvent.id);

        try {
          // Check if already exists
          const existing = await db.select({ id: events.id })
            .from(events)
            .where(and(eq(events.source, "eventbrite"), eq(events.externalId, ebEvent.id)))
            .limit(1);

          if (existing.length > 0) {
            skipped++;
            continue;
          }

          // Map Eventbrite data to our schema
          const catMap = EB_CATEGORY_MAP[ebEvent.category_id] || { category: "cultural" };
          const musicGenre = EB_SUBCATEGORY_GENRE[ebEvent.subcategory_id] || undefined;

          const priceValue = ebEvent.is_free
            ? 0
            : parseFloat(ebEvent.ticket_availability?.minimum_ticket_price?.major_value || "0");

          const priceModel: string = ebEvent.is_free ? "free" : priceValue > 0 ? "from" : "paid";

          const eventDate = new Date(ebEvent.start.utc || ebEvent.start.local);
          const endDate = ebEvent.end ? new Date(ebEvent.end.utc || ebEvent.end.local) : undefined;

          const venueName = ebEvent.venue?.name || city;
          const venueCity = ebEvent.venue?.address?.city || city;
          const venueAddress = ebEvent.venue?.address?.localized_address_display || city;
          const location = venueAddress || `${venueName}, ${city}`;

          const imageUrl = ebEvent.logo?.original?.url || ebEvent.logo?.url || undefined;

          await db.insert(events).values({
            title: ebEvent.name.text.slice(0, 200),
            description: ebEvent.description?.text?.slice(0, 2000) || ebEvent.name.text,
            location,
            latitude: ebEvent.venue?.latitude,
            longitude: ebEvent.venue?.longitude,
            date: eventDate,
            endDate,
            image: imageUrl,
            category: catMap.category,
            subcategory: catMap.musicGenre,
            city: venueCity,
            musicGenre: musicGenre || catMap.musicGenre,
            isPaid: !ebEvent.is_free,
            price: priceValue || null,
            priceModel,
            adultPrice: priceValue || null,
            externalTicketLink: ebEvent.url,
            soldOut: ebEvent.ticket_availability?.is_sold_out || false,
            source: "eventbrite",
            externalId: ebEvent.id,
            status: "approved",
            organizerId,
            isVerifiedOrganizer: true,
          });

          synced++;
        } catch (insertErr: any) {
          errors.push(`Insert error for ${ebEvent.id}: ${insertErr.message?.slice(0, 100)}`);
        }
      }
    } catch (err: any) {
      errors.push(`City ${city}: ${err.message?.slice(0, 100)}`);
    }
  }

  return {
    synced, skipped, errors,
    isConfigured: true,
    message: `Synced ${synced} new events from Eventbrite (${skipped} already existed)`,
  };
}

// ── Genre-specific sync ───────────────────────────────────────────────────────
export async function syncEventbriteByGenre(genre: string, organizerId = 4): Promise<EventbriteSyncResult> {
  const genreToSubcategory: Record<string, string[]> = {
    electronic: ["1008"],
    hiphop:     ["1005"],
    rnb:        ["1012"],
    jazz:       ["1006"],
    pop:        ["1011"],
    rock:       ["1013", "1014"],
    latin:      ["1007", "1010"],
    world:      ["1003", "1017"],
    reggae:     ["1009"],
    classical:  ["1001"],
    folk:       ["1002", "1015"],
  };

  const subcategoryIds = genreToSubcategory[genre.toLowerCase()] || [];
  return syncEventbriteEvents({
    categories: ["103"],
    organizerId,
  });
}

// ── Status check ──────────────────────────────────────────────────────────────
export function getEventbriteStatus(): {
  configured: boolean;
  hasKey: boolean;
  keyPreview: string | null;
} {
  const token = getToken();
  const hasKey = !!token;
  return {
    configured: hasKey,
    hasKey,
    // Show which env var is in use
    keyPreview: hasKey
      ? `${token!.slice(0, 4)}...${token!.slice(-4)} (${
          process.env.EVENTBRITE_PRIVATE_TOKEN ? "PRIVATE_TOKEN" :
          process.env.EVENTBRITE_API_KEY        ? "API_KEY"       : "TOKEN"
        })`
      : null,
  };
}
