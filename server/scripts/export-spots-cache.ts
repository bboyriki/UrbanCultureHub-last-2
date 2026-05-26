/**
 * Export OSM spots from DB to bundled cache file
 * Run: npx tsx server/scripts/export-spots-cache.ts
 */
import { db } from "../db";
import { spotlightedPlaces } from "../../shared/schema";
import { isNotNull } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function main() {
  console.log("📦 Exporting DB spots to bundled cache...");

  const rows = await db.select({
    id: spotlightedPlaces.osmId,
    name: spotlightedPlaces.name,
    lat: spotlightedPlaces.lat,
    lon: spotlightedPlaces.lon,
    category: spotlightedPlaces.category,
    address: spotlightedPlaces.address,
    website: spotlightedPlaces.website,
  }).from(spotlightedPlaces).where(isNotNull(spotlightedPlaces.osmId));

  const spots = rows.map(r => ({
    id: r.id,
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    category: r.category,
    address: r.address || "",
    website: r.website || null,
    sport: null,
    leisure: null,
    amenity: null,
    opening_hours: null,
    phone: null,
  }));

  const outPath = path.join(process.cwd(), "server/data/city_spots_cache.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ spots, fetchedAt: Date.now() }));
  console.log(`✅ Written ${spots.length} spots to server/data/city_spots_cache.json`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
