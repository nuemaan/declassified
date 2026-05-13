"use client";

import { useState } from "react";
import { GuideOverlay } from "./GuideOverlay";

/**
 * Small "?" affordance in the top-right corner — opens the guide on demand
 * after the first-visit auto-open is done. Sits next to the AudioToggle.
 */
export function GuideButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* The auto-open instance — runs once per session. Hidden when open=true
          since we'd otherwise mount two overlays. */}
      {!open ? <GuideOverlay /> : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open guide"
        title="How to use this archive"
        className="flex items-center gap-1.5 border border-archive-line bg-archive-panel/70 px-2 py-1 text-[10px] uppercase tracking-wider2 text-archive-paperDim hover:border-phosphor/70 hover:text-phosphor"
      >
        <span aria-hidden>?</span>
        <span>guide</span>
      </button>
      {open ? <GuideOverlay forceOpen onClose={() => setOpen(false)} /> : null}
    </>
  );
}
