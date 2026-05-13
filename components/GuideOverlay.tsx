"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { manifest } from "@/lib/data";

const SESSION_KEY = "declassified.guide.shown";

interface GuideOverlayProps {
  /** When true, the overlay is shown unconditionally — used by the corner button. */
  forceOpen?: boolean;
  /** Called when the overlay is closed. */
  onClose?: () => void;
}

/**
 * First-visit onboarding card. Auto-opens once per browser session;
 * accessible thereafter via the GUIDE button (top-right). Portals to
 * document.body so backdrop-filter ancestors can't clip it.
 */
export function GuideOverlay({ forceOpen, onClose }: GuideOverlayProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);

  // First-visit auto-open. Only when forceOpen isn't driving it.
  useEffect(() => {
    setTarget(document.body);
    if (forceOpen) return; // handled via prop
    try {
      const seen = window.sessionStorage.getItem(SESSION_KEY);
      if (seen !== "1") {
        // Defer until after the boot has had a moment to dismiss.
        const t = window.setTimeout(() => setOpen(true), 800);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* noop */
    }
  }, [forceOpen]);

  // ESC to close.
  useEffect(() => {
    if (!open && !forceOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, forceOpen]);

  const visible = forceOpen ? true : open;

  const close = () => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* noop */
    }
    setOpen(false);
    onClose?.();
  };

  if (!target) return null;

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="guide-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-archive-void/88 px-4 py-6 backdrop-blur-sm"
        >
          <motion.div
            key="guide-panel"
            initial={{ y: 12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 6, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.7, 0, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-xl overflow-y-auto border border-phosphor/40 bg-archive-panel shadow-phosphor"
            role="dialog"
            aria-label="DECLASSIFIED guide"
          >
            <header className="flex items-start justify-between gap-3 border-b border-archive-line px-5 py-3">
              <div>
                <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
                  archive interface
                </div>
                <div className="mt-0.5 font-mono text-[15px] uppercase tracking-wider2 text-archive-paper">
                  Welcome, investigator
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close guide"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-archive-line text-archive-paperDim hover:border-phosphor hover:text-phosphor"
              >
                <span className="text-[14px] leading-none">×</span>
              </button>
            </header>

            <div className="space-y-5 px-5 py-4 text-[13px] leading-relaxed text-archive-paper mono-tight">
              <p>
                <span className="text-phosphor">{manifest.count}</span> declassified UAP files —
                {" "}
                <span className="text-archive-paper">158</span> from the May 2026 Pentagon release at{" "}
                <span className="text-phosphor">war.gov/ufo</span>, plus{" "}
                <span className="text-graticule">20</span> curated USAF Project Blue Book cases
                (1947–69). Open the dossier. Decide for yourself.
              </p>

              <Section title="How to investigate">
                <Step n="01">
                  <strong className="text-phosphor">Drag</strong> the globe to spin ·{" "}
                  <strong className="text-phosphor">scroll</strong> to zoom ·{" "}
                  <strong className="text-phosphor">click</strong> any pulsing marker.
                </Step>
                <Step n="02">
                  Each dossier reveals its report with a typewriter animation. Click any{" "}
                  <span className="bg-archive-paper px-3 align-middle">&nbsp;&nbsp;</span> bar to{" "}
                  <strong className="text-phosphor">declassify</strong> the redacted text.
                </Step>
                <Step n="03">
                  Scrub the <strong className="text-phosphor">timeline</strong> (bottom) through
                  1947–2026 to filter by year. Press PLAY to watch the archive populate.
                </Step>
                <Step n="04">
                  Open <strong className="text-phosphor">FILTERS</strong> (left edge) to narrow
                  by agency, sensor, source, or strangeness.
                </Step>
                <Step n="05">
                  Toggle <strong className="text-graticule">CONNECTIONS</strong> to draw arcs
                  between cases with similar signatures.
                </Step>
                <Step n="06">
                  Click <strong className="text-redalert">MY LOCAL ANOMALY</strong> to find the
                  declassified case nearest your physical location.
                </Step>
              </Section>

              <Section title="AI Analyst — bring your own key">
                <p className="text-[12px]">
                  Plausibility analysis is powered by Claude. This site doesn&apos;t ship an API key.
                  Supply your own (stored only in your browser, sent only to Anthropic) — free
                  signup with a generous free tier at{" "}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-phosphor underline hover:text-phosphor/80"
                  >
                    console.anthropic.com
                  </a>
                  . The BYO-key panel is inside every dossier&apos;s AI Analyst section.
                </p>
              </Section>

              <div className="border-t border-archive-line pt-3 text-[10px] uppercase tracking-wider2 text-archive-paperDim/70">
                Redactions are a visualization device. Geocoded coordinates are approximate. Fan
                project — not affiliated with any government.
              </div>
            </div>

            <div className="border-t border-archive-line px-5 py-3">
              <button
                type="button"
                onClick={close}
                className="block w-full border border-phosphor/70 bg-phosphor/10 px-4 py-2 text-[11px] uppercase tracking-wider2 text-phosphor hover:bg-phosphor/20"
              >
                ▸ start exploring
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    target
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
        ▸ {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-[12px] text-archive-paper/95">
      <span className="flex-shrink-0 text-[10px] tabular-nums tracking-wider2 text-archive-paperDim">
        {n}
      </span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
