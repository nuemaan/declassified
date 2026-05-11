import type { ArchiveManifest, Sighting } from "./types";
import sightingsJson from "@/data/sightings.json";
import manifestJson from "@/data/manifest.json";

// JSON imports are typed at build time — cast through unknown so we can keep
// the JSON file authoritative while still getting full type safety in callers.
export const sightings: Sighting[] = sightingsJson as unknown as Sighting[];
export const manifest: ArchiveManifest = manifestJson as ArchiveManifest;

const byId = new Map(sightings.map((s) => [s.id, s] as const));

export function getSighting(id: string): Sighting | undefined {
  return byId.get(id);
}

export function getAllSightings(): Sighting[] {
  return sightings;
}

export interface SightingFilter {
  agencies?: ReadonlySet<Sighting["agency"]>;
  types?: ReadonlySet<Sighting["type"]>;
  /** Inclusive year range. */
  yearRange?: [number, number];
  /** Inclusive strangeness range, 0–10. */
  strangenessRange?: [number, number];
  /** If true, only return user-submitted sightings. */
  userSubmittedOnly?: boolean;
}

export function filterSightings(filter: SightingFilter): Sighting[] {
  return sightings.filter((s) => {
    if (filter.agencies && !filter.agencies.has(s.agency)) return false;
    if (filter.types && !filter.types.has(s.type)) return false;
    if (filter.yearRange) {
      const y = new Date(s.date).getUTCFullYear();
      if (y < filter.yearRange[0] || y > filter.yearRange[1]) return false;
    }
    if (filter.strangenessRange) {
      const [lo, hi] = filter.strangenessRange;
      if (s.strangenessScore < lo || s.strangenessScore > hi) return false;
    }
    if (filter.userSubmittedOnly && !s.userSubmitted) return false;
    return true;
  });
}

/** Used by the timeline scrubber: sightings on or before this ISO date. */
export function sightingsRevealedBy(iso: string): Sighting[] {
  return sightings.filter((s) => s.date <= iso);
}
