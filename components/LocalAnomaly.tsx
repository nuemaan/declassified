"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { audio } from "@/lib/audio";
import { getAllSightings } from "@/lib/data";
import { formatDistance, nearestSighting, type NearestResult } from "@/lib/geo";
import { useArchive } from "@/lib/store";

type Phase = "idle" | "locating" | "denied" | "unavailable" | "result";

const STORAGE_NAME_KEY = "declassified.investigator";

function siteOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function shareUrl(sightingId: string, name: string): string {
  const u = new URL(`${siteOrigin()}/sighting/${encodeURIComponent(sightingId)}`);
  if (name.trim()) u.searchParams.set("i", name.trim().slice(0, 32));
  return u.toString();
}

export function LocalAnomalyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex w-full items-center justify-between gap-2 border border-redalert/60 bg-redalert/10 px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-redalert hover:bg-redalert/20"
      >
        <span>▸ my local anomaly</span>
        <span className="text-redalert/70">find</span>
      </button>
      <LocalAnomalyModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function LocalAnomalyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [name, setName] = useState("");
  const [result, setResult] = useState<NearestResult | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const setSelected = useArchive((s) => s.setSelected);

  // Restore the investigator name from prior visits.
  useEffect(() => {
    if (!open) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_NAME_KEY);
      if (stored) setName(stored);
    } catch {
      /* noop */
    }
  }, [open]);

  // Persist name as it changes (without firing every keystroke too aggressively).
  useEffect(() => {
    if (!name) return;
    try {
      window.localStorage.setItem(STORAGE_NAME_KEY, name);
    } catch {
      /* noop */
    }
  }, [name]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const run = () => {
    if (!("geolocation" in navigator)) {
      setPhase("unavailable");
      setErrorText("Your browser doesn't expose a geolocation API.");
      return;
    }
    setPhase("locating");
    setErrorText(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const sightings = getAllSightings();
        const near = nearestSighting(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          sightings
        );
        if (!near) {
          setPhase("unavailable");
          setErrorText("No sightings in the archive — try again later.");
          return;
        }
        setResult(near);
        setPhase("result");
        audio().ping();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPhase("denied");
        } else {
          setPhase("unavailable");
          setErrorText(err.message || "Couldn't read your location.");
        }
      },
      { timeout: 9000, maximumAge: 60_000, enableHighAccuracy: false }
    );
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setErrorText(null);
  };

  // Track when the portal target is mounted so SSR / first render is safe.
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="anomaly-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-archive-void/85 px-4 py-6 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="anomaly-modal"
            role="dialog"
            aria-label="Your local anomaly"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.7, 0, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-md overflow-y-auto border border-archive-line bg-archive-panel"
          >
            <header className="flex items-center justify-between border-b border-archive-line px-4 py-2.5">
              <div>
                <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">request</div>
                <div className="text-[12px] uppercase tracking-wider2 text-archive-paper mono-tight">
                  your local anomaly
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center border border-archive-line text-archive-paperDim hover:border-redalert hover:text-redalert"
              >
                <span className="text-[14px] leading-none">×</span>
              </button>
            </header>

            <div className="px-4 py-4">
              {phase === "idle" ? (
                <IdleForm name={name} setName={setName} onRun={run} />
              ) : phase === "locating" ? (
                <LocatingState />
              ) : phase === "denied" ? (
                <ErrorState
                  title="Location denied"
                  body="Without coordinates we can't compute distance. You can still browse the archive on the globe."
                  onRetry={() => setPhase("idle")}
                />
              ) : phase === "unavailable" ? (
                <ErrorState
                  title="Geolocation unavailable"
                  body={errorText ?? "Something didn't work — try again."}
                  onRetry={() => setPhase("idle")}
                />
              ) : result ? (
                <ResultState
                  result={result}
                  name={name}
                  onReset={reset}
                  onOpenDossier={() => {
                    setSelected(result.sighting.id);
                    onClose();
                  }}
                />
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalTarget
  );
}

function IdleForm({
  name,
  setName,
  onRun,
}: {
  name: string;
  setName: (n: string) => void;
  onRun: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[12px] text-archive-paper mono-tight">
        We use your device coordinates once to find the closest declassified
        case to your position. Coordinates never leave your browser.
      </p>

      <label className="block text-[10px] uppercase tracking-wider2 text-archive-paperDim/80">
        <span>Investigator name (optional)</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="agent _____"
          maxLength={32}
          className="mt-1 block w-full border border-archive-line bg-archive-void px-2 py-1.5 text-[12px] uppercase tracking-wider2 text-archive-paper outline-none placeholder:text-archive-paperDim/40 focus:border-phosphor"
        />
      </label>

      <button
        type="button"
        onClick={onRun}
        className="block w-full border border-redalert/70 bg-redalert/10 px-3 py-2 text-[11px] uppercase tracking-wider2 text-redalert hover:bg-redalert/20"
      >
        ▸ declassify my area
      </button>
    </div>
  );
}

function LocatingState() {
  return (
    <div className="space-y-3 py-6 text-center">
      <div className="text-[10px] uppercase tracking-wider2 text-archive-paperDim/80">
        triangulating…
      </div>
      <div className="text-[12px] text-archive-paper mono-tight">
        Awaiting browser permission. <span className="caret" aria-hidden />
      </div>
    </div>
  );
}

function ErrorState({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider2 text-amber/90">{title}</div>
      <p className="text-[12px] text-archive-paper mono-tight">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="block w-full border border-archive-line bg-archive-void px-3 py-2 text-[11px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:text-phosphor"
      >
        ▸ try again
      </button>
    </div>
  );
}

function ResultState({
  result,
  name,
  onReset,
  onOpenDossier,
}: {
  result: NearestResult;
  name: string;
  onReset: () => void;
  onOpenDossier: () => void;
}) {
  const { sighting, distanceKm } = result;
  const investigator = (name.trim() || "Unknown").toUpperCase();
  const url = shareUrl(sighting.id, name);
  const region = sighting.location.region ?? sighting.location.country;

  const shareText = `My closest declassified anomaly: ${region} · ${sighting.date}. ${formatDistance(distanceKm)} from me.`;

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider2 text-archive-paperDim/80">
        nearest case
      </div>

      {/* Share card preview — mirrors the layout used by /api/og */}
      <div className="border border-redalert/40 bg-archive-void p-3 shadow-redalert">
        <div className="flex items-start justify-between text-[8px] uppercase tracking-wider2">
          <span className="text-redalert">DE<span className="text-archive-paper">CLASSIFIED</span></span>
          <span className="border border-phosphor/70 px-1 py-0.5 text-phosphor">
            classification: public
          </span>
        </div>
        <div className="mt-2 text-[18px] leading-tight text-archive-paper mono-tight">
          {region}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wider2 text-archive-paperDim/90">
          {sighting.date} · {sighting.agency} · {sighting.type}
        </div>
        <div className="mt-2 text-[10px] text-archive-paper/90 mono-tight">
          <span className="text-redalert">{formatDistance(distanceKm)}</span> from your position.
          {sighting.hook ? <> &nbsp;<span className="italic text-amber">{sighting.hook}</span></> : null}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-archive-line pt-2 text-[8px] uppercase tracking-wider2 text-archive-paperDim/70">
          <span>investigator · {investigator}</span>
          <span>{sighting.id}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenDossier}
          className="border border-archive-line bg-archive-void px-3 py-2 text-[10px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:text-phosphor"
        >
          ▸ open dossier
        </button>
        <button
          type="button"
          onClick={onReset}
          className="border border-archive-line bg-archive-void px-3 py-2 text-[10px] uppercase tracking-wider2 text-archive-paperDim hover:border-archive-paper hover:text-archive-paper"
        >
          ▸ retry
        </button>
      </div>

      <ShareRow url={url} text={shareText} />
    </div>
  );
}

function ShareRow({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
  return (
    <div className="space-y-1.5">
      <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/70">share</div>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center border border-archive-line bg-archive-void px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:text-phosphor"
        >
          ▸ post to x
        </a>
        <a
          href={redditUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center border border-archive-line bg-archive-void px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:text-phosphor"
        >
          ▸ post to reddit
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              /* noop */
            }
          }}
          className="flex items-center justify-center border border-archive-line bg-archive-void px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:text-phosphor"
        >
          {copied ? "▸ copied" : "▸ copy link"}
        </button>
      </div>
    </div>
  );
}
