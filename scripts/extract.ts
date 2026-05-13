/**
 * Parse the Pentagon UFO release CSV into Sighting records.
 *
 * Reads:  data/raw/uap.csv
 * Writes: data/sightings.json   (replaces the mock)
 *         data/manifest.json    (source: "live", count, dateRange)
 *
 * No external API calls — pure transformation. The CSV's "Description Blurb"
 * is used verbatim as the sighting description; agency, incident date, and
 * incident location are normalized; sensor type is heuristically inferred
 * from the description (defaulting to the media type as a fallback).
 *
 * Records without an Incident Date / Incident Location are kept but marked
 * dateConfidence="year" against the release date, location.precision="approximate".
 * Run `npm run data:geocode` afterwards to resolve approximate locations to
 * lat/lng via Nominatim.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DATA_DIR, RAW_DIR, log, readJson, warn, writeJson } from "./_lib";
import { strangenessScore } from "../lib/strangeness";
import type { Agency, ArchiveManifest, Sighting, SightingType } from "../lib/types";

const CSV_PATH = resolve(RAW_DIR, "uap.csv");

// ---------- CSV parser (quoted-field aware) ----------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------- normalization helpers ----------
const AGENCY_MAP: Record<string, Agency> = {
  FBI: "FBI",
  "Department of War": "DoD",
  DoD: "DoD",
  "Department of Defense": "DoD",
  NASA: "NASA",
  "Department of State": "State",
  State: "State",
};

function normalizeAgency(raw: string): Agency {
  const t = raw.trim();
  return AGENCY_MAP[t] ?? "Other";
}

/**
 * Parse "Incident Date" — the CSV uses several formats:
 *   "M/D/YY", "M/D/YYYY", "June 1947", "1947", "June 24, 1947", "N/A"
 * Returns ISO date + confidence. Falls back to {iso: releaseDateIso, confidence: "year"}
 * when the field is N/A so the timeline still places the record.
 */
function parseIncidentDate(
  raw: string,
  releaseDateIso: string
): { iso: string; confidence: "exact" | "month" | "year" } {
  const t = raw.trim();
  if (!t || /^n\/?a$/i.test(t)) {
    return { iso: releaseDateIso, confidence: "year" };
  }

  const months: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };

  // 1. M/D/YY or M/D/YYYY
  const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    let year = Number(mdy[3]);
    if (year < 100) year += year < 30 ? 2000 : 1900;
    if (year >= 1900 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { iso: `${year}-${pad(month)}-${pad(day)}`, confidence: "exact" };
    }
  }

  // 2. "Month YYYY"  or  "Month D, YYYY"  or  "Month D YYYY"
  const mDY = t.match(/^([A-Za-z]+)(?:\s+(\d{1,2}),?)?\s+(\d{4})$/);
  if (mDY) {
    const m = months[mDY[1]!.toLowerCase()];
    const y = Number(mDY[3]);
    if (m && y >= 1900 && y <= 2030) {
      const d = mDY[2] ? Number(mDY[2]) : 1;
      return {
        iso: `${y}-${pad(m)}-${pad(d)}`,
        confidence: mDY[2] ? "exact" : "month",
      };
    }
  }

  // 3. YYYY
  const y = t.match(/^(\d{4})$/);
  if (y) {
    const yr = Number(y[1]);
    if (yr >= 1900 && yr <= 2030) return { iso: `${yr}-01-01`, confidence: "year" };
  }

  // 4. Range like "June 1947 to July 1968" → take the start.
  const range = t.match(/^([A-Za-z]+)\s+(\d{4})\s+to\s+/i);
  if (range) {
    const m = months[range[1]!.toLowerCase()];
    const yr = Number(range[2]);
    if (m && yr >= 1900 && yr <= 2030) {
      return { iso: `${yr}-${pad(m)}-01`, confidence: "month" };
    }
  }

  // Fallback: take any 4-digit year embedded in the string.
  const anyYear = t.match(/\b(19|20)\d{2}\b/);
  if (anyYear) {
    const yr = Number(anyYear[0]);
    return { iso: `${yr}-01-01`, confidence: "year" };
  }

  return { iso: releaseDateIso, confidence: "year" };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Heuristic sensor type from the description + media type.
 */
function inferType(description: string, mediaType: string): SightingType {
  const d = description.toLowerCase();
  if (/\bradar\b/.test(d) && /(visual|sighted|observed|photo|infrared|FLIR)/i.test(description)) return "multi-sensor";
  if (/\bradar\b/.test(d)) return "radar";
  if (/\b(FLIR|infrared|IR)\b/.test(description)) return "infrared";
  if (/\b(photo|photograph|camera|image|footage|video)\b/.test(d) || mediaType === "VID" || mediaType === "IMG") {
    return "photographic";
  }
  return "visual";
}

/**
 * Special cases for CSV locations that Nominatim can't resolve (orbital,
 * abstract). We hard-code coordinates here so they render on the globe at
 * a recognizable point and don't pile up at (0,0) after geocoding fails.
 */
const SPECIAL_LOCATIONS: Record<string, { lat: number; lng: number; precision: "approximate" }> = {
  Moon: { lat: 0, lng: 0, precision: "approximate" }, // handled by isOrbital below
  "Low Earth Orbit": { lat: 0, lng: 0, precision: "approximate" },
  "Arabian Gulf": { lat: 26.5, lng: 51.5, precision: "approximate" },
  "Arabian Sea": { lat: 14.5, lng: 65.0, precision: "approximate" },
  "International Waters": { lat: 0, lng: -150, precision: "approximate" },
  "International Airspace": { lat: 0, lng: -150, precision: "approximate" },
};

const ORBITAL = new Set(["Moon", "Low Earth Orbit", "Lunar Orbit", "Geostationary Orbit", "Mars Orbit"]);

/**
 * Map a country-level location string → (country, region).
 * The CSV's "Incident Location" is free-form (e.g. "Oak Ridge, TN" or "USA, Nevada"
 * or "Brazil, Varginha"). We try to split into a city/region prefix + country tail.
 */
function parseLocation(raw: string): { country: string; region?: string } | null {
  const t = raw.trim();
  if (!t || /^n\/?a$/i.test(t)) return null;
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) return { country: parts[0]!, region: undefined };
  // Last part is usually the country / state.
  const last = parts[parts.length - 1]!;
  // Common US-state abbreviations → these flag a US location.
  const US_STATES = /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|D\.?C\.?)$/i;
  if (US_STATES.test(last)) {
    return {
      country: "United States",
      region: parts.join(", "), // include state in the region label
    };
  }
  return {
    country: last,
    region: parts.slice(0, -1).join(", "),
  };
}

// ---------- main ----------
interface CsvRow {
  redaction: string;
  releaseDate: string;
  title: string;
  type: string;
  videoPairing: string;
  pdfPairing: string;
  description: string;
  dvidsVideoId: string;
  videoTitle: string;
  agency: string;
  incidentDate: string;
  incidentLocation: string;
  pdfLink: string;
  modalImage: string;
}

// FNV-1a → mulberry32: deterministic scatter for unknown-location records.
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function scatterLatLng(seed: string): { lat: number; lng: number } {
  // Distribute across the South Pacific (an under-used region on most marker maps)
  // so unknown-location records remain visible but unambiguously off the main land.
  const h = hashStr(seed);
  const r1 = ((h & 0xffff) / 0xffff) * 2 - 1; // -1 → +1
  const r2 = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  return {
    lat: -45 + r1 * 20, // -65 → -25 latitude band
    lng: -160 + r2 * 30, // -190 → -130 longitude band (wraps to ~+170 if needed)
  };
}

function rowToObj(r: string[]): CsvRow {
  return {
    redaction: r[0] ?? "",
    releaseDate: r[1] ?? "",
    title: r[2] ?? "",
    type: r[3] ?? "",
    videoPairing: r[4] ?? "",
    pdfPairing: r[5] ?? "",
    description: r[6] ?? "",
    dvidsVideoId: r[7] ?? "",
    videoTitle: r[8] ?? "",
    agency: r[9] ?? "",
    incidentDate: r[10] ?? "",
    incidentLocation: r[11] ?? "",
    pdfLink: r[12] ?? "",
    modalImage: r[13] ?? "",
  };
}

async function main(): Promise<void> {
  if (!existsSync(CSV_PATH)) {
    warn("extract", `${CSV_PATH} not found — run \`npm run data:scrape\` first.`);
    process.exit(1);
  }

  const text = readFileSync(CSV_PATH, "utf8").replace(/^﻿/, "");
  const rows = parseCSV(text);
  const header = rows[0]!;
  log("extract", `CSV header columns: ${header.length}`);
  const data = rows
    .slice(1)
    .filter((r) => r.length > 5 && (r[2] ?? "").trim())
    .map(rowToObj);
  log("extract", `parsed ${data.length} records`);

  // Resolve the release date once (assume same for the whole batch).
  const releaseFirst = data[0]?.releaseDate ?? "5/8/26";
  const releaseIso = (() => {
    const r = parseIncidentDate(releaseFirst, "2026-05-08");
    return r.iso;
  })();
  log("extract", `release date resolved → ${releaseIso}`);

  // Build sightings.
  const sightings: Sighting[] = data.map((r, idx) => {
    const description = r.description.replace(/\s+/g, " ").trim();
    const dateInfo = parseIncidentDate(r.incidentDate, releaseIso);
    const loc = parseLocation(r.incidentLocation);
    const type = inferType(description, r.type);
    const agency = normalizeAgency(r.agency);
    const witnesses: string[] = [];
    // Score uses the existing strangeness heuristic on a real description.
    const score = strangenessScore({ description, type, witnesses });
    const y = new Date(dateInfo.iso).getUTCFullYear();
    const id = `DC-${y}-${String(idx + 1).padStart(4, "0")}`;
    const region = loc?.region;
    const country = loc?.country ?? "Unknown";

    // Resolve initial coordinates.
    // - Special cases (Arabian Gulf etc.) get hard-coded coords.
    // - Orbital records get a polar dot (visible but unambiguously off-Earth).
    // - Otherwise leave (0,0) for geocode.ts to upgrade.
    // - Records with country="Unknown" get a deterministic scatter so they
    //   don't pile up at (0,0).
    let lat = 0;
    let lng = 0;
    let precision: "exact" | "approximate" = "approximate";
    const special = SPECIAL_LOCATIONS[country] ?? (region ? SPECIAL_LOCATIONS[region] : undefined);
    if (special) {
      lat = special.lat;
      lng = special.lng;
      precision = special.precision;
    } else if (ORBITAL.has(country)) {
      lat = 85; // near-polar dot for orbital records
      lng = 0;
    } else if (country === "Unknown") {
      const sc = scatterLatLng(r.title || id);
      lat = sc.lat;
      lng = sc.lng;
    }

    return {
      id,
      date: dateInfo.iso,
      dateConfidence: dateInfo.confidence,
      location: { country, region, lat, lng, precision },
      agency,
      type,
      description,
      witnesses: undefined,
      strangenessScore: score,
      confidence: 0.7,
      durationMinutes: 0,
      sourceFile: r.title.trim() || `release_1/${id}`,
      source: "pentagon-2026" as const,
      hook: undefined,
      mediaUrl: r.pdfLink.trim() || undefined,
    };
  });

  // Renumber sequentially by date.
  sightings.sort((a, b) => a.date.localeCompare(b.date));
  const renumbered = sightings.map((s, i) => {
    const y = new Date(s.date).getUTCFullYear();
    return { ...s, id: `DC-${y}-${String(i + 1).padStart(4, "0")}` };
  });

  // Provenance.
  let provenance: { resolvedUrl?: string; fetchedAt?: string } = {};
  try {
    provenance = readJson(resolve(RAW_DIR, "source.json"));
  } catch {
    /* noop */
  }

  const manifest: ArchiveManifest = {
    generatedAt: new Date().toISOString(),
    source: "live",
    count: renumbered.length,
    dateRange: [renumbered[0]!.date, renumbered[renumbered.length - 1]!.date],
  };

  writeJson(resolve(DATA_DIR, "sightings.json"), renumbered);
  writeJson(resolve(DATA_DIR, "manifest.json"), {
    ...manifest,
    provenance,
  });

  // Quick distribution log so callers can sanity-check.
  const agencyCounts: Record<string, number> = {};
  const yearCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const s of renumbered) {
    agencyCounts[s.agency] = (agencyCounts[s.agency] ?? 0) + 1;
    typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1;
    const y = new Date(s.date).getUTCFullYear();
    yearCounts[String(y)] = (yearCounts[String(y)] ?? 0) + 1;
  }
  log("extract", `wrote ${renumbered.length} sightings (${manifest.dateRange[0]} → ${manifest.dateRange[1]})`);
  log("extract", `agencies: ${JSON.stringify(agencyCounts)}`);
  log("extract", `types: ${JSON.stringify(typeCounts)}`);
  log("extract", "next: `npm run data:geocode` to resolve approximate locations, then `npm run data:embed`.");
}

main().catch((err) => {
  console.error("[extract] fatal:", err);
  process.exit(1);
});
