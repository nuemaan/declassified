/**
 * Compute pairwise similarity between sightings and emit data/similarities.json
 * in the SimilarityIndex shape (top-K neighbours per sighting).
 *
 * Modes:
 *   - With VOYAGE_API_KEY set → real embeddings via Voyage AI (voyage-3-large),
 *     pairwise cosine similarity. Recommended for production.
 *   - Without VOYAGE_API_KEY  → TF-IDF cosine over tokenized descriptions.
 *     Deterministic, no network, no key. Good for local dev.
 *
 * In both modes, output is the same SimilarityIndex shape the UI consumes
 * (lib/similarity.ts), so the Connections layer and AI Analyst's similar-
 * cases section work without changes.
 */

import { resolve } from "node:path";
import { DATA_DIR, log, readJson, sleep, warn, writeJson } from "./_lib";
import type { Sighting, SimilarityIndex } from "../lib/types";

const TOP_K = 8;

// ----- tokenization (shared by both modes for filtering candidates) -----
const STOP = new Set([
  "the","a","an","and","of","to","in","on","at","with","by","for","as","is","was","were","be","been","being",
  "from","that","this","it","its","into","over","across","than","then","had","have","has","but","or","not",
  "no","their","they","them","he","she","his","her","are","before","after","above","below","during","while",
  "which","who","what","where","when","how","object","objects","reported","observed","witnesses",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

// ----- TF-IDF fallback -----
function tfidfVectors(corpus: string[]): Float32Array[] {
  const tokenized = corpus.map(tokens);
  const df = new Map<string, number>();
  for (const doc of tokenized) {
    const seen = new Set(doc);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = corpus.length;
  const vocab = Array.from(df.keys());
  const vocabIdx = new Map(vocab.map((t, i) => [t, i] as const));
  const idf = vocab.map((t) => Math.log(N / (df.get(t) ?? 1)));

  return tokenized.map((doc) => {
    const v = new Float32Array(vocab.length);
    const tf = new Map<string, number>();
    for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, c] of tf) {
      const idx = vocabIdx.get(t)!;
      v[idx] = (c / doc.length) * idf[idx]!;
    }
    return v;
  });
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ----- Voyage AI mode -----
interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

async function voyageEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const apiKey = process.env.VOYAGE_API_KEY?.trim();
  if (!apiKey) throw new Error("VOYAGE_API_KEY not set");
  const out: Float32Array[] = new Array(texts.length);
  const BATCH = 64;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const r = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: batch, model: "voyage-3-large", input_type: "document" }),
    });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`Voyage error ${r.status}: ${body.slice(0, 200)}`);
    }
    const data = (await r.json()) as VoyageResponse;
    for (const item of data.data) out[i + item.index] = new Float32Array(item.embedding);
    log("embed", `· voyage batch ${i / BATCH + 1}: ${data.data.length} vectors`);
    await sleep(150); // gentle pacing
  }
  return out;
}

// ----- main -----
async function main(): Promise<void> {
  const path = resolve(DATA_DIR, "sightings.json");
  const sightings = readJson<Sighting[]>(path);
  log("embed", `${sightings.length} sightings loaded`);

  const corpus = sightings.map((s) => `${s.description} ${s.hook ?? ""} ${s.type} ${s.location.region ?? s.location.country}`);

  let vectors: Float32Array[];
  if (process.env.VOYAGE_API_KEY) {
    log("embed", "using Voyage AI embeddings (voyage-3-large)");
    vectors = await voyageEmbeddings(corpus);
  } else {
    log("embed", "VOYAGE_API_KEY not set → using local TF-IDF cosine similarity");
    vectors = tfidfVectors(corpus);
  }

  const index: SimilarityIndex = {};
  for (let i = 0; i < sightings.length; i++) {
    const scored: Array<{ id: string; score: number }> = [];
    for (let j = 0; j < sightings.length; j++) {
      if (i === j) continue;
      const s = cosine(vectors[i]!, vectors[j]!);
      if (s > 0) scored.push({ id: sightings[j]!.id, score: Number(s.toFixed(3)) });
    }
    scored.sort((a, b) => b.score - a.score);
    index[sightings[i]!.id] = scored.slice(0, TOP_K);
  }

  writeJson(resolve(DATA_DIR, "similarities.json"), index);
  const totalPairs = Object.values(index).reduce((acc, arr) => acc + arr.length, 0);
  log("embed", `wrote ${totalPairs} similarity edges (top-${TOP_K} per sighting)`);
  if (!process.env.VOYAGE_API_KEY) {
    warn("embed", "tip: set VOYAGE_API_KEY for semantically richer similarity (won't change the shape).");
  }
}

main().catch((err) => {
  console.error("[embed] fatal:", err);
  process.exit(1);
});
