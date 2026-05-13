/**
 * Full-archive Project Blue Book ingester.
 *
 * Reads the per-year DjVuTXT (OCR) files from archive.org's
 * ProjectBlueBookIndexes collection and asks Claude to extract structured
 * Sighting records from each year's index. Years run 1947-1969.
 *
 * Output: merged into data/sightings.json with source: "blue-book".
 * Requires: ANTHROPIC_API_KEY.
 * Cost estimate: ~23 Claude calls (~$1-2 with sonnet-4-6).
 *
 * Run with:  npm run data:ingest-bluebook
 *
 * The curated subset in scripts/bluebook-curated.ts is preserved when this
 * runs — full-archive entries get IDs BB-YYYY-NNNN; curated keeps BB-CUR-NNN.
 */

import Anthropic from "@anthropic-ai/sdk";
import { resolve } from "node:path";
import { DATA_DIR, log, readJson, sleep, warn, writeJson } from "./_lib";
import { strangenessScore } from "../lib/strangeness";
import type { Agency, Sighting, SightingType } from "../lib/types";

const MODEL = "claude-sonnet-4-6";

const TOOL_NAME = "extract_bluebook_year";

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description:
    "Extract individual Blue Book sighting entries from a year's OCR'd index text. Return an array of records. Each entry on the index typically has: date, location, observer (Civilian/Military/AF), and an evaluation (e.g. BALLOON, AIRCRAFT, UNIDENTIFIED). Skip entries marked 'CASE MISSING' or where the OCR is too garbled.",
  input_schema: {
    type: "object" as const,
    required: ["entries"],
    properties: {
      entries: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["date", "country", "evaluation", "description"],
          properties: {
            date: { type: "string", description: "ISO date YYYY-MM-DD. Use first of month if day unknown." },
            date_confidence: { type: "string", enum: ["exact", "month", "year"] },
            country: { type: "string" },
            region: { type: "string", description: "City/state. Empty if unknown." },
            observer: { type: "string", description: "Civilian / Military / Air Force / Other" },
            evaluation: {
              type: "string",
              description: "Blue Book's evaluation, e.g. 'UNIDENTIFIED', 'BALLOON', 'AIRCRAFT', 'ASTRONOMICAL'.",
            },
            description: {
              type: "string",
              description: "One-sentence neutral summary of what the entry reports.",
            },
          },
        },
      },
    },
  },
};

const SYSTEM = `You are extracting Project Blue Book index entries from OCR'd scans of 1947-1969 USAF case index cards.

The OCR is noisy. Common patterns:
- Each entry is a single row: DATE | LOCATION | OBSERVER | EVALUATION
- "CASE MISSING" entries should be skipped.
- Dates appear as e.g. "June 24" within a section headed by year — combine to YYYY-MM-DD.
- Evaluations include UNIDENTIFIED, BALLOON, AIRCRAFT, ASTRONOMICAL, INSUFFICIENT DATA, etc.
- Locations are typed in caps with OCR errors. Normalize obvious mistakes (e.g. "Mt Ranier" → "Mount Rainier, WA").

Use the extract_bluebook_year tool to return up to 60 of the cleanest entries from the year. Prefer UNIDENTIFIED + radar/military cases when prioritizing; skip obvious balloon/aircraft entries from later years where they dominate. Never invent details that aren't on the page.`;

const YEAR_INDEX_URL = (year: number) =>
  `https://archive.org/download/ProjectBlueBookIndexes/${year}%20index%20redacted%20high%20resolution%20resized_djvu.txt`;

const UA = "DECLASSIFIED-archive/1.0 (https://github.com/nuemaan/declassified)";

const AGENCY_FOR_BLUEBOOK: Agency = "DoD"; // USAF == DoD
const DEFAULT_TYPE: SightingType = "visual";

interface ExtractedEntry {
  date: string;
  date_confidence?: "exact" | "month" | "year";
  country: string;
  region?: string;
  observer?: string;
  evaluation: string;
  description: string;
}

async function fetchYearText(year: number): Promise<string | null> {
  try {
    const r = await fetch(YEAR_INDEX_URL(year), { headers: { "User-Agent": UA } });
    if (!r.ok) {
      warn("ingest-bluebook", `· ${year}: ${r.status} ${r.statusText}`);
      return null;
    }
    return await r.text();
  } catch (err) {
    warn("ingest-bluebook", `· ${year}: network error ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function extractYear(client: Anthropic, year: number, text: string): Promise<ExtractedEntry[]> {
  const truncated = text.slice(0, 40_000); // Claude input cap for this stage
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 3500,
    system: SYSTEM,
    tool_choice: { type: "tool", name: TOOL_NAME },
    tools: [TOOL_SCHEMA],
    messages: [
      {
        role: "user",
        content: `Year: ${year}\n\nOCR text:\n${truncated}`,
      },
    ],
  });
  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return [];
  const out = toolUse.input as { entries: ExtractedEntry[] };
  return out.entries ?? [];
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    warn("ingest-bluebook", "ANTHROPIC_API_KEY not set. Add it to .env.local or your shell env.");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  const startYear = Number(process.env.BLUEBOOK_FROM ?? 1947);
  const endYear = Number(process.env.BLUEBOOK_TO ?? 1969);

  log("ingest-bluebook", `extracting ${startYear}–${endYear}`);

  const harvested: Sighting[] = [];
  let counter = 0;
  for (let year = startYear; year <= endYear; year++) {
    const text = await fetchYearText(year);
    if (!text) continue;
    log("ingest-bluebook", `· ${year}: OCR ${text.length} chars`);
    try {
      const entries = await extractYear(client, year, text);
      for (const e of entries) {
        counter++;
        const id = `BB-${year}-${String(counter).padStart(4, "0")}`;
        const score = strangenessScore({
          description: e.description,
          type: DEFAULT_TYPE,
          witnesses: e.observer ? [e.observer] : undefined,
        });
        harvested.push({
          id,
          date: e.date,
          dateConfidence: e.date_confidence ?? "month",
          location: {
            country: e.country,
            region: e.region?.trim() || undefined,
            lat: 0, // run geocode after for placement
            lng: 0,
            precision: "approximate",
          },
          agency: AGENCY_FOR_BLUEBOOK,
          type: DEFAULT_TYPE,
          description: e.description,
          witnesses: e.observer ? [e.observer] : undefined,
          strangenessScore: score,
          confidence: 0.5,
          durationMinutes: 0,
          sourceFile: `bluebook/index-${year}`,
          source: "blue-book",
          hook: e.evaluation === "UNIDENTIFIED" ? "Blue Book classified: UNIDENTIFIED" : undefined,
        });
      }
      log("ingest-bluebook", `· ${year}: extracted ${entries.length} entries (running total ${harvested.length})`);
    } catch (err) {
      warn("ingest-bluebook", `· ${year}: extract failed — ${err instanceof Error ? err.message : err}`);
    }
    await sleep(300);
  }

  // Merge with existing data, preserving curated BB-CUR- entries + pentagon data.
  const path = resolve(DATA_DIR, "sightings.json");
  const existing = readJson<Sighting[]>(path);
  const without = existing.filter((s) => !(s.source === "blue-book" && s.id.startsWith("BB-") && !s.id.startsWith("BB-CUR-")));
  const merged = [...without, ...harvested].sort((a, b) => a.date.localeCompare(b.date));
  writeJson(path, merged);

  log("ingest-bluebook", `done — added ${harvested.length} Blue Book index entries`);
  log("ingest-bluebook", "next: `npm run data:geocode` to resolve locations, then `npm run data:embed`.");
}

main().catch((err) => {
  console.error("[ingest-bluebook] fatal:", err);
  process.exit(1);
});
