# DECLASSIFIED

> *Play this while you read* → [The X-Files Theme · Mark Snow](https://www.youtube.com/watch?v=lpqAIHvN5Ow)

An interactive 3D visualization of 162 declassified UAP files. The user is the investigator. The site boots up like a 1970s government terminal, then drops them onto a pulsing globe of sightings to explore, declassify, and connect.

![Hero card — Nimitz tic-tac (DC-2004-0117)](public/screenshots/hero-nimitz.png)

## What it does

- **Cinematic boot** — terminal-style reveal: `INITIATING ARCHIVE…` / `ACCESSING 162 FILES…` / `CASE #YYYY-XX-NNNN` / `ESTABLISHING CONNECTION…` / `ACCESS GRANTED`. Skippable, suppressed for the rest of the session.
- **3D globe** — `react-globe.gl` with a dark-Earth texture, cyan graticule, atmosphere rim. Each sighting pulses in its strangeness color: phosphor (routine), amber (unresolved), red-alert (high strangeness). Marker size encodes duration, glow encodes confidence.
- **Dossier panel** — slide-in on click. Typewriter reveal of the report with inline `[REDACTED]` bars that tear open on click and flash phosphor as the text underneath fades in. Per-sighting hooks for the iconic cases.
- **Timeline 1947 → 2026** — year-bucketed histogram + draggable playhead + PLAY mode that scrubs cinematically at 7 years/sec. Markers appear and fade as you cross their dates.
- **Audio (off by default)** — synthesized WebAudio: hover pings on markers, typewriter clacks on dossier reveal, ambient noise bed, low-A drone that rises when the timeline plays.
- **Your Local Anomaly** — one-time geolocation request, finds the nearest case, generates a shareable preview card with optional investigator credit + a per-case `/sighting/[id]` URL backed by `next/og` (1200×630) for X / Reddit share previews.
- **AI Analyst** — Claude (sonnet-4-6) returns a 5-bucket plausibility breakdown + a neutral one-line quote, via `tool_use` for strict JSON. Top-3 similar cases pulled from a precomputed similarity matrix. BYO-key panel stores your Anthropic key in `localStorage` so you can run the analyst without us shipping a server key.
- **Connections mode** — cyan arcs glow between cases with similar descriptions. Composes with the timeline scrubber: connections thin out as the playhead moves back. Click any case in the dossier's Connections section to walk the graph.
- **Filter rail** — left-edge slide-in, multi-axis filtering by agency / sensor / strangeness. Live `N / total` count, composes with timeline and Connections.
- **User submissions** — submit a sighting → Claude moderation → if approved, lands on the globe with a `[USER-SUBMITTED]` tag. Stored only in your browser.

## What's actually interesting in this dataset

A handful of cases that anchor the curation. Open each on the live site to read the dossier.

| Case | Year | Location | Why it lands |
|---|---|---|---|
| [`DC-1947-0003`](public/screenshots/og-rainier.png) | 1947 | Mount Rainier, WA | Kenneth Arnold. The report that coined "flying saucer". |
| [`DC-1976-0060`](public/screenshots/og-tehran.png) | 1976 | Tehran | Two F-4 Phantoms reportedly lost weapons systems on intercept. The DIA memo characterized it as a classic. |
| [`DC-1986-0082`](public/screenshots/og-anchorage.png) | 1986 | Anchorage, AK | JAL Cargo 1628. Captain Terauchi described an object "four times the size of a 747". FAA released the radar tapes. |
| [`DC-1989-0087`](public/screenshots/og-belgium.png) | 1989 | Eupen, Belgium | The Belgian wave: gendarmes reporting silent triangles; F-16 lock-ons over Brussels. |
| [`DC-1997-0102`](public/screenshots/og-phoenix.png) | 1997 | Phoenix, AZ | A V-shaped formation a mile wide, drifting silently south. Governor Symington confirmed seeing it. |
| [`DC-2004-0117`](public/screenshots/hero-nimitz.png) | 2004 | Off San Clemente, CA | FLIR1: the tic-tac. F/A-18 + USS Princeton SPY-1 radar. The case that re-opened the conversation. |

Every case is rendered server-side at `/sighting/[id]` with a `next/og` share card. Those PNGs above are produced live by the same route.

## Tech

Next.js 14 (App Router) · TypeScript · Tailwind · `react-globe.gl` · Framer Motion · Zustand · WebAudio (synthesized in-browser, no audio files) · `@anthropic-ai/sdk` (Claude `sonnet-4-6` via `tool_use`) · `next/og` (1200×630 share cards).

The dataset is currently a hand-curated mock (`data/sightings.json`, marked `MOCK` in the UI). The real-source pipeline (`scripts/scrape.ts` → `extract.ts` → `geocode.ts` → `embed.ts`) is wired and typed; when a public release index is available it drops in unchanged.

## Run locally

```bash
npm install
npm run data:mock   # generates data/sightings.json + similarities.json deterministically
npm run dev
# http://localhost:3000
```

To run the **AI Analyst** and **user submissions** flows, supply an Anthropic API key one of two ways:

- **BYO-key** (default): in the browser, open any dossier → AI Analyst → ▸ bring your own anthropic key. Stored only in `localStorage`. Sent to `/api/analyze` as `X-Anthropic-Key`. Never logged.
- **Server-side**: drop `ANTHROPIC_API_KEY=sk-ant-…` into `.env.local`. The route prefers the server key; per-IP rate limiting (20/hr) is applied in that mode.

## Build + deploy

```bash
npm run build       # production build — verifies types, generates routes
npm start           # serves the production build locally
```

Deploys cleanly to Vercel — the OG image route runs on the Node runtime (`runtime = "nodejs"`); set `ANTHROPIC_API_KEY` as an environment variable if you want server-side analysis.

## Tone + scope

- **No claims about what anything *is*.** The AI Analyst is constrained at the system-prompt level to avoid the words *alien*, *extraterrestrial*, *spacecraft*, or any origin claim.
- **The `[REDACTED]` bars are a visualization device.** Source files were not redacted in this specific way — the dossier footer says so explicitly.
- **Audio is opt-in.** Never auto-plays.
- **No backend, no signup.** Submissions are local to your browser. Investigator name is local to your browser.

## Build order (commit log)

The repo's history is the build order — one commit per step:

1. `bootstrap` — Next 14 + TS + Tailwind + fonts + color tokens
2. `data pipeline + mock dataset` — 162 deterministic sightings + similarity matrix
3. `3D globe with pulsing markers`
4. `dossier panel + redaction reveal`
5. `timeline scrubber 1947→2026`
6. `boot sequence + synthesized audio`
7. *parked — pending publication of the source* (real scrape pipeline)
8. `local anomaly + OG share cards`
9. `AI analyst with BYO-key fallback`
10. `connections mode — glowing arcs between similar cases`
11. `filter rail + user submissions + moderation`
12. `polish + README + deploy prep`

## Contributing

Open an issue or PR. Style is hand-rolled — no shadcn/ui defaults. Components live in `components/`, accessor and pipeline code in `lib/` and `scripts/`. Run `npm run typecheck` before pushing.

## License

MIT.

---

**DATA SOURCE: war.gov/info · THIS IS A FAN PROJECT, NOT AFFILIATED WITH ANY GOVERNMENT.**
