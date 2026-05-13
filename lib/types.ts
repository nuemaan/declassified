// Canonical data shapes for the DECLASSIFIED archive.
// The mock generator and the (future) real-scrape pipeline both emit this shape.

export type Agency = "FBI" | "DoD" | "NASA" | "State" | "Other";

/**
 * Where a sighting record originated. The UI badges these so users know
 * what kind of source is behind each marker.
 */
export type SightingSource =
  | "pentagon-2026" // war.gov/ufo May 8 2026 release
  | "blue-book" // USAF Project Blue Book 1947-1969 (National Archives)
  | "user-submitted"; // local browser submissions, Claude-moderated

export type SightingType =
  | "visual"
  | "radar"
  | "multi-sensor"
  | "infrared"
  | "photographic";

export type LocationPrecision = "exact" | "approximate";

export interface Sighting {
  /** Stable archive ID — e.g. "DC-1947-0001". */
  id: string;
  /** ISO 8601 date. If only a month/year is known, use the first of the period. */
  date: string;
  /** Confidence in the date: "exact" (day known), "month", or "year". */
  dateConfidence: "exact" | "month" | "year";
  location: {
    country: string;
    region?: string;
    lat: number;
    lng: number;
    precision: LocationPrecision;
  };
  agency: Agency;
  type: SightingType;
  /** 2–3 sentences, neutral tone. No claims about origin. */
  description: string;
  witnesses?: string[];
  mediaUrl?: string;
  /** 0–10 derived heuristic — see lib/strangeness.ts. */
  strangenessScore: number;
  /** Confidence in the report: 0–1. Drives marker glow intensity. */
  confidence: number;
  /** Duration of the sighting in minutes (drives marker size). */
  durationMinutes: number;
  /** Source filename inside data/raw/files/ (mock entries reference a stub). */
  sourceFile: string;
  /** Where this record came from. Drives the source badge + filter dimension. */
  source?: SightingSource;
  /** Optional one-liner that captures the case's character. */
  hook?: string;
  /** True if added through the user-submissions flow. Mirrors source==="user-submitted" for back-compat. */
  userSubmitted?: boolean;
}

/** Top-K nearest neighbours by description similarity, used by Connections mode. */
export interface SimilarityIndex {
  /** Map from sighting ID → ranked neighbour list. */
  [id: string]: Array<{ id: string; score: number }>;
}

export interface ArchiveManifest {
  /** ISO timestamp the dataset was generated. */
  generatedAt: string;
  /** "mock" | "live" — UI shows a small dev badge if mock. */
  source: "mock" | "live";
  /** Total sightings in the index. */
  count: number;
  /** Date span [min, max] as ISO. */
  dateRange: [string, string];
  /** Build hash of the generator script (mock only — informational). */
  seed?: number;
}
