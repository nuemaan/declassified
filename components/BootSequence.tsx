"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { audio } from "@/lib/audio";

interface Line {
  text: string;
  /** Delay before this line starts, in ms relative to mount. */
  startAt: number;
  /** Characters per second for this line. */
  cps: number;
  /** Color override — defaults to paper. */
  className?: string;
}

const SESSION_KEY = "declassified.boot.shown";

function randomCaseId(): string {
  const yr = 1947 + Math.floor(Math.random() * (2026 - 1947 + 1));
  const a = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
    String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const n = String(Math.floor(Math.random() * 9000 + 1000));
  return `${yr}-${a}-${n}`;
}

export function BootSequence() {
  // Visible unless we've already shown it this session. Decided client-side
  // to avoid SSR/CSR mismatch: starts true, may flip to false in mount effect.
  const [visible, setVisible] = useState(true);
  const [holding, setHolding] = useState(false);

  // Check session storage on mount.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === "1") {
        setVisible(false);
        return;
      }
    } catch {
      // sessionStorage can throw in some browser privacy modes — show anyway.
    }
  }, []);

  // Case ID is generated client-side (Math.random would mismatch SSR vs CSR).
  // Renders as a placeholder until the mount effect populates it.
  const [caseId, setCaseId] = useState<string>("----------");
  useEffect(() => {
    setCaseId(randomCaseId());
  }, []);

  const lines: Line[] = useMemo(
    () => [
      { text: "> INITIATING DECLASSIFIED ARCHIVE...", startAt: 100, cps: 90 },
      { text: "> ACCESSING 162 FILES...", startAt: 700, cps: 90 },
      { text: `> CASE #${caseId}`, startAt: 1300, cps: 90, className: "text-amber" },
      { text: "> ESTABLISHING CONNECTION...", startAt: 1900, cps: 90 },
      { text: "> ACCESS GRANTED", startAt: 2700, cps: 60, className: "text-phosphor shadow-phosphor" },
    ],
    [caseId]
  );

  // Schedule the dismiss + session-flag write.
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setHolding(true), 3700);
    const exit = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* noop */
      }
      setVisible(false);
    }, 4400);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(exit);
    };
  }, [visible]);

  // Skip on click / any key.
  useEffect(() => {
    if (!visible) return;
    const skip = () => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* noop */
      }
      setVisible(false);
    };
    const onKey = () => skip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="boot"
          onClick={() => {
            try {
              window.sessionStorage.setItem(SESSION_KEY, "1");
            } catch {
              /* noop */
            }
            setVisible(false);
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="absolute inset-0 z-50 flex cursor-pointer flex-col items-start justify-center bg-archive-void px-6 py-10 sm:px-12"
          role="dialog"
          aria-label="Boot sequence"
        >
          <div className="mx-auto w-full max-w-2xl">
            <div className="mb-6 flex items-center justify-between text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
              <span>declassified · terminal</span>
              <span className="caret" aria-hidden />
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <BootLine
                  key={i}
                  line={line}
                  isLast={i === lines.length - 1}
                  holding={holding}
                />
              ))}
            </div>
            <div className="mt-10 text-[9px] uppercase tracking-wider2 text-archive-paperDim/60">
              tap or press any key to skip · audio off by default
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function BootLine({
  line,
  isLast,
  holding,
}: {
  line: Line;
  isLast: boolean;
  holding: boolean;
}) {
  const [shown, setShown] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setStarted(true), line.startAt);
    return () => window.clearTimeout(t);
  }, [line.startAt]);

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setShown((s) => {
        const next = Math.min(line.text.length, s + line.cps * dt);
        if (next >= line.text.length) {
          // Tiny audio cue when the iconic "ACCESS GRANTED" lands.
          if (isLast) audio().ping();
          return line.text.length;
        }
        raf = requestAnimationFrame(tick);
        return next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, line.text.length, line.cps, isLast]);

  const flicker = isLast && holding ? "animate-flicker" : "";

  return (
    <div
      className={`text-[12px] tracking-wider2 mono-tight ${line.className ?? "text-archive-paper"} ${flicker}`}
    >
      {line.text.slice(0, Math.floor(shown))}
      {!started || shown < line.text.length ? <span className="caret" aria-hidden /> : null}
    </div>
  );
}
