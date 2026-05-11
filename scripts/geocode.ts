/**
 * Step 7 wiring: resolve approximate "region" strings to lat/lng via
 * Nominatim. Skips entries that already have exact coordinates.
 *
 * Run via:  npm run data:geocode   (no-op until enabled)
 */

async function main(): Promise<void> {
  // TODO(step-7):
  //   1. Read data/sightings.json
  //   2. For each entry without precise lat/lng, query
  //      https://nominatim.openstreetmap.org/search?q=...&format=jsonv2
  //      with a 1 req/sec rate limit and User-Agent identifying this project.
  //   3. Persist resolved coordinates with precision="approximate".
  console.error("[geocode] not yet implemented — mock data already has coordinates.");
  process.exit(0);
}

void main();
