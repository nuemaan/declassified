/**
 * Fetch the Pentagon UFO release CSV (war.gov/ufo) and save it to data/raw/.
 *
 * Resolution chain:
 *   1. The live CSV at war.gov (or DECLASSIFIED_SOURCE_URL if set).
 *   2. The latest Wayback Machine snapshot of the same URL.
 *
 * The page itself uses an inline CSV at /Portals/1/Interactive/2026/UFO/
 * uap-csv.csv — that's our default source. Override with
 * DECLASSIFIED_SOURCE_URL=https://… for any future re-release.
 *
 * Writes: data/raw/uap.csv  (verbatim CSV — no parsing here)
 *         data/raw/source.json  (provenance — which URL actually served us)
 */

import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { RAW_DIR, log, sourceUrl, warn, writeJson } from "./_lib";

const DEFAULT_CSV_URL =
  "https://www.war.gov/Portals/1/Interactive/2026/UFO/uap-csv.csv";

const UA =
  "Mozilla/5.0 (compatible; DECLASSIFIED-archive/1.0; +https://github.com/nuemaan/declassified)";

interface FetchOutcome {
  ok: boolean;
  status: number;
  reason?: string;
  bytes?: number;
}

async function tryFetch(url: string, dest: string): Promise<FetchOutcome> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/csv,*/*" }, redirect: "follow" });
    if (!r.ok) return { ok: false, status: r.status, reason: r.statusText };
    const buf = Buffer.from(await r.arrayBuffer());
    // Sanity check — server-side WAF pages are tiny HTML, not CSV.
    const head = buf.subarray(0, 80).toString("utf8").toLowerCase();
    if (head.includes("<html") || head.includes("access denied")) {
      return { ok: false, status: r.status, reason: "blocked / served HTML instead of CSV" };
    }
    writeFileSync(dest, buf);
    return { ok: true, status: r.status, bytes: buf.length };
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function waybackUrl(originalUrl: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(originalUrl)}`
    );
    if (!r.ok) return null;
    const data = (await r.json()) as {
      archived_snapshots?: { closest?: { url?: string; status?: string } };
    };
    const closest = data.archived_snapshots?.closest;
    if (closest?.status === "200" && closest.url) return closest.url;
    return null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true });
  const dest = resolve(RAW_DIR, "uap.csv");

  // 1. Try DECLASSIFIED_SOURCE_URL if set, else the default war.gov URL.
  const overrideUrl = process.env.DECLASSIFIED_SOURCE_URL?.trim();
  const liveUrl = overrideUrl || DEFAULT_CSV_URL;
  log("scrape", `try live: ${liveUrl}`);
  const live = await tryFetch(liveUrl, dest);
  let resolvedUrl: string | null = null;
  if (live.ok) {
    log("scrape", `· live OK (${live.bytes} bytes)`);
    resolvedUrl = liveUrl;
  } else {
    warn("scrape", `· live failed: ${live.status} ${live.reason ?? ""}`);

    // 2. Fall back to Wayback.
    const archived = await waybackUrl(liveUrl);
    if (!archived) {
      warn("scrape", `· no Wayback snapshot for ${liveUrl}`);
      warn("scrape", "give up — nothing to ingest.");
      process.exit(1);
    }
    log("scrape", `try wayback: ${archived}`);
    const wayback = await tryFetch(archived, dest);
    if (!wayback.ok) {
      warn("scrape", `· wayback failed: ${wayback.status} ${wayback.reason ?? ""}`);
      process.exit(2);
    }
    log("scrape", `· wayback OK (${wayback.bytes} bytes)`);
    resolvedUrl = archived;
  }

  // Source provenance — recorded for the manifest.
  writeJson(resolve(RAW_DIR, "source.json"), {
    fetchedAt: new Date().toISOString(),
    requestedUrl: liveUrl,
    resolvedUrl,
    bytes: live.ok ? live.bytes : undefined,
  });

  log("scrape", `wrote ${dest}`);
  log("scrape", "next: `npm run data:extract` to turn the CSV into sightings.json.");
}

main().catch((err) => {
  console.error("[scrape] fatal:", err);
  process.exit(1);
});
