/**
 * Orchestrator — runs the full pipeline end-to-end:
 *   scrape → extract → geocode → embed
 *
 * Run with:  npm run data:build
 *
 * Each stage is run via `npx tsx` so this script doesn't need to import them
 * (they each have their own `main()` + process.exit). Exit codes propagate.
 */

import { spawnSync } from "node:child_process";

const STAGES: Array<{ name: string; script: string; note?: string }> = [
  { name: "scrape", script: "scripts/scrape.ts" },
  { name: "extract", script: "scripts/extract.ts", note: "needs ANTHROPIC_API_KEY" },
  { name: "geocode", script: "scripts/geocode.ts" },
  { name: "embed", script: "scripts/embed.ts", note: "uses VOYAGE_API_KEY if set, else TF-IDF" },
];

for (const stage of STAGES) {
  const banner = `── ${stage.name} ─────────────────────────${stage.note ? `  (${stage.note})` : ""}`;
  console.log("\n" + banner);
  const r = spawnSync("npx", ["tsx", stage.script], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`[build-dataset] stage "${stage.name}" exited with status ${r.status}. Stopping.`);
    process.exit(r.status ?? 1);
  }
}

console.log("\n[build-dataset] all stages complete → data/sightings.json is now live-sourced.");
