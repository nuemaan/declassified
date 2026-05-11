import type { SimilarityIndex } from "./types";
import simJson from "@/data/similarities.json";

export const similarity: SimilarityIndex = simJson as SimilarityIndex;

/**
 * Top-N neighbours for a given sighting, sorted by score descending.
 * Score is in [0, 1] — implementation-defined (cosine for real embeddings,
 * Jaccard / token-overlap for the mock build).
 */
export function topMatches(id: string, limit = 3): Array<{ id: string; score: number }> {
  return (similarity[id] ?? []).slice(0, limit);
}

/**
 * All neighbour pairs above a score threshold — used by the Connections layer
 * to draw arcs between similar sightings without doubling each pair.
 */
export function pairsAbove(threshold: number): Array<{ from: string; to: string; score: number }> {
  const seen = new Set<string>();
  const out: Array<{ from: string; to: string; score: number }> = [];
  for (const [from, neighbours] of Object.entries(similarity)) {
    for (const { id: to, score } of neighbours) {
      if (score < threshold) continue;
      const key = from < to ? `${from}|${to}` : `${to}|${from}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from, to, score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
