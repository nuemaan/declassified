/**
 * Scrape an index page for declassified UAP files, then download each linked
 * artifact to data/raw/files/. Writes data/raw/index.json with one entry per
 * file: { title, url, mime, agency? }.
 *
 * Source URL is configurable:
 *   DECLASSIFIED_SOURCE_URL=https://example.gov/index npm run data:scrape
 *
 * Default is the brief's https://war.gov/info. If the request fails, the
 * script exits non-zero with a helpful message — you can still run the
 * downstream stages against whatever's already in data/raw/.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as cheerio from "cheerio";
import {
  RAW_FILES_DIR,
  RAW_INDEX_PATH,
  log,
  mimeFromExt,
  sleep,
  sourceUrl,
  urlSlug,
  warn,
  writeJson,
} from "./_lib";
import { mkdirSync } from "node:fs";

interface RawIndexEntry {
  title: string;
  url: string;
  mime: string;
  agency?: string;
  localPath: string;
}

const USER_AGENT =
  "DECLASSIFIED-archive/1.0 (https://github.com/nuemaan/declassified; respectful, low-volume scrape; honors robots.txt)";

const ARTIFACT_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".txt"];

async function fetchText(url: string): Promise<{ ok: true; text: string } | { ok: false; status: number; reason: string }> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" } });
    if (!r.ok) return { ok: false, status: r.status, reason: r.statusText };
    return { ok: true, text: await r.text() };
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function downloadBinary(url: string, dest: string): Promise<{ ok: true; bytes: number } | { ok: false; reason: string }> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!r.ok) return { ok: false, reason: `${r.status} ${r.statusText}` };
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(dest, buf);
    return { ok: true, bytes: buf.length };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Best-effort link extraction. Looks for anchors whose href ends in one of the
 * known artifact extensions. Adapt this if the source's markup needs custom
 * parsing (e.g. JSON-LD, JSON API).
 */
function extractCandidates(baseUrl: string, html: string): Array<{ title: string; url: string }> {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: Array<{ title: string; url: string }> = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let abs: string;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const lower = abs.toLowerCase();
    if (!ARTIFACT_EXTS.some((ext) => lower.endsWith(ext))) return;
    if (seen.has(abs)) return;
    seen.add(abs);
    const title = $(el).text().trim() || $(el).attr("title")?.trim() || abs.split("/").pop() || abs;
    out.push({ title, url: abs });
  });
  return out;
}

async function main(): Promise<void> {
  const src = sourceUrl();
  log("scrape", `source: ${src}`);

  const indexResp = await fetchText(src);
  if (!indexResp.ok) {
    warn(
      "scrape",
      `source unavailable (${indexResp.status} ${indexResp.reason}).`
    );
    warn("scrape", "Nothing to scrape. To work against a different source, set DECLASSIFIED_SOURCE_URL=https://….");
    warn("scrape", "Downstream stages (extract/geocode/embed) will still operate on whatever is already in data/raw/.");
    process.exit(1);
  }

  const candidates = extractCandidates(src, indexResp.text);
  log("scrape", `discovered ${candidates.length} artifact link(s) on the index`);
  if (candidates.length === 0) {
    warn("scrape", "Zero artifacts matched the known extension list (pdf/jpg/png/gif/webp/mp4/txt).");
    warn("scrape", "Check the source markup or adjust extractCandidates() to match the page's structure.");
    process.exit(2);
  }

  mkdirSync(RAW_FILES_DIR, { recursive: true });

  const entries: RawIndexEntry[] = [];
  for (const c of candidates) {
    const filename = urlSlug(c.url);
    const dest = resolve(RAW_FILES_DIR, filename);
    const dl = await downloadBinary(c.url, dest);
    if (!dl.ok) {
      warn("scrape", `download failed for ${c.url}: ${dl.reason}`);
      continue;
    }
    const mime = mimeFromExt(c.url);
    entries.push({
      title: c.title,
      url: c.url,
      mime,
      localPath: filename,
    });
    log("scrape", `· ${filename}  (${dl.bytes} bytes)`);
    // Polite throttle.
    await sleep(250);
  }

  writeJson(RAW_INDEX_PATH, entries);
  log("scrape", `wrote ${entries.length} entries to ${RAW_INDEX_PATH}`);
}

main().catch((err) => {
  console.error("[scrape] fatal:", err);
  process.exit(1);
});
