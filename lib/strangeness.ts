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
    // Behavior / aerodynamics
    "right angle", "right-angle", "90-degree", "90 degree",
    "instant acceleration", "instantaneous", "instantly",
    "no visible propulsion", "no exhaust", "no sonic boom",
    "transmedium", "trans-medium", "submerged",
    "hovered silently", "silently", "silent",
    "vanished", "disappeared", "fast mover", "high speed",
    // Iconic shapes
    "metallic sphere", "tic tac", "tic-tac", "saucer", "flying disc", "flying saucer",
    "orb", "spheres", "egg-shaped", "cigar-shaped",
    "triangular", "v-shaped", "delta-shaped", "boomerang",
    // Sensor + encounter
    "weapons", "instrument failure",
    "flir", "gimbal", "go fast",
    "lock-on", "lock on", "radar lock", "radar tracked", "radar contact",
    "no transponder", "no flight plan",
    "near-miss", "near miss", "interception", "intercepted", "intercept",
    "incursion", "restricted airspace", "no-fly",
    // Military airframes that show up in encounters
    "carrier strike", "fighter", "f-16", "f/a-18", "f-22", "f-35", "interceptor",
    "mq-9", "uas", "drone swarm", "swarm", "unmanned",
    // Real-corpus terms that indicate an actual operational case (vs. routine paperwork)
    "mission report", "misrep", "encounter", "incident report",
    "intelligence report", "operational",
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
 * - 0–3 : phosphor (mostly explained / routine report)
 * - 4–5 : amber   (unresolved)
 * - 6+  : redalert (high strangeness — operationally interesting)
 *
 * Thresholds were chosen to give a usable spread across the live war.gov/ufo
 * release: most cases are routine FOIA-style filings; a meaningful minority
 * are real operational encounters that score 6+.
 */
export function strangenessBucket(score: number): "phosphor" | "amber" | "redalert" {
  if (score <= 3) return "phosphor";
  if (score <= 5) return "amber";
  return "redalert";
}
