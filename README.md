# DECLASSIFIED

An interactive 3D visualization of 162 declassified UFO/UAP files released by the U.S. Department of Defense at `war.gov/info` on May 8, 2026.

> Fan project. Not affiliated with any government. Don't infer conclusions about anything from this site that the source data doesn't itself support.

## Status

**Bootstrap (Step 1 / 12)** — Next.js 14 + TypeScript + Tailwind shell with color tokens, fonts, CRT overlay, and classification chrome.

Upcoming:
- Data pipeline (mock → real) [step 2]
- Static globe with markers [step 3]
- Dossier panel + redaction reveal [step 4]
- Timeline scrubber [step 5]
- Boot sequence + audio [step 6]
- Real scraped data wiring [step 7]
- Local Anomaly + OG share cards [step 8]
- AI Analyst (edge function) [step 9]
- Connections mode [step 10]
- Filter rail + submissions [step 11]
- Polish + deploy [step 12]

## Run

```bash
npm install
npm run dev
# http://localhost:3000
```

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion · Zustand · react-globe.gl · Howler · `@anthropic-ai/sdk` (via edge function, added in step 9)

## License

MIT
