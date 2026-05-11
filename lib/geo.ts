import type { Sighting } from "./types";

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two [lat, lng] points, in kilometres. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

export interface NearestResult {
  sighting: Sighting;
  distanceKm: number;
}

/** Linear scan — 162 records, no spatial index needed. */
export function nearestSighting(
  origin: { lat: number; lng: number },
  sightings: Sighting[]
): NearestResult | null {
  if (sightings.length === 0) return null;
  let bestIdx = 0;
  let bestDist = haversineKm(origin, sightings[0]!.location);
  for (let i = 1; i < sightings.length; i++) {
    const d = haversineKm(origin, sightings[i]!.location);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { sighting: sightings[bestIdx]!, distanceKm: bestDist };
}

/** Human-friendly distance: < 1km in m, < 100km with 1 decimal, else integer km. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}
