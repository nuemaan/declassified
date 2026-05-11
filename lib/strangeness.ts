import type { Sighting } from "./types";

/**
 * Derive a 0–10 "strangeness" score from a sighting's fields.
 * The formula is deliberately conservative: things that are reported
 * to violate aerodynamics, occur across multiple sensors, or include
 * named credible witnesses score higher.
 *
 * The score is a UI sorting/filter signal — never a claim of truth.
 */
export function strangenessScore(s: Pick<Sighting, "description" | "type" | "witnesses">): number {
  const desc = s.description.toLowerCase();
  let score = 2;

  // Multi-modal sensor reports → higher
  if (s.type === "multi-sensor") score += 3;
  else if (s.type === "radar") score += 2;
  else if (s.type === "infrared") score += 2;
  else if (s.type === "photographic") score += 1;

  // Lexical heuristics — purely surface-level, no semantic claim.
  // Each match is +1; the strongest signatures match several at once.
  const STRANGE_TERMS = [
    "right angle", "right-angle", "90-degree", "90 degree",
    "instant acceleration", "instantaneous", "instantly",
    "no visible propulsion", "no exhaust", "no sonic boom",
    "transmedium", "trans-medium", "submerged",
    "metallic sphere", "tic tac", "tic-tac",
    "hovered silently", "silently",
    "vanished", "disappeared",
    "weapons", "instrument failure",
    "flir", "gimbal",
    "lock-on", "lock on", "radar lock",
    "triangular", "v-shaped", "delta-shaped", "boomerang",
    "carrier strike", "fighter", "f-16", "f/a-18", "interceptor",
    "drone swarm", "swarm",
    "no transponder",
  ];
  for (const t of STRANGE_TERMS) if (desc.includes(t)) score += 1;

  // Credible witness count
  const w = s.witnesses?.length ?? 0;
  if (w >= 2) score += 1;
  if (w >= 5) score += 1;

  return Math.max(0, Math.min(10, score));
}

/**
 * Map strangeness → palette bucket used by the globe marker layer.
 * - 0–4  : phosphor (mostly explained / routine report)
 * - 5–7  : amber   (unresolved)
 * - 8–10 : redalert (high strangeness)
 */
export function strangenessBucket(score: number): "phosphor" | "amber" | "redalert" {
  if (score <= 4) return "phosphor";
  if (score <= 7) return "amber";
  return "redalert";
}
