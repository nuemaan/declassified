"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { AIAnalyst } from "./AIAnalyst";
import { audio } from "@/lib/audio";
import { redactionsFor, segmentDescription } from "@/lib/redactions";
import { getSighting } from "@/lib/data";
import { topMatches } from "@/lib/similarity";
import { strangenessBucket } from "@/lib/strangeness";
import { useArchive } from "@/lib/store";
import { TypewriterSegments } from "./Typewriter";

const BUCKET_LABEL: Record<"phosphor" | "amber" | "redalert", string> = {
  phosphor: "ROUTINE / EXPLAINED",
  amber: "UNRESOLVED",
  redalert: "HIGH STRANGENESS",
};

const BUCKET_RING: Record<"phosphor" | "amber" | "redalert", string> = {
  phosphor: "border-phosphor text-phosphor shadow-phosphor",
  amber: "border-amber text-amber shadow-amber",
  redalert: "border-redalert text-redalert shadow-redalert",
};

export function Dossier() {
  const selectedId = useArchive((s) => s.selectedSightingId);
  const setSelected = useArchive((s) => s.setSelected);

  const sighting = selectedId ? getSighting(selectedId) : undefined;

  // Close on Escape.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, setSelected]);

  // Audio cue when a dossier opens (a single clack — not per character).
  useEffect(() => {
    if (selectedId) audio().clack();
  }, [selectedId]);

  // Precompute redactions and segment the description.
  const segments = useMemo(() => {
    if (!sighting) return [];
    const r = redactionsFor(sighting);
    return segmentDescription(sighting.description, r);
  }, [sighting]);

  return (
    <AnimatePresence>
      {sighting ? (
        <motion.aside
          key={sighting.id}
          initial={{ x: "100%", opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.6 }}
          transition={{ duration: 0.35, ease: [0.7, 0, 0.3, 1] }}
          className="absolute right-0 top-0 z-30 flex h-screen w-full flex-col border-l border-archive-line bg-archive-panel/95 backdrop-blur-md md:w-[460px]"
          role="dialog"
          aria-label={`Dossier ${sighting.id}`}
        >
          <DossierHeader
            id={sighting.id}
            bucket={strangenessBucket(sighting.strangenessScore)}
            score={sighting.strangenessScore}
            onClose={() => setSelected(null)}
          />

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <DossierMeta
              date={sighting.date}
              dateConfidence={sighting.dateConfidence}
              location={sighting.location}
              agency={sighting.agency}
              type={sighting.type}
              duration={sighting.durationMinutes}
              confidence={sighting.confidence}
            />

            <Section title="Original description">
              <div className="text-[13px] leading-[1.6] text-archive-paper mono-tight">
                <TypewriterSegments
                  key={sighting.id}
                  segments={segments}
                  resetKey={sighting.id}
                  cps={90}
                />
              </div>
            </Section>

            {sighting.witnesses && sighting.witnesses.length > 0 ? (
              <Section title="Witnesses">
                <ul className="space-y-1 text-[12px] text-archive-paper mono-tight">
                  {sighting.witnesses.map((w, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="inline-block h-px w-3 bg-archive-paperDim/60" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {sighting.hook ? (
              <Section title="Curator's note">
                <div className="border-l border-amber/60 pl-3 text-[12px] italic text-amber mono-tight">
                  {sighting.hook}
                </div>
              </Section>
            ) : null}

            <Section title="AI analyst">
              <AIAnalyst sightingId={sighting.id} />
            </Section>

            <Section title="Connections">
              <ConnectionsList sightingId={sighting.id} onJump={(id) => setSelected(id)} />
            </Section>

            <div className="mt-6 border-t border-archive-line pt-3 text-[9px] uppercase leading-relaxed tracking-wider2 text-archive-paperDim/70">
              Redactions in this dossier are a visualization device. Source
              files were released without these specific blackbars. Click
              any bar to declassify.
            </div>
          </div>

          <DossierFooter id={sighting.id} sourceFile={sighting.sourceFile} />
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function DossierHeader({
  id,
  bucket,
  score,
  onClose,
}: {
  id: string;
  bucket: "phosphor" | "amber" | "redalert";
  score: number;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-archive-line px-5 py-3">
      <div className="flex items-center gap-3">
        <div className={`border px-2 py-1 text-[9px] uppercase tracking-wider2 ${BUCKET_RING[bucket]}`}>
          {BUCKET_LABEL[bucket]}
        </div>
        <div className="text-[10px] uppercase tracking-wider2 text-archive-paperDim/80">
          strangeness {score}/10
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-[10px] uppercase tracking-wider2 text-archive-paper/80 mono-tight">
          {id}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dossier"
          className="-mr-1 flex h-7 w-7 items-center justify-center border border-archive-line text-archive-paperDim hover:border-redalert hover:text-redalert"
        >
          <span className="text-[16px] leading-none">×</span>
        </button>
      </div>
    </div>
  );
}

function DossierMeta({
  date,
  dateConfidence,
  location,
  agency,
  type,
  duration,
  confidence,
}: {
  date: string;
  dateConfidence: "exact" | "month" | "year";
  location: { country: string; region?: string; lat: number; lng: number; precision: "exact" | "approximate" };
  agency: string;
  type: string;
  duration: number;
  confidence: number;
}) {
  const dateLabel = dateConfidence === "exact" ? date : dateConfidence === "month" ? date.slice(0, 7) : date.slice(0, 4);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border border-archive-line bg-archive-void/60 px-4 py-3">
      <MetaCell label="Date" value={dateLabel} hint={dateConfidence !== "exact" ? `${dateConfidence}-level` : undefined} />
      <MetaCell label="Agency" value={agency} />
      <MetaCell
        label="Location"
        value={location.region ?? location.country}
        hint={`${location.lat.toFixed(2)}°, ${location.lng.toFixed(2)}° · ${location.precision}`}
      />
      <MetaCell label="Sensor" value={type.toUpperCase()} />
      <MetaCell label="Duration" value={duration === 0 ? "—" : `${duration} min`} />
      <MetaCell label="Confidence" value={`${Math.round(confidence * 100)}%`} />
    </dl>
  );
}

function MetaCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">{label}</dt>
      <dd className="mt-0.5 text-[12px] text-archive-paper mono-tight">{value}</dd>
      {hint ? <dd className="text-[9px] tracking-wider2 text-archive-paperDim/70">{hint}</dd> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
        ▸ {title}
      </h3>
      {children}
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-archive-line bg-archive-void/40 px-3 py-2 text-[11px] text-archive-paperDim mono-tight">
      {children}
    </div>
  );
}

function ConnectionsList({ sightingId, onJump }: { sightingId: string; onJump: (id: string) => void }) {
  const matches = topMatches(sightingId, 5);
  if (matches.length === 0) {
    return (
      <Placeholder>No correlated cases at the current similarity threshold.</Placeholder>
    );
  }
  return (
    <ul className="space-y-1.5">
      {matches.map((m) => {
        const s = getSighting(m.id);
        if (!s) return null;
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onJump(m.id)}
              className="group flex w-full items-start justify-between gap-2 border border-archive-line bg-archive-void/40 px-2 py-1.5 text-left hover:border-graticule/60"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-archive-paper mono-tight">
                  {s.location.region ?? s.location.country}
                </div>
                <div className="text-[9px] tracking-wider2 text-archive-paperDim/80">
                  {s.date} · {s.agency} · {s.type}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-wider2 text-graticule/80 group-hover:text-graticule">
                  ▸ open
                </div>
                <div className="text-[9px] tabular-nums text-archive-paperDim/70">
                  {(m.score * 100).toFixed(0)}%
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DossierFooter({ id, sourceFile }: { id: string; sourceFile: string }) {
  return (
    <div className="flex items-center justify-between border-t border-archive-line px-5 py-3 text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
      <span>{sourceFile}</span>
      <span>{id}</span>
    </div>
  );
}
