/**
 * Step 7 wiring: compute embeddings for each sighting description, build a
 * cosine-similarity matrix, and emit top-K neighbours per sighting to
 * data/similarities.json.
 *
 * The mock build uses token-overlap (Jaccard) — see scripts/mock-generate.ts.
 * This script will replace that with real embeddings (Voyage AI or OpenAI).
 *
 * Run via:  npm run data:embed   (no-op until enabled)
 */

async function main(): Promise<void> {
  // TODO(step-7):
  //   1. Load data/sightings.json
  //   2. For each description, request embedding from chosen provider
  //      (voyage-3-large or text-embedding-3-large). Cache embeddings to
  //      data/embeddings.cache.json by sighting ID so reruns are cheap.
  //   3. Compute cosine similarity pairwise and write top-K to
  //      data/similarities.json in the SimilarityIndex shape.
  console.error("[embed] not yet implemented — mock similarities written by `npm run data:mock`.");
  process.exit(0);
}

void main();
