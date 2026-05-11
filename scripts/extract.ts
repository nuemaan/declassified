/**
 * Step 7 wiring: read every file in data/raw/files/, ask Claude to produce a
 * Sighting record matching lib/types.ts, and write data/sightings.json.
 *
 * Not yet implemented — kept as a typed shell so callers can adopt the final
 * pipeline without changing the consumer surface.
 *
 * Run via:  npm run data:extract
 */

import type { Sighting } from "../lib/types";

const SYSTEM_PROMPT = `
You are an archivist extracting structured records from declassified UAP files.
Return strict JSON matching the Sighting schema. If a field is unknown, omit it.
Use neutral phrasing. Do not speculate about origin.
`.trim();

async function extractOne(_text: string, _sourceFile: string): Promise<Sighting | null> {
  // TODO(step-7): call Claude (claude-sonnet-4-6 or claude-opus-4-7)
  // via @anthropic-ai/sdk with the system prompt above and structured-output
  // validation against the Sighting schema. Run with a small concurrency
  // limit (e.g. 4) to respect rate limits.
  return null;
}

async function main(): Promise<void> {
  console.error("[extract] not yet implemented — using mock data via `npm run data:mock`.");
  void extractOne;
  void SYSTEM_PROMPT;
  process.exit(0);
}

void main();
