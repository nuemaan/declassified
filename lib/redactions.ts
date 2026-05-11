import type { Sighting } from "./types";

/**
 * A redaction is a closed-half-open span [start, end) within a sighting's
 * description that the UI renders as a [REDACTED] bar the user can click
 * to "declassify".
 *
 * These are a visualization device — not actual redactions in the source.
 * That caveat is shown to the reader in the dossier footer.
 */
export interface Redaction {
  start: number;
  end: number;
  /** The original text beneath the bar. */
  reveal: string;
}

// Deterministic mulberry32, matching the mock generator. Same sighting → same redactions.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  // FNV-1a 32-bit. Enough entropy for our seed.
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

interface Candidate {
  start: number;
  end: number;
  text: string;
}

/**
 * Surface plausible redaction targets in a description: proper nouns,
 * year/four-digit numbers, model designators (F-16, F/A-18), and
 * tic-tac-style hyphenated tokens. We avoid stop words and ultra-short
 * tokens so the bars don't look glitchy.
 */
function findCandidates(desc: string): Candidate[] {
  const out: Candidate[] = [];
  // Match: capitalized run (incl. internal punctuation, hyphens, slashes,
  // dots — e.g. "F/A-18", "Lt.", "W. W. Brazel") OR year-like 3–4 digits.
  const re = /(?:[A-Z][A-Za-z]*(?:[.\-/'][A-Za-z0-9]+)*(?:\s+[A-Z][A-Za-z]*(?:[.\-/'][A-Za-z0-9]+)*){0,2})|\b\d{3,4}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(desc)) !== null) {
    const text = m[0];
    if (text.length < 4 || text.length > 28) continue;
    // Skip sentence-initial common words like "The", "Multiple", "Two".
    if (/^(The|A|An|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Multiple|Hundreds|Thousands|Dozens|Many|Several|Local|Witnesses|During|Over)\b/i.test(text))
      continue;
    out.push({ start: m.index, end: m.index + text.length, text });
  }
  return out;
}

/**
 * Pick 2–4 non-overlapping redactions for a sighting. Deterministic given
 * the sighting's ID, so the same case always has the same bars.
 */
export function redactionsFor(s: Pick<Sighting, "id" | "description">): Redaction[] {
  const desc = s.description;
  const candidates = findCandidates(desc);
  if (candidates.length === 0) return [];

  const rand = mulberry32(hashId(s.id));
  // Shuffle.
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  const target = 2 + Math.floor(rand() * 3); // 2..4
  const chosen: Redaction[] = [];
  for (const c of shuffled) {
    if (chosen.length >= target) break;
    const overlap = chosen.some((r) => !(c.end <= r.start || c.start >= r.end));
    if (overlap) continue;
    chosen.push({ start: c.start, end: c.end, reveal: c.text });
  }
  // Sort by start so we can stream through the description in one pass.
  chosen.sort((a, b) => a.start - b.start);
  return chosen;
}

/**
 * Break a description into ordered segments — plain text or a redaction bar.
 * Used by RedactionReveal to render the description with mixed plain/redacted
 * tokens in a single inline stream.
 */
export type Segment =
  | { kind: "text"; text: string }
  | { kind: "redacted"; reveal: string };

export function segmentDescription(
  description: string,
  redactions: Redaction[]
): Segment[] {
  if (redactions.length === 0) return [{ kind: "text", text: description }];
  const out: Segment[] = [];
  let cursor = 0;
  for (const r of redactions) {
    if (r.start > cursor) {
      out.push({ kind: "text", text: description.slice(cursor, r.start) });
    }
    out.push({ kind: "redacted", reveal: description.slice(r.start, r.end) });
    cursor = r.end;
  }
  if (cursor < description.length) {
    out.push({ kind: "text", text: description.slice(cursor) });
  }
  return out;
}
