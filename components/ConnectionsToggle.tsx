"use client";

import { useArchive } from "@/lib/store";

export function ConnectionsToggle() {
  const enabled = useArchive((s) => s.connectionsEnabled);
  const toggle = useArchive((s) => s.toggleConnections);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Hide connections" : "Show connections"}
      className={`mt-2 inline-flex w-full items-center justify-between gap-2 border px-2 py-1.5 text-[10px] uppercase tracking-wider2 transition-colors ${
        enabled
          ? "border-graticule/70 bg-graticule/10 text-graticule shadow-[0_0_12px_rgba(14,230,255,0.4)]"
          : "border-archive-line bg-archive-void/40 text-archive-paperDim hover:border-graticule/60 hover:text-graticule"
      }`}
    >
      <span>▸ connections</span>
      <span className={enabled ? "text-graticule" : "text-archive-paperDim/70"}>{enabled ? "on" : "off"}</span>
    </button>
  );
}
