/**
 * Helpers shared by the data-pipeline scripts.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Scripts are always invoked from the repo root via npm scripts (npm sets the
// cwd to the package dir). Anchoring on cwd avoids issues with import.meta
// not resolving under tsx's CJS shim on some Node versions.
export const REPO_ROOT = process.cwd();
export const DATA_DIR = resolve(REPO_ROOT, "data");
export const RAW_DIR = resolve(DATA_DIR, "raw");
export const RAW_FILES_DIR = resolve(RAW_DIR, "files");
export const RAW_INDEX_PATH = resolve(RAW_DIR, "index.json");
export const EXTRACTED_DIR = resolve(DATA_DIR, "extracted");

export const DEFAULT_SOURCE_URL = "https://www.war.gov/ufo/";
export const sourceUrl = (): string =>
  process.env.DECLASSIFIED_SOURCE_URL?.trim() || DEFAULT_SOURCE_URL;

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function log(prefix: string, ...rest: unknown[]): void {
  console.log(`[${prefix}]`, ...rest);
}

export function warn(prefix: string, ...rest: unknown[]): void {
  console.warn(`[${prefix}]`, ...rest);
}

/** Rate-limited sleep helper used by Nominatim + others. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Stable slug for filenames derived from a URL. */
export function urlSlug(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 96);
}

/** Detect MIME from a filename / URL extension. */
export function mimeFromExt(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  return "application/octet-stream";
}
