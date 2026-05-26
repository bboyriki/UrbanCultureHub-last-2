/**
 * Ticketmaster Discovery API Integration
 * Fetches real concerts & events from the Netherlands
 * Requires TICKETMASTER_API_KEY — free at developer.ticketmaster.com
 */

import { db } from "./db";
import { events } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const TM_BASE = "https://app.ticketmaster.com/discovery/v2";
const TM_KEY = process.env.TICKETMASTER_API_KEY;

// ── Segment IDs (Ticketmaster's top-level categories) ─────────────────────────
const TM_SEGMENT_TO_CATEGORY: Record<string, string> = {
  "KZFzniwnSyZfZ7v7nJ": "music",
  "KZFzniwnSyZfZ7v7nE": "sports",
  "KZFzniwnSyZfZ7v7na": "cultural",
  "KZFzniwnSyZfZ7v7n1": "family",
};

// ── Genre IDs → our musicGenre ─────────────────────────────────────────────────
const TM_GENRE_TO_MUSIC: Record<string, string> = {
  "KnvZfZ7vAvF": "electronic",
  "KnvZfZ7vAev": "hiphop",
  "KnvZfZ7vAe1": "rnb",
  "KnvZfZ7vAvd": "jazz",
  "KnvZfZ7vAeA": "rock",
  "KnvZfZ7vAeI": "pop",
  "KnvZfZ7vAe6": "latin",
  "KnvZfZ7vAvt": "classical",
  "KnvZfZ7vAe7": "reggae",
  "KnvZfZ7vAvE": "afrobeats",
};

// ── Ticketmaster response types ────────────────────────────────────────────────
interface TMClassification {
  segment?: { id: string; name: string };
  genre?: { id: string; name: string };
  subGenre?: { id: string; name: string };
}

interface TMVenue {
  name: string;
  city?: { name: string };
  country?: { name: string };
  address?: { line1: string };
  location?: { longitude: string; latitude: string };
}

interface TMEvent {
  id: string;
  name: string;
  url: string;
  info?: string;
  pleaseNote?: string;
  dates: {
    start: { dateTime?: string; localDate?: string; localTime?: string };
    end?: { dateTime?: string; localDate?: string };
    status?: { code: string };
  };
  images?: Array<{ url: string; width: number; height: number; ratio?: string }>;
  priceRanges?: Array<{ min: number; max: number; currency: string; type: string }>;
  classifications?: TMClassification[];
  _embedded?: { venues?: TMVenue[] };
  accessibility?: { info?: string };
}

export interface TicketmasterSyncResult {
  synced: number;
  skipped: number;
  errors: string[];
  isConfigured: boolean;
  message: string;
}

// ── Helper: pick best image ────────────────────────────────────────────────────
function pickImage(images: TMEvent["images"]): string | null {
  if (!images || images.length === 0) return null;
  const preferred = images.find(i => i.ratio === "16_9" && i.width >= 800)
    || images.find(i => i.ratio === "16_9")
    || images[0];
  return preferred?.url ?? null;
}

// ── Main sync function ─────────────────────────────────────────────────────────
export async function syncTicketmasterEvents(options?: {
  city?: string;
  genre?: string;
  maxResults?: number;
  organizerId?: number;
}): Promise<TicketmasterSyncResult> {
  if (!TM_KEY) {
    return {
      synced: 0, skipped: 0, errors: [],
      isConfigured: false,
      message: "Ticketmaster API-sleutel niet geconfigureerd. Voeg TICKETMASTER_API_KEY toe aan je Secrets. Gratis verkrijgbaar op developer.ticketmaster.com",
    };
  }

  const maxResults = options?.maxResults ?? 200;
  const organizerId = options?.organizerId ?? 4;
  const cities = options?.city
    ? [options.city]
    : ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Haarlem", "Eindhoven", "Tilburg", "Groningen", "Nijmegen"];

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seenIds = new Set<string>();

  const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const endDateTime = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

  for (const city of cities) {
    if (synced >= maxResults) break;
    try {
      let page = 0;
      let totalPages = 1;

      while (page < totalPages && synced < maxResults) {
        const params = new URLSearchParams({
          apikey: TM_KEY,
          countryCode: "NL",
          city,
          locale: "*",
          size: "200",
          page: String(page),
          sort: "date,asc",
          startDateTime,
          endDateTime,
        });

        if (options?.genre && TM_GENRE_TO_MUSIC[options.genre]) {
          params.set("genreId", options.genre);
        }

        const response = await fetch(`${TM_BASE}/events.json?${params}`, {
          headers: { "Accept": "application/json" },
        });

        if (!response.ok) {
          const text = await response.text();
          errors.push(`${city} p${page}: HTTP ${response.status} – ${text.slice(0, 120)}`);
          break;
        }

        const data = await response.json() as {
          _embedded?: { events?: TMEvent[] };
          page?: { totalElements: number; totalPages: number; number: number };
        };

        totalPages = data.page?.totalPages ?? 1;
        const tmEvents: TMEvent[] = data._embedded?.events ?? [];

        if (tmEvents.length === 0) break;

        for (const ev of tmEvents) {
          if (seenIds.has(ev.id)) continue;
          seenIds.add(ev.id);

          if (synced >= maxResults) break;

          if (ev.dates.status?.code === "cancelled") continue;

          try {
            const existing = await db
              .select({ id: events.id })
              .from(events)
              .where(and(eq(events.source, "ticketmaster"), eq(events.externalId, ev.id)))
              .limit(1);

            if (existing.length > 0) { skipped++; continue; }

            const venue = ev._embedded?.venues?.[0];
            const classification = ev.classifications?.[0];
            const priceRange = ev.priceRanges?.[0];

            const category = TM_SEGMENT_TO_CATEGORY[classification?.segment?.id ?? ""] ?? "music";
            const musicGenre = TM_GENRE_TO_MUSIC[classification?.genre?.id ?? ""] ?? undefined;

            const eventDate = ev.dates.start.dateTime
              ? new Date(ev.dates.start.dateTime)
              : new Date(`${ev.dates.start.localDate}T20:00:00`);

            const endDate = ev.dates.end?.dateTime
              ? new Date(ev.dates.end.dateTime)
              : undefined;

            const venueName = venue?.name ?? city;
            const venueCity = venue?.city?.name ?? city;
            const venueAddr = venue?.address?.line1;
            const location = venueAddr
              ? `${venueName}, ${venueAddr}, ${venueCity}`
              : `${venueName}, ${venueCity}`;

            // Ticketmaster events always require a ticket.
            // priceRanges may be absent even for paid events (API tier limitation).
            // Never default to "free" — use "ticketed" when no price data is available.
            const isPaid = true;
            const minPrice = priceRange ? Math.round(priceRange.min * 100) : 0;
            const maxPrice = priceRange ? Math.round(priceRange.max * 100) : 0;
            const priceModel: string = priceRange
              ? (minPrice < maxPrice ? "from" : "paid")
              : "ticketed";

            const description = [ev.info, ev.pleaseNote]
              .filter(Boolean)
              .join("\n\n")
              || `${ev.name} in ${venueCity}`;

            await db.insert(events).values({
              title: ev.name.slice(0, 200),
              description: description.slice(0, 2000),
              location,
              latitude: venue?.location?.latitude ? String(venue.location.latitude) : undefined,
              longitude: venue?.location?.longitude ? String(venue.location.longitude) : undefined,
              date: eventDate,
              endDate,
              city: venueCity,
              category,
              musicGenre,
              isPaid,
              price: minPrice || null,
              priceModel,
              adultPrice: minPrice || null,
              image: pickImage(ev.images),
              externalTicketLink: ev.url,
              source: "ticketmaster",
              externalId: ev.id,
              status: "approved",
              organizerId,
              isVerifiedOrganizer: true,
              isFeatured: false,
              isTrending: false,
            });

            synced++;
          } catch (insertErr: any) {
            errors.push(`Insert ${ev.id}: ${insertErr.message?.slice(0, 100)}`);
          }
        }

        page++;
        // Small delay between pages to respect rate limits
        if (page < totalPages) await new Promise(r => setTimeout(r, 200));
      }
    } catch (err: any) {
      errors.push(`${city}: ${err.message?.slice(0, 100)}`);
    }
  }

  return {
    synced, skipped, errors,
    isConfigured: true,
    message: `Ticketmaster: ${synced} nieuwe evenementen gesynchroniseerd (${skipped} al aanwezig)`,
  };
}

export function getTicketmasterStatus(): { configured: boolean; hasKey: boolean; keyPreview: string | null } {
  return {
    configured: !!TM_KEY,
    hasKey: !!TM_KEY,
    keyPreview: TM_KEY ? `${TM_KEY.slice(0, 4)}...${TM_KEY.slice(-4)}` : null,
  };
}
