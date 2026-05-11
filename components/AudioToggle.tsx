"use client";

import { useEffect } from "react";
import { audio } from "@/lib/audio";
import { useArchive } from "@/lib/store";

export function AudioToggle() {
  const enabled = useArchive((s) => s.audioEnabled);
  const toggleAudio = useArchive((s) => s.toggleAudio);

  // Reflect store state into the engine. Click handler below ensures the
  // first enable happens during the user gesture itself, so the engine's
  // AudioContext is created in an allowed context.
  useEffect(() => {
    if (enabled) audio().enable();
    else audio().disable();
  }, [enabled]);

  return (
    <button
      type="button"
      onClick={() => {
        // Initialize during the click (user gesture) before flipping store state.
        if (!enabled) audio().enable();
        toggleAudio();
      }}
      aria-pressed={enabled}
      aria-label={enabled ? "Disable audio" : "Enable audio"}
      title={enabled ? "Audio enabled" : "Click to enable audio"}
      className={`flex items-center gap-1.5 border px-2 py-1 text-[10px] uppercase tracking-wider2 transition-colors ${
        enabled
          ? "border-phosphor/70 bg-phosphor/10 text-phosphor shadow-phosphor"
          : "border-archive-line bg-archive-panel/70 text-archive-paperDim hover:border-phosphor/50 hover:text-phosphor"
      }`}
    >
      <SoundIcon active={enabled} />
      <span>{enabled ? "audio on" : "enable audio"}</span>
    </button>
  );
}

function SoundIcon({ active }: { active: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M2 5h3l3-3v12l-3-3H2z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {active ? (
        <>
          <path d="M11 5.5c1 0.8 1 5.2 0 6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M13 3.5c2 1.6 2 9.4 0 11" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <path d="M11 5l4 6 M15 5l-4 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      )}
    </svg>
  );
}
