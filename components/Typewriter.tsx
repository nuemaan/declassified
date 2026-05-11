"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Segment } from "@/lib/redactions";
import { RedactionReveal } from "./RedactionReveal";

interface TypewriterSegmentsProps {
  segments: Segment[];
  /** Characters per second. Default 85 — fast but rhythmic. */
  cps?: number;
  /** Stable identifier — when this changes, the animation restarts from 0. */
  resetKey?: string;
  onDone?: () => void;
}

/**
 * Progressive reveal over a Segment[] stream.
 *
 * Text segments are revealed character by character. Redaction segments are
 * rendered whole once enough characters have passed under the type head
 * (cost = reveal.length, so a longer redaction still "takes time"). Each
 * redaction lands as a clickable bar via <RedactionReveal>.
 *
 * The caret blinks at the current type head and disappears when done.
 */
export function TypewriterSegments({
  segments,
  cps = 85,
  resetKey,
  onDone,
}: TypewriterSegmentsProps) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const totalCost = useMemo(
    () =>
      segments.reduce(
        (acc, s) => acc + (s.kind === "text" ? s.text.length : s.reveal.length),
        0
      ),
    [segments]
  );

  const [progress, setProgress] = useState(0);

  // Restart whenever the underlying segments (via resetKey) or cps change.
  useEffect(() => {
    setProgress(0);
  }, [resetKey, cps]);

  useEffect(() => {
    if (totalCost === 0) {
      onDoneRef.current?.();
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setProgress((p) => {
        const next = p + cps * dt;
        if (next >= totalCost) {
          onDoneRef.current?.();
          return totalCost;
        }
        raf = requestAnimationFrame(tick);
        return next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totalCost, cps, resetKey]);

  // Skip to end on click.
  const skip = () => setProgress(totalCost);

  // Walk segments and clip each based on the running budget.
  let budget = Math.floor(progress);
  const done = budget >= totalCost;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (budget <= 0 && !done) break;
    if (seg.kind === "text") {
      const take = Math.min(seg.text.length, budget);
      out.push(<span key={i}>{seg.text.slice(0, take)}</span>);
      budget -= seg.text.length;
    } else {
      // Reveal the redaction bar only once we have enough budget to "type" past it.
      if (budget >= seg.reveal.length) {
        out.push(<RedactionReveal key={i} reveal={seg.reveal} />);
        budget -= seg.reveal.length;
      } else {
        // Mid-redaction: don't render yet (cleaner than half a bar).
        break;
      }
    }
  }

  return (
    <span onClick={skip} className="cursor-text">
      {out}
      {!done ? <span className="caret" aria-hidden /> : null}
    </span>
  );
}
