"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { audio } from "@/lib/audio";
import { getAllSightings } from "@/lib/data";
import { useArchive } from "@/lib/store";
import {
  TIMELINE_MAX_ISO,
  TIMELINE_MAX_YEAR,
  TIMELINE_MIN_ISO,
  TIMELINE_MIN_YEAR,
  decadeTicks,
  fracToIso,
  isoToFrac,
  yearHistogram,
} from "@/lib/timeline";

/** Years of timeline travelled per real second when PLAY is active. */
const PLAY_YEARS_PER_SEC = 7;

export function Timeline() {
  const sightings = useMemo(() => getAllSightings(), []);
  const revealedThrough = useArchive((s) => s.revealedThrough);
  const setRevealedThrough = useArchive((s) => s.setRevealedThrough);

  const histogram = useMemo(() => yearHistogram(sightings), [sightings]);
  const histogramMax = useMemo(() => Math.max(1, ...histogram), [histogram]);
  const ticks = useMemo(() => decadeTicks(), []);

  const revealedCount = useMemo(
    () => sightings.filter((s) => s.date <= revealedThrough).length,
    [sightings, revealedThrough]
  );

  const playheadFrac = isoToFrac(revealedThrough);
  const playheadYear = new Date(revealedThrough).getUTCFullYear();

  // ---------- dragging ----------
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = (clientX - rect.left) / rect.width;
    setRevealedThrough(fracToIso(frac));
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => updateFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // updateFromClientX is stable enough; eslint-disable next line is unnecessary
    // since the closure captures trackRef.current at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // ---------- PLAY ----------
  const [playing, setPlaying] = useState(false);
  const revealedRef = useRef(revealedThrough);
  useEffect(() => {
    revealedRef.current = revealedThrough;
  }, [revealedThrough]);

  // Drive the drone in lockstep with the play state.
  useEffect(() => {
    audio().setDrone(playing);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    // If we're at the end, restart from the beginning when PLAY is pressed.
    if (revealedRef.current >= TIMELINE_MAX_ISO) {
      setRevealedThrough(TIMELINE_MIN_ISO);
    }
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const cur = Date.parse(revealedRef.current);
      const next = cur + dt * PLAY_YEARS_PER_SEC * 365.25 * 24 * 3600 * 1000;
      const max = Date.parse(TIMELINE_MAX_ISO);
      if (next >= max) {
        setRevealedThrough(TIMELINE_MAX_ISO);
        setPlaying(false);
        return;
      }
      setRevealedThrough(new Date(next).toISOString().slice(0, 10));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-9 z-20 px-4">
      <div className="mx-auto max-w-6xl border border-archive-line bg-archive-panel/80 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Play / pause */}
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause timeline" : "Play timeline"}
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center border ${
              playing
                ? "border-phosphor text-phosphor shadow-phosphor"
                : "border-archive-line text-archive-paper hover:border-phosphor hover:text-phosphor"
            }`}
          >
            <span className="text-[12px] leading-none">{playing ? "❚❚" : "▶"}</span>
          </button>

          {/* Current date / year */}
          <div className="flex-shrink-0">
            <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
              revealed through
            </div>
            <div className="mt-0.5 text-[12px] text-archive-paper mono-tight">
              {revealedThrough}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Counter */}
          <div className="flex-shrink-0 text-right">
            <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
              files revealed
            </div>
            <div className="mt-0.5 text-[12px] text-archive-paper mono-tight">
              {revealedCount} / {sightings.length}
            </div>
          </div>

          {/* Reset → show all */}
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setRevealedThrough(TIMELINE_MAX_ISO);
            }}
            aria-label="Show all files"
            className="ml-1 flex-shrink-0 border border-archive-line px-2 py-1 text-[9px] uppercase tracking-wider2 text-archive-paperDim hover:border-archive-paper hover:text-archive-paper"
          >
            all
          </button>
        </div>

        {/* Scrubber track */}
        <div className="px-3 pb-3">
          <div
            ref={trackRef}
            onPointerDown={(e) => {
              e.preventDefault();
              setDragging(true);
              updateFromClientX(e.clientX);
            }}
            className="relative h-10 cursor-ew-resize select-none"
          >
            {/* Baseline */}
            <div className="absolute inset-x-0 bottom-2 h-px bg-archive-line" />

            {/* Histogram bars */}
            <div className="absolute inset-x-0 bottom-2 flex h-7 items-end">
              {histogram.map((count, i) => {
                const year = TIMELINE_MIN_YEAR + i;
                const yearFrac = (i + 0.5) / histogram.length;
                const revealed = yearFrac <= playheadFrac;
                const h = count === 0 ? 1 : Math.round((count / histogramMax) * 26) + 2;
                return (
                  <div
                    key={year}
                    title={`${year} · ${count} files`}
                    className={`mx-[0.5px] flex-1 transition-colors duration-100 ${
                      revealed
                        ? "bg-phosphor/80"
                        : "bg-archive-paperDim/30"
                    }`}
                    style={{ height: `${h}px` }}
                  />
                );
              })}
            </div>

            {/* Playhead */}
            <div
              className="absolute bottom-0 top-0 -translate-x-1/2"
              style={{ left: `${(playheadFrac * 100).toFixed(3)}%` }}
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-phosphor shadow-phosphor" />
              <div className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-phosphor shadow-phosphor" />
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] tracking-wider2 text-phosphor mono-tight">
                {playheadYear}
              </div>
            </div>

            {/* Decade tick labels */}
            <div className="pointer-events-none absolute inset-x-0 -bottom-3 h-3">
              {ticks.map((y) => {
                const frac = (y - TIMELINE_MIN_YEAR) / (TIMELINE_MAX_YEAR - TIMELINE_MIN_YEAR);
                return (
                  <div
                    key={y}
                    className="absolute -translate-x-1/2 text-[8px] tracking-wider2 text-archive-paperDim/60 mono-tight"
                    style={{ left: `${(frac * 100).toFixed(3)}%` }}
                  >
                    {y}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
