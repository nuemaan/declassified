/**
 * Generate mock data/sightings.json + data/similarities.json + data/manifest.json.
 *
 * Run via:  npm run data:mock
 *
 * The output schema is identical to what the real-data pipeline will emit
 * (scrape → extract → geocode → embed). When we wire the real source in
 * step 7, callers don't change.
 *
 * Strict TypeScript. No external dependencies.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { strangenessScore } from "../lib/strangeness";
import type {
  Agency,
  ArchiveManifest,
  Sighting,
  SightingType,
  SimilarityIndex,
} from "../lib/types";

// ---------- deterministic RNG (mulberry32) ----------
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x44434c44; // "DCLD"
const rand = rng(SEED);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const pickN = <T,>(arr: readonly T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rand() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
};

// ---------- seed sightings (hand-curated for visual + narrative weight) ----------
interface SeedRow {
  date: string;
  dateConfidence: Sighting["dateConfidence"];
  country: string;
  region: string;
  lat: number;
  lng: number;
  agency: Agency;
  type: SightingType;
  description: string;
  witnesses?: string[];
  hook?: string;
  durationMinutes: number;
}

const SEEDS: SeedRow[] = [
  {
    date: "1947-06-24",
    dateConfidence: "exact",
    country: "United States",
    region: "Mount Rainier, WA",
    lat: 46.8523,
    lng: -121.7603,
    agency: "FBI",
    type: "visual",
    description:
      "Private pilot Kenneth Arnold reported nine bright disc-shaped objects skipping in formation near Mount Rainier. He estimated their speed at over 1,200 mph by clocking transit between two peaks. The encounter coined the term 'flying saucer'.",
    witnesses: ["Kenneth Arnold"],
    hook: "The original 'flying saucer' report.",
    durationMinutes: 3,
  },
  {
    date: "1947-07-08",
    dateConfidence: "exact",
    country: "United States",
    region: "Roswell, NM",
    lat: 33.394,
    lng: -104.523,
    agency: "DoD",
    type: "photographic",
    description:
      "Rancher W. W. Brazel found unusual debris on a sheep pasture. Roswell Army Air Field initially announced recovery of a 'flying disc' before retracting the statement the next day, citing a weather balloon.",
    witnesses: ["W. W. Brazel", "Maj. Jesse Marcel"],
    hook: "The press release that the Army took back.",
    durationMinutes: 0,
  },
  {
    date: "1952-07-19",
    dateConfidence: "exact",
    country: "United States",
    region: "Washington, D.C.",
    lat: 38.8512,
    lng: -77.0402,
    agency: "DoD",
    type: "multi-sensor",
    description:
      "Multiple radar stations and airline pilots tracked unknown targets over restricted airspace above the U.S. Capitol on two consecutive weekends. F-94 interceptors scrambled but could not close. The event led to the Robertson Panel.",
    witnesses: ["ATC Washington National", "Capt. S. Pierman"],
    hook: "Radar contacts directly over the Capitol.",
    durationMinutes: 240,
  },
  {
    date: "1976-09-19",
    dateConfidence: "exact",
    country: "Iran",
    region: "Tehran",
    lat: 35.6892,
    lng: 51.389,
    agency: "DoD",
    type: "multi-sensor",
    description:
      "Imperial Iranian Air Force F-4 Phantoms vectored to an unknown returned with reports of weapons and instrument failure as they closed range. The DIA memo characterized the case as a classic, with multiple sensor confirmation.",
    witnesses: ["Lt. Jafari", "Lt. Col. Yousefi"],
    hook: "Two F-4 Phantoms lost weapons systems on intercept.",
    durationMinutes: 90,
  },
  {
    date: "1980-12-26",
    dateConfidence: "exact",
    country: "United Kingdom",
    region: "Rendlesham Forest, Suffolk",
    lat: 52.0894,
    lng: 1.4514,
    agency: "DoD",
    type: "visual",
    description:
      "USAF personnel from RAF Bentwaters investigated lights in Rendlesham Forest over three nights. Deputy Base Commander Lt. Col. Charles Halt audio-recorded the second-night encounter and described a triangular metallic object in his official memo.",
    witnesses: ["Lt. Col. Charles Halt", "Sgt. Jim Penniston"],
    hook: "The Halt memo: 'unexplained lights' on an official letterhead.",
    durationMinutes: 75,
  },
  {
    date: "1989-11-29",
    dateConfidence: "exact",
    country: "Belgium",
    region: "Eupen",
    lat: 50.6303,
    lng: 6.0345,
    agency: "Other",
    type: "multi-sensor",
    description:
      "The Belgian wave: hundreds of witnesses including gendarmes observed silent, triangular craft with three corner lights moving slowly at low altitude. NATO radar and F-16 lock-ons were reported during the months-long wave.",
    witnesses: ["Gendarmerie Eupen patrols"],
    hook: "F-16 radar tones over Brussels.",
    durationMinutes: 180,
  },
  {
    date: "1997-03-13",
    dateConfidence: "exact",
    country: "United States",
    region: "Phoenix, AZ",
    lat: 33.4484,
    lng: -112.074,
    agency: "Other",
    type: "visual",
    description:
      "Thousands of witnesses across Arizona reported a V-shaped formation of lights passing silently over Phoenix. Governor Fife Symington initially mocked the event before later confirming he himself saw 'a massive delta-shaped craft'.",
    witnesses: ["Gov. Fife Symington", "Tim Ley family"],
    hook: "A V-shaped formation a mile wide, drifting silently south.",
    durationMinutes: 110,
  },
  {
    date: "2004-11-14",
    dateConfidence: "exact",
    country: "United States",
    region: "Off San Clemente, CA",
    lat: 32.4,
    lng: -119.5,
    agency: "DoD",
    type: "multi-sensor",
    description:
      "Aircrews from the USS Nimitz Carrier Strike Group tracked a tic-tac-shaped object that reportedly descended from 60,000 ft to sea level in seconds. The encounter was captured by F/A-18 FLIR pods and corroborated by SPY-1 radar on USS Princeton.",
    witnesses: ["Cmdr. David Fravor", "Lt. Cmdr. Alex Dietrich"],
    hook: "FLIR1: the tic-tac.",
    durationMinutes: 5,
  },
  {
    date: "2008-01-08",
    dateConfidence: "exact",
    country: "United States",
    region: "Stephenville, TX",
    lat: 32.2207,
    lng: -98.2023,
    agency: "Other",
    type: "radar",
    description:
      "Dozens of residents and a county constable reported a fast-moving low-altitude object with bright lights. FAA radar data later obtained via FOIA showed an unidentified track heading toward President Bush's Crawford ranch airspace.",
    witnesses: ["Constable L. Claburn"],
    hook: "FAA radar data tracked the unknown toward restricted airspace.",
    durationMinutes: 8,
  },
  {
    date: "2015-01-21",
    dateConfidence: "exact",
    country: "United States",
    region: "Off Jacksonville, FL",
    lat: 30.2,
    lng: -80.0,
    agency: "DoD",
    type: "infrared",
    description:
      "F/A-18 aircrews from the USS Theodore Roosevelt recorded a fast-moving low-altitude object via FLIR. The 'GIMBAL' and 'GO FAST' clips, declassified by DoD in 2020, drew attention to the object's apparent rotation against the prevailing wind.",
    witnesses: ["F/A-18 aircrews, VFA-11"],
    hook: "'Look at that thing, dude.'",
    durationMinutes: 1,
  },
  {
    date: "2019-07-15",
    dateConfidence: "month",
    country: "United States",
    region: "Off San Diego, CA",
    lat: 32.7,
    lng: -117.2,
    agency: "DoD",
    type: "multi-sensor",
    description:
      "Multiple destroyers — including USS Russell and USS Kidd — tracked swarms of unidentified aerial objects over a period of weeks. The 'drone swarm' incident later became the subject of internal Navy investigation.",
    witnesses: ["USS Russell bridge watch"],
    hook: "A swarm that loitered with destroyers for days.",
    durationMinutes: 1200,
  },
  {
    date: "2023-02-04",
    dateConfidence: "exact",
    country: "United States",
    region: "Off Myrtle Beach, SC",
    lat: 33.6891,
    lng: -78.8867,
    agency: "DoD",
    type: "visual",
    description:
      "A high-altitude balloon of foreign origin was shot down by an F-22 after traversing the continental United States. The incident triggered increased NORAD sensitivity and a brief wave of additional shoot-downs over Alaska and Lake Huron.",
    witnesses: ["NORAD operators"],
    hook: "The shoot-down that recalibrated NORAD's filters.",
    durationMinutes: 4,
  },
  {
    date: "1965-09-03",
    dateConfidence: "exact",
    country: "United States",
    region: "Exeter, NH",
    lat: 42.9814,
    lng: -70.9478,
    agency: "FBI",
    type: "visual",
    description:
      "A young hitchhiker and two responding patrolmen observed a large object with a row of pulsing red lights at low altitude over a field. The case received extensive Project Blue Book attention and remains classified 'unknown'.",
    witnesses: ["Officer Eugene Bertrand", "Officer David Hunt"],
    hook: "Two police officers signed the original report.",
    durationMinutes: 15,
  },
  {
    date: "1984-07-24",
    dateConfidence: "exact",
    country: "United States",
    region: "Hudson Valley, NY",
    lat: 41.5,
    lng: -73.95,
    agency: "FBI",
    type: "visual",
    description:
      "The Hudson Valley wave: thousands of independent witnesses reported a slow-moving boomerang-shaped formation of lights between 1982 and 1986. Local police logged the call volume in the hundreds on peak nights.",
    witnesses: ["NY State Police dispatch"],
    hook: "Years of calls. One persistent silhouette.",
    durationMinutes: 25,
  },
  {
    date: "1981-06-12",
    dateConfidence: "month",
    country: "Norway",
    region: "Hessdalen Valley",
    lat: 62.7867,
    lng: 11.1881,
    agency: "Other",
    type: "photographic",
    description:
      "Persistent unexplained light phenomena have been documented in the Hessdalen Valley since the early 1980s. The Hessdalen automatic monitoring project continues to record the lights with cameras and magnetometers.",
    witnesses: ["Hessdalen monitoring project"],
    hook: "Cameras still watch the valley.",
    durationMinutes: 30,
  },
  {
    date: "2004-08-19",
    dateConfidence: "exact",
    country: "United States",
    region: "Antarctica research station support flight",
    lat: -75.0,
    lng: 0.0,
    agency: "NASA",
    type: "infrared",
    description:
      "A NASA C-130 logistical flight recorded an unresolved infrared anomaly off the coast of Queen Maud Land. The signature persisted across multiple sweeps and did not correlate with known traffic or wildlife.",
    witnesses: ["NASA C-130 crew"],
    hook: "Below the ice shelf, the heat refused to dissipate.",
    durationMinutes: 12,
  },
  {
    date: "1996-01-20",
    dateConfidence: "exact",
    country: "Brazil",
    region: "Varginha, MG",
    lat: -21.5556,
    lng: -45.4297,
    agency: "Other",
    type: "visual",
    description:
      "Multiple residents of Varginha reported sightings of an unusual figure and accompanying military activity over several days. The military denied involvement; the case became culturally significant in Brazilian UAP discourse.",
    witnesses: ["Three local witnesses (anonymized)"],
    hook: "Brazil's own contested case.",
    durationMinutes: 60,
  },
  {
    date: "2008-04-23",
    dateConfidence: "exact",
    country: "United States",
    region: "Kokomo, IN",
    lat: 40.4864,
    lng: -86.1336,
    agency: "FBI",
    type: "visual",
    description:
      "Hundreds of residents reported a low-altitude formation of orange orbs hovering silently over Kokomo. Local police received the heaviest call volume the dispatcher had recorded that decade.",
    durationMinutes: 22,
  },
  {
    date: "1986-11-17",
    dateConfidence: "exact",
    country: "United States",
    region: "Anchorage, AK",
    lat: 61.2181,
    lng: -149.9003,
    agency: "DoD",
    type: "radar",
    description:
      "JAL Cargo Flight 1628, en route over Alaska, reported sustained pacing by an enormous unidentified craft. Captain Kenju Terauchi described it as 'four times the size of a 747'. FAA released the radar tapes via FOIA.",
    witnesses: ["Capt. Kenju Terauchi", "FAA Anchorage ARTCC"],
    hook: "'Four times the size of a 747.'",
    durationMinutes: 50,
  },
];

// ---------- procedural fillers ----------
const AGENCIES: Agency[] = ["FBI", "DoD", "NASA", "State", "Other"];
const TYPES: SightingType[] = ["visual", "radar", "multi-sensor", "infrared", "photographic"];

const FILLER_LOCATIONS: Array<{ country: string; region: string; lat: number; lng: number }> = [
  { country: "Canada", region: "Falcon Lake, MB", lat: 49.7203, lng: -95.2667 },
  { country: "Argentina", region: "Bariloche", lat: -41.1335, lng: -71.3103 },
  { country: "Australia", region: "Westall, VIC", lat: -37.94, lng: 145.155 },
  { country: "Japan", region: "Off Kyushu", lat: 32.5, lng: 130.0 },
  { country: "Russia", region: "Petrozavodsk", lat: 61.7849, lng: 34.3469 },
  { country: "China", region: "Hangzhou", lat: 30.2741, lng: 120.1551 },
  { country: "France", region: "Trans-en-Provence", lat: 43.5, lng: 6.4847 },
  { country: "Mexico", region: "Mexico City", lat: 19.4326, lng: -99.1332 },
  { country: "South Africa", region: "Kruger NP", lat: -23.988, lng: 31.5547 },
  { country: "Turkey", region: "Kumburgaz", lat: 41.0314, lng: 28.2381 },
  { country: "Iceland", region: "Reykjavík approach", lat: 64.1466, lng: -21.9426 },
  { country: "Egypt", region: "Western Desert", lat: 27.0, lng: 28.0 },
  { country: "United States", region: "Skinwalker Ranch, UT", lat: 40.2541, lng: -109.8895 },
  { country: "United States", region: "Levelland, TX", lat: 33.5874, lng: -102.378 },
  { country: "United States", region: "Pascagoula, MS", lat: 30.366, lng: -88.5561 },
  { country: "United States", region: "Aurora, TX", lat: 33.0581, lng: -97.5089 },
  { country: "Greenland", region: "Thule airspace", lat: 76.5311, lng: -68.7032 },
  { country: "United States", region: "Off Hawaii", lat: 21.3, lng: -158.0 },
  { country: "Indonesia", region: "Off Bali", lat: -8.5, lng: 115.5 },
  { country: "Spain", region: "Canary Islands", lat: 28.2916, lng: -16.6291 },
  { country: "Sweden", region: "Gulf of Bothnia", lat: 63.5, lng: 19.5 },
  { country: "Chile", region: "Atacama Desert", lat: -24.5, lng: -69.25 },
  { country: "India", region: "Ladakh", lat: 34.1526, lng: 77.5771 },
  { country: "Antarctica", region: "Ross Ice Shelf", lat: -81.5, lng: 175.0 },
  { country: "Peru", region: "Marcahuasi", lat: -11.7833, lng: -76.5667 },
];

const FILLER_DESCRIPTIONS: string[] = [
  "A glowing orb was observed maneuvering silently at low altitude. Witnesses described it as making a sharp right-angle turn before accelerating beyond visual range.",
  "Radar operators tracked a sustained return that climbed at a rate inconsistent with conventional aircraft. The object held station against a 40-knot headwind with no visible propulsion.",
  "Two crew members of a commercial aircraft observed a metallic sphere paralleling their course at the same altitude. The object made no transponder return and was not on flight following.",
  "A multi-sensor track was logged across infrared and primary radar during a routine training exercise. The signature departed at a heading that crossed restricted airspace.",
  "A formation of three orange lights in a triangle was observed hovering silently. The lights reportedly executed an instantaneous 90-degree maneuver before disappearing.",
  "Witnesses photographed a metallic disc reflecting late-afternoon sunlight at high altitude. Image analysis was inconclusive due to lack of reference points.",
  "Sonar contact intermittently returned a fast-mover near the surface, then submerged. The crew classified the contact as a transmedium anomaly.",
  "A fast-moving object with a contrail inconsistent with conventional aircraft was reported by airline pilots. ATC received calls from multiple flights within a thirty-minute window.",
  "Ground witnesses observed a luminous object that hovered, descended, and then ascended at very high speed without an audible signature. No exhaust or sonic boom was reported.",
  "An infrared anomaly was recorded by a NOAA satellite, persisting across multiple passes. No corresponding visual track was confirmed.",
];

const FIRST_NAMES = ["Dale", "Eleanor", "Marcus", "Yuki", "Idris", "Anya", "Theo", "Solange", "Mateo", "Lila"];
const LAST_NAMES = ["Reyes", "Carter", "Okafor", "Tanaka", "Rashid", "Volkov", "Lindgren", "Park", "Costa", "Ahmed"];

function randomWitness(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function randomDateBetween(yearLo: number, yearHi: number): { date: string; confidence: Sighting["dateConfidence"] } {
  const year = yearLo + Math.floor(rand() * (yearHi - yearLo + 1));
  const month = 1 + Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * 28);
  const confidence = rand() < 0.7 ? "exact" : rand() < 0.7 ? "month" : "year";
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { date: iso, confidence };
}

function makeSighting(row: SeedRow, index: number): Sighting {
  const yr = new Date(row.date).getUTCFullYear();
  const id = `DC-${yr}-${String(index + 1).padStart(4, "0")}`;
  const score = strangenessScore({
    description: row.description,
    type: row.type,
    witnesses: row.witnesses,
  });
  const confidence = 0.45 + (score / 10) * 0.5 + (row.witnesses?.length ?? 0) * 0.02;
  return {
    id,
    date: row.date,
    dateConfidence: row.dateConfidence,
    location: {
      country: row.country,
      region: row.region,
      lat: row.lat,
      lng: row.lng,
      precision: "exact",
    },
    agency: row.agency,
    type: row.type,
    description: row.description,
    witnesses: row.witnesses,
    strangenessScore: score,
    confidence: Math.min(1, Math.max(0.1, confidence)),
    durationMinutes: row.durationMinutes,
    sourceFile: `mock/${id}.txt`,
    hook: row.hook,
  };
}

function makeFillerSighting(index: number): Sighting {
  const loc = pick(FILLER_LOCATIONS);
  const agency = pick(AGENCIES);
  const type = pick(TYPES);
  const desc = pick(FILLER_DESCRIPTIONS);
  const { date, confidence: dateConf } = randomDateBetween(1947, 2026);
  const witnessCount = Math.floor(rand() * 4);
  const witnesses = witnessCount > 0 ? Array.from({ length: witnessCount }, randomWitness) : undefined;
  const score = strangenessScore({ description: desc, type, witnesses });
  const yr = new Date(date).getUTCFullYear();
  const id = `DC-${yr}-${String(index + 1).padStart(4, "0")}`;
  // Add small jitter on the coordinates so two fillers in the same region don't overlap exactly.
  const jitter = () => (rand() - 0.5) * 0.6;
  return {
    id,
    date,
    dateConfidence: dateConf,
    location: {
      country: loc.country,
      region: loc.region,
      lat: loc.lat + jitter(),
      lng: loc.lng + jitter(),
      precision: dateConf === "exact" ? "approximate" : "approximate",
    },
    agency,
    type,
    description: desc,
    witnesses,
    strangenessScore: score,
    confidence: 0.3 + rand() * 0.5,
    durationMinutes: 1 + Math.floor(rand() * 60),
    sourceFile: `mock/${id}.txt`,
  };
}

// ---------- similarity (token-overlap, mock-only) ----------
const STOP = new Set([
  "the", "a", "an", "and", "of", "to", "in", "on", "at", "with", "by", "for", "as", "is", "was",
  "were", "be", "been", "being", "from", "that", "this", "it", "its", "into", "over", "across",
  "than", "then", "had", "have", "has", "but", "or", "not", "no", "their", "they", "them", "he",
  "she", "his", "her", "are", "before", "after", "above", "below", "during", "while", "which",
  "who", "what", "where", "when", "how", "object", "objects", "reported", "observed", "witnesses",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function buildSimilarityIndex(items: Sighting[], topK = 6): SimilarityIndex {
  const toks = items.map((s) => tokens(`${s.description} ${s.hook ?? ""} ${s.type}`));
  const out: SimilarityIndex = {};
  for (let i = 0; i < items.length; i++) {
    const scored: Array<{ id: string; score: number }> = [];
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const s = jaccard(toks[i]!, toks[j]!);
      if (s > 0) scored.push({ id: items[j]!.id, score: Number(s.toFixed(3)) });
    }
    scored.sort((a, b) => b.score - a.score);
    out[items[i]!.id] = scored.slice(0, topK);
  }
  return out;
}

// ---------- assemble ----------
function main(): void {
  const seeded = SEEDS.map((row, i) => makeSighting(row, i));
  const TARGET = 162; // matches the real-release count, per the brief
  const fillers: Sighting[] = [];
  let nextIdx = seeded.length;
  while (seeded.length + fillers.length < TARGET) {
    fillers.push(makeFillerSighting(nextIdx++));
  }
  const all = [...seeded, ...fillers].sort((a, b) => a.date.localeCompare(b.date));

  // Reassign IDs sequentially by date so the UI shows a clean DC-####.
  const renumbered: Sighting[] = all.map((s, i) => {
    const yr = new Date(s.date).getUTCFullYear();
    return { ...s, id: `DC-${yr}-${String(i + 1).padStart(4, "0")}` };
  });

  const similarities = buildSimilarityIndex(renumbered, 6);

  const manifest: ArchiveManifest = {
    generatedAt: new Date().toISOString(),
    source: "mock",
    count: renumbered.length,
    dateRange: [renumbered[0]!.date, renumbered[renumbered.length - 1]!.date],
    seed: SEED,
  };

  const dataDir = resolve(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(resolve(dataDir, "sightings.json"), JSON.stringify(renumbered, null, 2) + "\n");
  writeFileSync(resolve(dataDir, "similarities.json"), JSON.stringify(similarities) + "\n");
  writeFileSync(resolve(dataDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(
    `[mock-generate] wrote ${renumbered.length} sightings (${manifest.dateRange[0]} → ${manifest.dateRange[1]})`
  );
  const buckets = { phosphor: 0, amber: 0, redalert: 0 };
  for (const s of renumbered) {
    if (s.strangenessScore <= 4) buckets.phosphor++;
    else if (s.strangenessScore <= 7) buckets.amber++;
    else buckets.redalert++;
  }
  console.log(`[mock-generate] strangeness  phosphor=${buckets.phosphor}  amber=${buckets.amber}  redalert=${buckets.redalert}`);

  const totalPairs = Object.values(similarities).reduce((acc, arr) => acc + arr.length, 0);
  console.log(`[mock-generate] similarity pairs: ${totalPairs}  (avg ${(totalPairs / renumbered.length).toFixed(1)} neighbours/sighting)`);
}

main();
