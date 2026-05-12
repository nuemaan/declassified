/**
 * Resolve approximate locations to lat/lng using OpenStreetMap Nominatim.
 *
 * For each entry in data/sightings.json whose location is approximate, look
 * up the country + region. Replaces lat/lng in-place when a match is found,
 * keeps location.precision = "approximate" (Nominatim resolution isn't
 * the same as the source naming a point).
 *
 * Honors Nominatim's usage policy: 1 req/sec, User-Agent identifying the
 * project. Free, no API key needed.
 */

import { resolve } from "node:path";
import { DATA_DIR, log, readJson, sleep, warn, writeJson } from "./_lib";
import type { Sighting } from "../lib/types";

const USER_AGENT =
  "DECLASSIFIED-archive/1.0 (https://github.com/nuemaan/declassified; one geocode pass per sighting; ~1 req/sec)";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (!r.ok) {
      warn("geocode", `${r.status} ${r.statusText} for "${query}"`);
      return null;
    }
    const data = (await r.json()) as NominatimResult[];
    if (!data.length) return null;
    const lat = Number(data[0]!.lat);
    const lng = Number(data[0]!.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (err) {
    warn("geocode", `network: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main(): Promise<void> {
  const path = resolve(DATA_DIR, "sightings.json");
  const sightings = readJson<Sighting[]>(path);
  log("geocode", `${sightings.length} sightings loaded`);

  let resolved = 0;
  let skipped = 0;
  let failed = 0;

  for (const s of sightings) {
    if (s.location.precision === "exact") {
      skipped++;
      continue;
    }
    // Skip entries that already look reasonable (non-zero coordinates).
    if (s.location.lat !== 0 || s.location.lng !== 0) {
      // Re-resolve only if region is non-empty and looks like a place name
      // we can confirm. To keep the rate-limited budget tight, we only
      // upgrade entries that landed at (0,0) or have empty region.
      skipped++;
      continue;
    }
    const query = [s.location.region, s.location.country].filter(Boolean).join(", ");
    if (!query) {
      failed++;
      continue;
    }
    const coords = await geocode(query);
    if (coords) {
      s.location.lat = coords.lat;
      s.location.lng = coords.lng;
      resolved++;
      log("geocode", `· ${s.id}  ${query}  →  ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`);
    } else {
      failed++;
      warn("geocode", `· ${s.id}  no match for "${query}"`);
    }
    await sleep(1100); // ≥ 1s between Nominatim requests
  }

  writeJson(path, sightings);
  log(
    "geocode",
    `done — resolved=${resolved}  skipped=${skipped} (already located)  failed=${failed}`
  );
}

main().catch((err) => {
  console.error("[geocode] fatal:", err);
  process.exit(1);
});
