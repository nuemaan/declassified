/**
 * Extract structured Sighting records from raw files in data/raw/files/.
 *
 * For each entry in data/raw/index.json:
 *   - PDFs/images are sent to Claude as native document/image content blocks
 *     (no local PDF parser needed — Anthropic handles it).
 *   - Plain-text/HTML files are read locally and forwarded as text.
 *   - Claude returns a Sighting via tool_use against a strict schema.
 *
 * Per-file output is cached to data/extracted/<slug>.json so reruns are cheap.
 * Final aggregated dataset is written to data/sightings.json — replacing the
 * mock when this stage completes successfully.
 *
 * Requires: ANTHROPIC_API_KEY (or pass via .env.local).
 * Concurrency: 3 — polite + cheap to debug. Tune via EXTRACT_CONCURRENCY=.
 */

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DATA_DIR,
  EXTRACTED_DIR,
  RAW_FILES_DIR,
  RAW_INDEX_PATH,
  log,
  readJson,
  warn,
  writeJson,
} from "./_lib";
import { strangenessScore } from "../lib/strangeness";
import type { Agency, Sighting, SightingType } from "../lib/types";

const MODEL = "claude-sonnet-4-6";

interface RawIndexEntry {
  title: string;
  url: string;
  mime: string;
  agency?: string;
  localPath: string;
}

const TOOL_NAME = "report_sighting";

const SIGHTING_TOOL_SCHEMA = {
  name: TOOL_NAME,
  description:
    "Return a structured Sighting record extracted from a declassified UAP file. Use null only if a value truly cannot be inferred — but always return an object with the required fields.",
  input_schema: {
    type: "object" as const,
    required: [
      "date",
      "date_confidence",
      "country",
      "lat",
      "lng",
      "location_precision",
      "agency",
      "type",
      "description",
      "duration_minutes",
    ],
    properties: {
      date: {
        type: "string" as const,
        description: "ISO 8601 date (YYYY-MM-DD). If only month/year are known, fill the unknown components with 01.",
      },
      date_confidence: {
        type: "string" as const,
        enum: ["exact", "month", "year"],
      },
      country: { type: "string" as const },
      region: {
        type: "string" as const,
        description: "Sub-country region/city — optional. Empty string if unknown.",
      },
      lat: { type: "number" as const, minimum: -90, maximum: 90 },
      lng: { type: "number" as const, minimum: -180, maximum: 180 },
      location_precision: {
        type: "string" as const,
        enum: ["exact", "approximate"],
        description: "exact if a specific point is given (lat/lng or named place); approximate otherwise.",
      },
      agency: {
        type: "string" as const,
        enum: ["FBI", "DoD", "NASA", "State", "Other"],
      },
      type: {
        type: "string" as const,
        enum: ["visual", "radar", "multi-sensor", "infrared", "photographic"],
      },
      description: {
        type: "string" as const,
        description: "2-3 neutral sentences summarizing what was reported. Do not editorialize.",
      },
      witnesses: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Named witnesses, if any. Empty array if none.",
      },
      duration_minutes: {
        type: "number" as const,
        minimum: 0,
        description: "Sighting duration in minutes. Use 0 for instantaneous or unknown.",
      },
      hook: {
        type: "string" as const,
        description: "Optional one-line curatorial hook that captures the case. Empty string if no clear hook.",
      },
    },
  },
};

const SYSTEM_PROMPT = `You extract structured records from declassified UAP files.

You will receive one file's contents (PDF, image, or text) along with its source metadata. Use the report_sighting tool to return a single Sighting record.

Rules:
- Neutral tone. No claims about origin. Do not use the words "alien" or "extraterrestrial".
- If a value is genuinely unknown, fill it with the most conservative interpretation:
  - Unknown date → use first of inferred month/year and set date_confidence accordingly.
  - Unknown location → use the country's geographic centroid as lat/lng and set location_precision="approximate".
- The description must be 2–3 sentences summarizing what the file actually reports.
- Always return one record per file. If a file documents multiple incidents, summarize the primary one.`;

interface ExtractedRecord {
  date: string;
  date_confidence: "exact" | "month" | "year";
  country: string;
  region?: string;
  lat: number;
  lng: number;
  location_precision: "exact" | "approximate";
  agency: Agency;
  type: SightingType;
  description: string;
  witnesses?: string[];
  duration_minutes: number;
  hook?: string;
}

async function extractOne(client: Anthropic, entry: RawIndexEntry, idx: number, total: number): Promise<Sighting | null> {
  const localPath = resolve(RAW_FILES_DIR, entry.localPath);
  if (!existsSync(localPath)) {
    warn("extract", `[${idx + 1}/${total}] missing local file: ${entry.localPath}`);
    return null;
  }

  // Build the content array based on MIME.
  const contextPreamble = `Source URL: ${entry.url}\nTitle: ${entry.title}${entry.agency ? `\nAgency hint: ${entry.agency}` : ""}`;

  let content: Anthropic.MessageParam["content"];
  if (entry.mime === "application/pdf") {
    const data = readFileSync(localPath);
    content = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: data.toString("base64"),
        },
      },
      { type: "text", text: contextPreamble },
    ];
  } else if (entry.mime.startsWith("image/")) {
    const data = readFileSync(localPath);
    content = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: entry.mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: data.toString("base64"),
        },
      },
      { type: "text", text: contextPreamble },
    ];
  } else if (entry.mime.startsWith("text/")) {
    const text = readFileSync(localPath, "utf8");
    content = [{ type: "text", text: `${contextPreamble}\n\n---\n${text.slice(0, 60_000)}` }];
  } else {
    warn("extract", `[${idx + 1}/${total}] unsupported MIME ${entry.mime} for ${entry.localPath}`);
    return null;
  }

  let resp;
  try {
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      tool_choice: { type: "tool", name: TOOL_NAME },
      tools: [SIGHTING_TOOL_SCHEMA],
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    warn("extract", `[${idx + 1}/${total}] API error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    warn("extract", `[${idx + 1}/${total}] no tool_use block`);
    return null;
  }
  const r = toolUse.input as ExtractedRecord;

  const year = new Date(r.date).getUTCFullYear();
  const sighting: Sighting = {
    id: `DC-${year}-${String(idx + 1).padStart(4, "0")}`,
    date: r.date,
    dateConfidence: r.date_confidence,
    location: {
      country: r.country,
      region: r.region?.trim() || undefined,
      lat: r.lat,
      lng: r.lng,
      precision: r.location_precision,
    },
    agency: r.agency,
    type: r.type,
    description: r.description,
    witnesses: r.witnesses?.length ? r.witnesses : undefined,
    strangenessScore: strangenessScore({
      description: r.description,
      type: r.type,
      witnesses: r.witnesses,
    }),
    confidence: 0.6, // Real-source default; tune by agency / sensor count later.
    durationMinutes: r.duration_minutes,
    sourceFile: `raw/files/${entry.localPath}`,
    hook: r.hook?.trim() || undefined,
  };

  // Cache per-file output so reruns skip the API call.
  writeJson(resolve(EXTRACTED_DIR, `${entry.localPath}.json`), sighting);
  return sighting;
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, n) }, () => worker()));
  return out;
}

async function main(): Promise<void> {
  if (!existsSync(RAW_INDEX_PATH)) {
    warn("extract", "no data/raw/index.json — run `npm run data:scrape` first.");
    process.exit(1);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    warn("extract", "ANTHROPIC_API_KEY is not set. Add it to .env.local or your shell env.");
    process.exit(1);
  }

  const index = readJson<RawIndexEntry[]>(RAW_INDEX_PATH);
  log("extract", `processing ${index.length} entries`);

  mkdirSync(EXTRACTED_DIR, { recursive: true });
  const client = new Anthropic({ apiKey });

  const concurrency = Number(process.env.EXTRACT_CONCURRENCY ?? 3);
  const results = await pool(index, concurrency, (entry, i) => extractOne(client, entry, i, index.length));
  const sightings = results.filter((s): s is Sighting => s !== null);

  if (sightings.length === 0) {
    warn("extract", "no sightings extracted — refusing to overwrite data/sightings.json");
    process.exit(2);
  }

  // Renumber sequentially by date so IDs are clean.
  sightings.sort((a, b) => a.date.localeCompare(b.date));
  const renumbered = sightings.map((s, i) => {
    const y = new Date(s.date).getUTCFullYear();
    return { ...s, id: `DC-${y}-${String(i + 1).padStart(4, "0")}` };
  });

  writeJson(resolve(DATA_DIR, "sightings.json"), renumbered);
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "live" as const,
    count: renumbered.length,
    dateRange: [renumbered[0]!.date, renumbered[renumbered.length - 1]!.date] as [string, string],
  };
  writeJson(resolve(DATA_DIR, "manifest.json"), manifest);

  log(
    "extract",
    `wrote ${renumbered.length} sightings (${manifest.dateRange[0]} → ${manifest.dateRange[1]})`
  );
  log("extract", "next: `npm run data:geocode` (resolve approximate locations) then `npm run data:embed` (similarity).");
}

main().catch((err) => {
  console.error("[extract] fatal:", err);
  process.exit(1);
});
