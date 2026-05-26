/**
 * Seed 1000+ real Netherlands urban culture spots from OpenStreetMap
 * Run: npx tsx server/scripts/seed-nl-spots.ts
 *
 * Inserts immediately after each city so progress is preserved if interrupted.
 */
import axios from "axios";
import { db } from "../db";
import { spotlightedPlaces } from "../../shared/schema";

function classifyCategory(tags: Record<string, string>): string {
  const sport   = (tags.sport || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();
  const amenity = (tags.amenity || "").toLowerCase();
  const name    = (tags.name || "").toLowerCase();
  const shop    = (tags.shop || "").toLowerCase();
  const tourism = (tags.tourism || "").toLowerCase();
  if (sport.includes("skateboard") || leisure.includes("skate") || name.includes("skate")) return "skate";
  if (sport.includes("parkour") || name.includes("parkour")) return "parkour";
  if (sport.includes("breakdance") || sport.includes("dance") || leisure.includes("dance") ||
      name.includes("dance") || name.includes("dansstudio") || name.includes("breakdance") ||
      name.includes("b-boy") || name.includes("bboy")) return "dance";
  if (sport.includes("basketball")) return "basketball";
  if (amenity === "music_venue" || amenity === "nightclub" ||
      name.includes("hip-hop") || name.includes("hiphop") || name.includes("muziek")) return "music";
  if (tourism.includes("gallery") || amenity.includes("gallery") || amenity.includes("arts_centre") ||
      name.includes("graffiti") || name.includes("street art") || name.includes("kunst") ||
      shop.includes("tattoo")) return "graffiti";
  if (amenity === "community_centre" || amenity === "youth_centre" || amenity === "social_centre" ||
      name.includes("wijkcentrum") || name.includes("buurtcentrum") || name.includes("jongerencentrum")) return "community";
  if (sport.includes("martial_arts") || sport.includes("boxing") || sport.includes("climbing") ||
      sport.includes("gymnastics") || sport.includes("athletics") || leisure.includes("fitness") ||
      name.includes("sporthal") || name.includes("fitness")) return "training";
  if (amenity === "theatre" || amenity === "cinema" || name.includes("theater") ||
      name.includes("schouwburg")) return "culture";
  return "culture";
}

function buildQuery(bbox: string): string {
  return `[out:json][timeout:25];
(
  node["leisure"~"sports_centre|skate_park|fitness_centre|dance|stadium|pitch|playground"][name](${bbox});
  way["leisure"~"sports_centre|skate_park|fitness_centre|dance|stadium|pitch|playground"][name](${bbox});
  node["sport"~"skateboard|parkour|basketball|dance|breakdance|martial_arts|gymnastics|climbing|boxing|volleyball|football|athletics"][name](${bbox});
  way["sport"~"skateboard|parkour|basketball|dance|breakdance|martial_arts|gymnastics|climbing|boxing|volleyball|football|athletics"][name](${bbox});
  node["amenity"~"arts_centre|community_centre|theatre|music_venue|nightclub|youth_centre|social_centre|gym|studio"][name](${bbox});
  way["amenity"~"arts_centre|community_centre|theatre|music_venue|nightclub|youth_centre|social_centre|gym|studio"][name](${bbox});
  node["tourism"~"gallery|museum"][name](${bbox});
  node["shop"~"tattoo|music"][name](${bbox});
);
out center tags 300;`;
}

const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function fetchAndInsert(cityName: string, bbox: string, existingIds: Set<number | null>): Promise<number> {
  const query = buildQuery(bbox);
  let elements: any[] = [];

  for (const ep of ENDPOINTS) {
    try {
      const res = await axios.post(ep, query, {
        headers: { "Content-Type": "text/plain" },
        timeout: 28_000,
      });
      elements = res.data?.elements || [];
      break;
    } catch {
      continue;
    }
  }

  if (elements.length === 0) {
    console.log(`  ❌ ${cityName.padEnd(16)} no data`);
    return 0;
  }

  // Parse and filter
  const spots: any[] = [];
  const seen = new Set<number>();
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const tags = el.tags || {};
    if (!lat || !lon || !tags.name) continue;
    if (lat < 50.7 || lat > 53.6 || lon < 3.3 || lon > 7.3) continue;
    if (seen.has(el.id) || existingIds.has(el.id)) continue;
    seen.add(el.id);
    existingIds.add(el.id); // Update in place to avoid cross-city dups
    spots.push({
      osmId: el.id,
      name: tags.name,
      lat, lon,
      category: classifyCategory(tags),
      address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean).join(" ") || null,
      website: tags.website || null,
      active: true,
      isSuperFeatured: false,
    });
  }

  if (spots.length === 0) {
    console.log(`  ➖ ${cityName.padEnd(16)} 0 new (${elements.length} elements, all duplicates)`);
    return 0;
  }

  // Insert in batch
  await db.insert(spotlightedPlaces).values(spots);
  console.log(`  ✅ ${cityName.padEnd(16)} +${spots.length} inserted (${elements.length} elements)`);
  return spots.length;
}

const CITIES: Array<[string, string]> = [
  ["Amsterdam",       "52.29,4.73,52.43,5.08"],
  ["Rotterdam",       "51.87,4.41,51.97,4.58"],
  ["Den Haag",        "52.03,4.24,52.13,4.40"],
  ["Utrecht",         "52.07,5.07,52.13,5.17"],
  ["Eindhoven",       "51.40,5.44,51.49,5.53"],
  ["Groningen",       "53.19,6.53,53.24,6.63"],
  ["Tilburg",         "51.54,5.06,51.59,5.14"],
  ["Almere",          "52.35,5.19,52.42,5.34"],
  ["Breda",           "51.57,4.74,51.62,4.83"],
  ["Nijmegen",        "51.83,5.83,51.88,5.92"],
  ["Haarlem",         "52.34,4.59,52.42,4.68"],
  ["Arnhem",          "51.97,5.88,52.01,5.95"],
  ["Enschede",        "52.21,6.87,52.24,6.92"],
  ["Amersfoort",      "52.14,5.36,52.18,5.42"],
  ["Zaandam",         "52.40,4.77,52.51,4.88"],
  ["Apeldoorn",       "52.20,5.95,52.23,5.99"],
  ["Den Bosch",       "51.68,5.28,51.72,5.33"],
  ["Zwolle",          "52.50,6.08,52.53,6.12"],
  ["Leiden",          "52.14,4.47,52.18,4.52"],
  ["Maastricht",      "50.83,5.67,50.88,5.72"],
  ["Dordrecht",       "51.78,4.66,51.83,4.71"],
  ["Delft",           "51.99,4.34,52.01,4.37"],
  ["Alkmaar",         "52.62,4.73,52.65,4.76"],
  ["Deventer",        "52.24,6.15,52.27,6.19"],
  ["Leeuwarden",      "53.19,5.78,53.22,5.81"],
  ["Venlo",           "51.36,6.16,51.38,6.18"],
  ["Middelburg",      "51.49,3.60,51.51,3.62"],
  ["Helmond",         "51.47,5.65,51.49,5.70"],
  ["Hilversum",       "52.22,5.17,52.25,5.20"],
  ["Lelystad",        "52.49,5.46,52.52,5.52"],
  ["Roosendaal",      "51.52,4.44,51.55,4.48"],
  ["Sittard",         "50.99,5.85,51.02,5.89"],
  ["Gouda",           "52.01,4.70,52.03,4.74"],
  ["Ede",             "52.03,5.66,52.06,5.68"],
  ["Zoetermeer",      "52.05,4.47,52.07,4.52"],
  ["Emmen",           "52.77,6.89,52.80,6.93"],
  ["Heerlen",         "50.88,5.97,50.91,6.01"],
  ["Purmerend",       "52.50,4.94,52.53,4.98"],
  ["Spijkenisse",     "51.84,4.31,51.87,4.34"],
  ["Zaanstad",        "52.44,4.82,52.52,4.93"],
];

async function main() {
  console.log("🗺️  Seeding real Netherlands urban culture spots into the database\n");

  // Load existing osmIds
  const existingRows = await db.select({ osmId: spotlightedPlaces.osmId }).from(spotlightedPlaces);
  const existingIds = new Set<number | null>(existingRows.map(r => r.osmId));
  console.log(`📊 Already in DB: ${existingIds.size} spots\n`);

  let totalInserted = 0;

  for (const [cityName, bbox] of CITIES) {
    const n = await fetchAndInsert(cityName, bbox, existingIds);
    totalInserted += n;
    // Pace to avoid 429s — alternate between endpoints already handles most of this
    await new Promise(r => setTimeout(r, 300));
  }

  const allRows = await db.select({ osmId: spotlightedPlaces.osmId }).from(spotlightedPlaces);
  console.log(`\n✅ Done! Inserted ${totalInserted} new spots this run.`);
  console.log(`📍 Total spots in database: ${allRows.length}`);
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fatal:", err.message);
  process.exit(1);
});
