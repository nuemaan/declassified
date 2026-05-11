/**
 * Step 7 wiring: scrape the file index from war.gov/info and download all 162
 * declassified files into data/raw/files/. Writes data/raw/index.json with
 * { title, url, mime, agency } per entry.
 *
 * Not yet implemented — kept as a typed shell so the public surface is stable.
 * Run via:  npm run data:scrape   (no-op until enabled)
 */

interface RawIndexEntry {
  /** Display title from the source page. */
  title: string;
  /** Resolved absolute URL. */
  url: string;
  /** Detected MIME type (application/pdf, image/jpeg, video/mp4, …). */
  mime: string;
  /** Agency tag, if the source page exposes one. */
  agency?: string;
}

export type { RawIndexEntry };

async function main(): Promise<void> {
  // TODO(step-7): Playwright crawler.
  //   const browser = await chromium.launch();
  //   const page = await browser.newPage();
  //   await page.goto("https://war.gov/info");
  //   ... extract links, follow pagination, download files ...
  console.error("[scrape] not yet implemented — using mock data via `npm run data:mock`.");
  process.exit(0);
}

void main();
