"use client";

import { useState } from "react";
import type { Sighting } from "@/lib/types";

interface ShareCaseProps {
  sighting: Sighting;
}

function siteOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

/**
 * Punchier share text than the bland "X from me" template. Uses the curator
 * hook when present, falls back to a location + date hook that still feels
 * intriguing without overstating.
 */
function buildShareText(s: Sighting): string {
  const region = s.location.region ?? s.location.country;
  if (s.hook) return `${s.hook} — ${region}, ${s.date}. From the May 2026 Pentagon release. → DECLASSIFIED`;
  return `${region}, ${s.date}. One of ${s.agency}'s declassified UAP cases. → DECLASSIFIED`;
}

export function ShareCase({ sighting }: ShareCaseProps) {
  const [copied, setCopied] = useState(false);
  const url = `${siteOrigin()}/sighting/${encodeURIComponent(sighting.id)}`;
  const text = buildShareText(sighting);
  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const reddit = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/70">
        share this case
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={tweet}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center border border-archive-line bg-archive-void/40 px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:bg-phosphor/5 hover:text-phosphor"
        >
          ▸ post to x
        </a>
        <a
          href={reddit}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center border border-archive-line bg-archive-void/40 px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:bg-phosphor/5 hover:text-phosphor"
        >
          ▸ post to reddit
        </a>
        <button
          type="button"
          onClick={copy}
          className="flex items-center justify-center border border-archive-line bg-archive-void/40 px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:bg-phosphor/5 hover:text-phosphor"
        >
          {copied ? "▸ copied" : "▸ copy link"}
        </button>
      </div>
    </div>
  );
}
