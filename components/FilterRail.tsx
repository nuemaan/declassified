"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { getAllSightings } from "@/lib/data";
import { useArchive } from "@/lib/store";
import { strangenessBucket } from "@/lib/strangeness";
import type { Agency, Sighting, SightingType } from "@/lib/types";
import { loadUserSubmissions } from "@/lib/userSightings";
import { SubmitSightingButton } from "./SubmitSighting";

const AGENCIES: Agency[] = ["FBI", "DoD", "NASA", "State", "Other"];
const TYPES: SightingType[] = ["visual", "radar", "multi-sensor", "infrared", "photographic"];
const BUCKETS: Array<{ id: "phosphor" | "amber" | "redalert"; label: string; tone: string }> = [
  { id: "phosphor", label: "Routine / Explained", tone: "bg-phosphor shadow-phosphor" },
  { id: "amber", label: "Unresolved", tone: "bg-amber shadow-amber" },
  { id: "redalert", label: "High Strangeness", tone: "bg-redalert shadow-redalert" },
];

function toggleSetMembership<T>(current: ReadonlySet<T> | null, all: T[], value: T): ReadonlySet<T> | null {
  // null means "all". First toggle starts from the full set.
  const base = current ?? new Set<T>(all);
  const next = new Set(base);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  // If user just unchecked the last one, treat as null (all-off-equals-all) → no, keep empty
  // because "everything filtered out" is a valid intention. The user can hit RESET.
  if (next.size === all.length) return null; // collapsing back to "all" wipes the filter
  return next;
}

function isActive<T>(current: ReadonlySet<T> | null, value: T): boolean {
  if (current === null) return true;
  return current.has(value);
}

export function FilterRail() {
  const open = useArchive((s) => s.filterRailOpen);
  const close = useArchive((s) => s.toggleFilterRail);
  const agencyFilter = useArchive((s) => s.agencyFilter);
  const typeFilter = useArchive((s) => s.typeFilter);
  const bucketFilter = useArchive((s) => s.bucketFilter);
  const setAgencyFilter = useArchive((s) => s.setAgencyFilter);
  const setTypeFilter = useArchive((s) => s.setTypeFilter);
  const setBucketFilter = useArchive((s) => s.setBucketFilter);
  const resetFilters = useArchive((s) => s.resetFilters);
  const revealedThrough = useArchive((s) => s.revealedThrough);

  const [userSightings, setUserSightings] = useState<Sighting[]>([]);

  // Mirror localStorage user submissions into state so the count is live.
  useEffect(() => {
    setUserSightings(loadUserSubmissions());
    const onChange = () => setUserSightings(loadUserSubmissions());
    window.addEventListener("declassified:user-sightings-changed", onChange);
    return () => window.removeEventListener("declassified:user-sightings-changed", onChange);
  }, []);

  // Live filtered-count badge, including all dimensions (timeline + filters).
  const counts = useMemo(() => {
    const all = [...getAllSightings(), ...userSightings];
    const filtered = all.filter((s) => {
      if (s.date > revealedThrough) return false;
      if (agencyFilter !== null && !agencyFilter.has(s.agency)) return false;
      if (typeFilter !== null && !typeFilter.has(s.type)) return false;
      if (bucketFilter !== null && !bucketFilter.has(strangenessBucket(s.strangenessScore))) return false;
      return true;
    });
    return { visible: filtered.length, total: all.length };
  }, [agencyFilter, typeFilter, bucketFilter, revealedThrough, userSightings]);

  const anyActive =
    agencyFilter !== null || typeFilter !== null || bucketFilter !== null;

  return (
    <>
      {/* Edge tab — visible whether the rail is open or closed */}
      <button
        type="button"
        onClick={close}
        aria-expanded={open}
        aria-label={open ? "Close filter rail" : "Open filter rail"}
        className={`absolute top-32 z-30 border border-archive-line bg-archive-panel/90 px-2 py-3 text-[9px] uppercase tracking-wider2 backdrop-blur-md transition-all hover:border-phosphor hover:text-phosphor ${
          open
            ? "left-72 text-archive-paperDim"
            : `left-0 ${anyActive ? "border-l-0 text-phosphor" : "border-l-0 text-archive-paperDim"}`
        }`}
      >
        <span
          aria-hidden
          className="block"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {open ? "◂ close filters" : `▸ filters · ${counts.visible}/${counts.total}`}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.aside
            key="filter-rail"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.28, ease: [0.7, 0, 0.3, 1] }}
            className="absolute left-0 top-0 z-30 flex h-screen w-72 flex-col border-r border-archive-line bg-archive-panel/95 backdrop-blur-md"
            role="dialog"
            aria-label="Filter rail"
          >
            <header className="flex items-center justify-between border-b border-archive-line px-4 py-3">
              <div>
                <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">filters</div>
                <div className="text-[12px] uppercase tracking-wider2 text-archive-paper mono-tight">
                  {counts.visible} / {counts.total}
                </div>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                disabled={!anyActive}
                className="border border-archive-line px-2 py-1 text-[9px] uppercase tracking-wider2 text-archive-paperDim hover:border-redalert hover:text-redalert disabled:opacity-30"
              >
                reset
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <Section label="Agency">
                {AGENCIES.map((a) => (
                  <CheckChip
                    key={a}
                    label={a}
                    active={isActive(agencyFilter, a)}
                    onToggle={() => setAgencyFilter(toggleSetMembership(agencyFilter, AGENCIES, a))}
                  />
                ))}
              </Section>

              <Section label="Sensor type">
                {TYPES.map((t) => (
                  <CheckChip
                    key={t}
                    label={t}
                    active={isActive(typeFilter, t)}
                    onToggle={() => setTypeFilter(toggleSetMembership(typeFilter, TYPES, t))}
                  />
                ))}
              </Section>

              <Section label="Strangeness">
                <div className="space-y-1.5">
                  {BUCKETS.map((b) => (
                    <BucketRow
                      key={b.id}
                      label={b.label}
                      tone={b.tone}
                      active={isActive(bucketFilter, b.id)}
                      onToggle={() => setBucketFilter(toggleSetMembership(bucketFilter, ["phosphor", "amber", "redalert"], b.id))}
                    />
                  ))}
                </div>
              </Section>

              <SubmitSightingButton userCount={userSightings.length} />
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 first:mt-0">
      <h3 className="mb-2 text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
        ▸ {label}
      </h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function CheckChip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`border px-2 py-1 text-[10px] uppercase tracking-wider2 transition-colors ${
        active
          ? "border-phosphor/70 bg-phosphor/10 text-phosphor"
          : "border-archive-line bg-archive-void/40 text-archive-paperDim/70 hover:border-archive-paper/40 hover:text-archive-paper"
      }`}
    >
      {label}
    </button>
  );
}

function BucketRow({
  label,
  tone,
  active,
  onToggle,
}: {
  label: string;
  tone: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`flex w-full items-center gap-2 border px-2 py-1.5 text-[10px] uppercase tracking-wider2 transition-colors ${
        active
          ? "border-archive-paper/40 bg-archive-void/40 text-archive-paper"
          : "border-archive-line bg-archive-void/20 text-archive-paperDim/50"
      }`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${tone} ${active ? "" : "opacity-30"}`} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
