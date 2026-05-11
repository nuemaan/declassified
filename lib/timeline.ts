import type { Sighting } from "./types";

export const TIMELINE_MIN_ISO = "1947-01-01";
export const TIMELINE_MAX_ISO = "2026-12-31";
export const TIMELINE_MIN_YEAR = 1947;
export const TIMELINE_MAX_YEAR = 2026;

const MIN_MS = Date.UTC(TIMELINE_MIN_YEAR, 0, 1);
const MAX_MS = Date.UTC(TIMELINE_MAX_YEAR, 11, 31);
const SPAN_MS = MAX_MS - MIN_MS;

/** Convert an ISO date → playhead position in [0, 1] along the timeline. */
export function isoToFrac(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 1;
  return Math.max(0, Math.min(1, (ms - MIN_MS) / SPAN_MS));
}

/** Inverse of isoToFrac — clamp + return ISO YYYY-MM-DD. */
export function fracToIso(frac: number): string {
  const clamped = Math.max(0, Math.min(1, frac));
  const ms = MIN_MS + clamped * SPAN_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Bucket sightings by year over the timeline range. */
export function yearHistogram(sightings: Sighting[]): number[] {
  const buckets = new Array<number>(TIMELINE_MAX_YEAR - TIMELINE_MIN_YEAR + 1).fill(0);
  for (const s of sightings) {
    const y = new Date(s.date).getUTCFullYear();
    if (y < TIMELINE_MIN_YEAR || y > TIMELINE_MAX_YEAR) continue;
    buckets[y - TIMELINE_MIN_YEAR]!++;
  }
  return buckets;
}

/**
 * Tick labels — first year, last year, and each decade in between, skipping
 * any decade tick within 4 years of an endpoint so labels don't overlap.
 */
export function decadeTicks(): number[] {
  const out: number[] = [TIMELINE_MIN_YEAR];
  for (let y = Math.ceil(TIMELINE_MIN_YEAR / 10) * 10; y <= TIMELINE_MAX_YEAR; y += 10) {
    if (y === TIMELINE_MIN_YEAR || y === TIMELINE_MAX_YEAR) continue;
    if (y - TIMELINE_MIN_YEAR < 5) continue;
    if (TIMELINE_MAX_YEAR - y < 5) continue;
    out.push(y);
  }
  out.push(TIMELINE_MAX_YEAR);
  return out;
}
