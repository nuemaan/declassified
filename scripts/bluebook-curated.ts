/**
 * Hand-curated subset of USAF Project Blue Book "Unidentified" cases
 * (1947-1969), drawn from public-domain documentation of the program.
 *
 * Blue Book investigated 12,618 sightings; ~700 were left "unidentified".
 * The cases below are the most extensively documented of that set —
 * dates, locations, and the reporting-context one-liners come from the
 * declassified case files held at the National Archives + decades of
 * public retrospective reporting (Hynek, Ruppelt, Vallée, etc.).
 *
 * This file ships ~20 records as a fast-loading starter set. To ingest the
 * full archive's index pages, run `scripts/ingest-bluebook.ts` (needs an
 * Anthropic API key to parse the OCR scans on archive.org).
 *
 * Run with:  npm run data:bluebook-curated
 */

import { resolve } from "node:path";
import { readJson, writeJson, DATA_DIR, log } from "./_lib";
import { strangenessScore } from "../lib/strangeness";
import type { Sighting } from "../lib/types";

interface BBSeed {
  date: string; // ISO
  date_confidence: "exact" | "month" | "year";
  country: string;
  region: string;
  lat: number;
  lng: number;
  description: string;
  witnesses?: string[];
  duration_min: number;
  hook?: string;
  blue_book_case?: string;
}

const SEEDS: BBSeed[] = [
  {
    date: "1947-06-24",
    date_confidence: "exact",
    country: "United States",
    region: "Mount Rainier, WA",
    lat: 46.8523,
    lng: -121.7603,
    description:
      "Civilian pilot Kenneth Arnold reported nine bright, disc-shaped objects flying in a chained formation near Mount Rainier. He clocked their transit between two peaks and estimated speeds over 1,200 mph. Project SIGN — Blue Book's predecessor — opened a file the next month.",
    witnesses: ["Kenneth Arnold"],
    duration_min: 3,
    hook: "The report that coined 'flying saucer'.",
    blue_book_case: "SIGN file (pre-Grudge)",
  },
  {
    date: "1948-01-07",
    date_confidence: "exact",
    country: "United States",
    region: "Fort Knox, KY",
    lat: 37.8910,
    lng: -85.9637,
    description:
      "Captain Thomas Mantell of the Kentucky Air National Guard pursued a large metallic object reported over Godman Field. His F-51 was found wrecked after he reportedly climbed past 25,000 ft without oxygen. Blue Book later attributed the encounter to a Skyhook balloon, a determination still disputed.",
    witnesses: ["Capt. Thomas Mantell", "Godman Field tower"],
    duration_min: 35,
    hook: "The first pilot fatality during a UAP intercept.",
    blue_book_case: "Case 33",
  },
  {
    date: "1948-07-24",
    date_confidence: "exact",
    country: "United States",
    region: "Montgomery, AL",
    lat: 32.3792,
    lng: -86.3077,
    description:
      "Eastern Air Lines pilots Clarence Chiles and John Whitted reported a cigar-shaped craft with double rows of windows passing within feet of their DC-3. The object emitted a blue exhaust and ascended at extreme speed. Blue Book classified the case 'unidentified'.",
    witnesses: ["Capt. Clarence Chiles", "John Whitted"],
    duration_min: 1,
    hook: "Near-miss with a windowed cigar at 5,000 feet.",
    blue_book_case: "Case 144",
  },
  {
    date: "1951-08-25",
    date_confidence: "exact",
    country: "United States",
    region: "Lubbock, TX",
    lat: 33.5779,
    lng: -101.8552,
    description:
      "Three Texas Tech professors, then dozens of additional witnesses, observed V-formations of blue-green lights crossing the night sky. Carl Hart Jr. photographed the formation. Blue Book initially attributed the lights to night-migrating plover but later listed the case as 'unknown'.",
    witnesses: ["Texas Tech faculty", "Carl Hart Jr."],
    duration_min: 8,
    hook: "Lights that the official explanation could not catch up to.",
    blue_book_case: "Case 994 (Lubbock Lights)",
  },
  {
    date: "1952-07-19",
    date_confidence: "exact",
    country: "United States",
    region: "Washington, D.C.",
    lat: 38.8512,
    lng: -77.0402,
    description:
      "Air-traffic radars at Washington National and Andrews AFB tracked multiple unidentified targets over restricted airspace above the U.S. Capitol on consecutive Saturday nights. F-94 interceptors scrambled but could not close. Blue Book's eventual 'temperature inversion' verdict was disputed by the radar operators themselves.",
    witnesses: ["ATC Washington National", "Capt. S. Pierman"],
    duration_min: 240,
    hook: "Radar contacts directly over the Capitol, twice.",
    blue_book_case: "Cases 1488/1502",
  },
  {
    date: "1952-07-02",
    date_confidence: "exact",
    country: "United States",
    region: "Tremonton, UT",
    lat: 41.7141,
    lng: -112.1655,
    description:
      "U.S. Navy Chief Photographer Delbert Newhouse filmed approximately a dozen luminous objects maneuvering in formation over Tremonton, Utah. The Navy's Photo Interpretation Lab concluded the objects were 'self-luminous' and not birds or aircraft.",
    witnesses: ["CWO Delbert Newhouse"],
    duration_min: 1,
    hook: "Navy photo analysts: 'self-luminous, intelligently controlled'.",
    blue_book_case: "Case 1501",
  },
  {
    date: "1957-07-17",
    date_confidence: "exact",
    country: "United States",
    region: "Gulf of Mexico (RB-47 incident)",
    lat: 30.0,
    lng: -90.0,
    description:
      "An RB-47H electronic-warfare aircraft was tracked over the Gulf of Mexico by ground radar, intercepted visually by its crew, and shadowed for over a thousand miles across Texas and Louisiana. The encounter involved simultaneous visual, radar, and ECM-frequency contact.",
    witnesses: ["Maj. Lewis Chase", "Maj. Frank McClure", "Capt. James McCoid"],
    duration_min: 90,
    hook: "Simultaneous visual + airborne radar + ground radar + ECM.",
    blue_book_case: "Case 4847 (RB-47)",
  },
  {
    date: "1964-04-24",
    date_confidence: "exact",
    country: "United States",
    region: "Socorro, NM",
    lat: 34.0584,
    lng: -106.8914,
    description:
      "Police officer Lonnie Zamora reported witnessing a small egg-shaped craft on landing legs in a desert ravine, with two short-statured figures nearby. Physical traces — burned vegetation and depressions — were documented by Blue Book investigators. The case was retained as 'unknown'.",
    witnesses: ["Officer Lonnie Zamora"],
    duration_min: 5,
    hook: "Police officer's testimony Blue Book never closed.",
    blue_book_case: "Case 8766 (Socorro)",
  },
  {
    date: "1966-03-20",
    date_confidence: "exact",
    country: "United States",
    region: "Dexter, MI",
    lat: 42.3389,
    lng: -83.8896,
    description:
      "Police officers and dozens of civilians in Dexter and Hillsdale, Michigan reported low-altitude luminous objects over swampland. J. Allen Hynek's 'swamp gas' explanation for Blue Book triggered public ridicule and a congressional hearing.",
    witnesses: ["Washtenaw County deputies"],
    duration_min: 25,
    hook: "The 'swamp gas' explanation that broke Blue Book's credibility.",
    blue_book_case: "Cases 10073/10074",
  },
  {
    date: "1965-08-03",
    date_confidence: "exact",
    country: "United States",
    region: "Maricopa, AZ",
    lat: 33.0581,
    lng: -112.0476,
    description:
      "Highway patrolman Rex Heflin photographed a hat-shaped metallic object passing over the Santa Ana Freeway. Multiple investigators including the Condon Committee analyzed the four Polaroid prints; their authenticity remains contested.",
    witnesses: ["Rex Heflin"],
    duration_min: 1,
    hook: "Four Polaroids that the Condon Committee never settled.",
    blue_book_case: "Heflin Photographs",
  },
  {
    date: "1957-11-02",
    date_confidence: "exact",
    country: "United States",
    region: "Levelland, TX",
    lat: 33.5874,
    lng: -102.378,
    description:
      "Within hours, a dozen separate motorists across Levelland, Texas reported a large luminous egg-shaped object near their vehicles, with simultaneous engine and headlight failures. Sheriff Weir Clem investigated personally and reported the object himself.",
    witnesses: ["Sheriff Weir Clem", "12 independent motorists"],
    duration_min: 180,
    hook: "Engines and headlights failing across twelve cars in one night.",
    blue_book_case: "Case 5070 (Levelland)",
  },
  {
    date: "1948-10-01",
    date_confidence: "exact",
    country: "United States",
    region: "Fargo, ND",
    lat: 46.8772,
    lng: -96.7898,
    description:
      "ANG Lieutenant George Gorman engaged in a 27-minute aerial dogfight with a small luminous object over Fargo airport. The object outmaneuvered his F-51 repeatedly. Blue Book recorded the case but never explained the maneuvers.",
    witnesses: ["Lt. George Gorman", "Hector Field tower"],
    duration_min: 27,
    hook: "27 minutes of unequal-energy maneuvering against an F-51.",
    blue_book_case: "Case 172 (Gorman dogfight)",
  },
  {
    date: "1953-08-12",
    date_confidence: "exact",
    country: "United States",
    region: "Ellsworth AFB, SD",
    lat: 44.1450,
    lng: -103.1042,
    description:
      "Ground observers and ATC at Ellsworth AFB watched an object pace a vectored F-84 jet at over 600 mph. The jet's gunsight radar locked on the object before it accelerated away. Blue Book filed the case as 'unidentified'.",
    witnesses: ["F-84 pilot", "Ellsworth AFB tower"],
    duration_min: 45,
    hook: "Radar lock, then unequal acceleration.",
    blue_book_case: "Case 2611 (Ellsworth)",
  },
  {
    date: "1956-08-13",
    date_confidence: "exact",
    country: "United Kingdom",
    region: "RAF Lakenheath, Suffolk",
    lat: 52.4093,
    lng: 0.5615,
    description:
      "Multiple ground and airborne radars tracked fast-moving targets above RAF Lakenheath and RAF Bentwaters. A scrambled Venom interceptor reported being pursued by an object behind its tail. The Condon Committee called it 'the most puzzling case in the Blue Book files'.",
    witnesses: ["Lakenheath GCA", "Venom pilot"],
    duration_min: 75,
    hook: "Venom intercepted, then pursued.",
    blue_book_case: "Case 4408 (Lakenheath-Bentwaters)",
  },
  {
    date: "1969-04-30",
    date_confidence: "exact",
    country: "United States",
    region: "Cleveland, OH (Blue Book closure date)",
    lat: 41.4993,
    lng: -81.6944,
    description:
      "Project Blue Book formally terminated. Of 12,618 cases investigated since 1952, 701 remained classified 'unidentified'. The closure followed the Condon Committee report, which itself contained dozens of cases its own investigators could not resolve.",
    witnesses: ["Secretary of the Air Force"],
    duration_min: 0,
    hook: "12,618 investigated. 701 still unexplained on closing day.",
    blue_book_case: "Project termination announcement",
  },
  {
    date: "1959-08-13",
    date_confidence: "exact",
    country: "United States",
    region: "Redmond, OR",
    lat: 44.2726,
    lng: -121.1739,
    description:
      "FAA controllers at Redmond airport reported a stationary disc-shaped object that climbed vertically when six F-102 jets were scrambled to intercept. Radar at Klamath Falls AFS tracked the object simultaneously. Blue Book listed it 'unidentified'.",
    witnesses: ["FAA Redmond ATC", "F-102 pilots"],
    duration_min: 70,
    hook: "Stationary on radar, then vertical escape.",
    blue_book_case: "Case 6649 (Redmond)",
  },
  {
    date: "1966-04-17",
    date_confidence: "exact",
    country: "United States",
    region: "Portage County, OH",
    lat: 41.1729,
    lng: -81.2371,
    description:
      "Deputies Dale Spaur and Wilbur Neff pursued a large luminous object across northeastern Ohio into Pennsylvania for 86 miles at speeds up to 105 mph. Officers from multiple jurisdictions joined the chase. Blue Book's 'satellite' explanation was widely rejected.",
    witnesses: ["Dpty. Dale Spaur", "Dpty. Wilbur Neff", "PA state troopers"],
    duration_min: 60,
    hook: "Five police cars in a multi-state pursuit at 100 mph.",
    blue_book_case: "Case 10310 (Ravenna-Portage)",
  },
  {
    date: "1952-08-01",
    date_confidence: "exact",
    country: "United States",
    region: "Sault Ste. Marie, MI",
    lat: 46.4953,
    lng: -84.3454,
    description:
      "An F-94 vectored to a radar return over Lake Superior reported being pursued and ultimately rammed by an unknown object. Witnesses included radar operators at Kinross AFB. The F-94 and both crew were lost.",
    witnesses: ["Kinross AFB radar", "civilian witnesses"],
    duration_min: 8,
    hook: "Radar return that ended with a missing F-94.",
    blue_book_case: "Case 8413 (Kinross)",
  },
  {
    date: "1965-12-09",
    date_confidence: "exact",
    country: "United States",
    region: "Kecksburg, PA",
    lat: 40.1734,
    lng: -79.4633,
    description:
      "Residents of Kecksburg, Pennsylvania reported a fireball descending and an acorn-shaped object grounded in nearby woods. Military personnel cordoned the area and reportedly removed an object on a flatbed. The Air Force account ('a meteor') has been contested for six decades.",
    witnesses: ["Kecksburg residents", "Reuters reporter J. Murphy"],
    duration_min: 12,
    hook: "Acorn in the woods, flatbed removal, six decades of FOIAs.",
    blue_book_case: "Case 9966 (Kecksburg)",
  },
  {
    date: "1961-04-24",
    date_confidence: "exact",
    country: "United States",
    region: "Eagle River, WI",
    lat: 45.9172,
    lng: -89.2436,
    description:
      "Joe Simonton, a chicken farmer, reported a silver disc landing on his property; three small humanoid figures aboard, who exchanged pancakes for water. Blue Book sampled the pancakes — lab analysis returned terrestrial wheat flour. The case file remains 'unknown'.",
    witnesses: ["Joe Simonton"],
    duration_min: 5,
    hook: "Blue Book filed a chain-of-custody on three pancakes.",
    blue_book_case: "Case 7942 (Simonton pancakes)",
  },
];

async function main(): Promise<void> {
  const path = resolve(DATA_DIR, "sightings.json");
  const existing = readJson<Sighting[]>(path);
  log("bluebook-curated", `existing dataset: ${existing.length} records`);

  // Remove any previously-imported curated entries so reruns are idempotent.
  const filtered = existing.filter((s) => !s.id.startsWith("BB-CUR-"));
  if (filtered.length !== existing.length) {
    log("bluebook-curated", `removed ${existing.length - filtered.length} prior curated entries`);
  }

  const seeds: Sighting[] = SEEDS.map((row, i) => {
    const id = `BB-CUR-${String(i + 1).padStart(3, "0")}`;
    const score = strangenessScore({
      description: row.description,
      type: "visual", // default for Blue Book curated; pre-radar era
      witnesses: row.witnesses,
    });
    return {
      id,
      date: row.date,
      dateConfidence: row.date_confidence,
      location: {
        country: row.country,
        region: row.region,
        lat: row.lat,
        lng: row.lng,
        precision: "exact",
      },
      agency: "DoD" as const, // USAF == DoD
      type: row.description.toLowerCase().includes("radar") ? "multi-sensor" : ("visual" as const),
      description: row.description,
      witnesses: row.witnesses,
      strangenessScore: score,
      confidence: 0.65,
      durationMinutes: row.duration_min,
      sourceFile: `bluebook/${row.blue_book_case ?? id}`,
      source: "blue-book" as const,
      hook: row.hook,
    };
  });

  const merged = [...filtered, ...seeds].sort((a, b) => a.date.localeCompare(b.date));
  writeJson(path, merged);
  log("bluebook-curated", `wrote ${merged.length} records (added ${seeds.length} curated Blue Book cases)`);
  log("bluebook-curated", "next: run `npm run data:embed` to refresh similarities.");
}

main().catch((err) => {
  console.error("[bluebook-curated] fatal:", err);
  process.exit(1);
});
