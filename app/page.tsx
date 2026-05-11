import { AudioToggle } from "@/components/AudioToggle";
import { BootSequence } from "@/components/BootSequence";
import { CaseStamp } from "@/components/CaseStamp";
import { ClassificationStamp } from "@/components/ClassificationStamp";
import { ConnectionsToggle } from "@/components/ConnectionsToggle";
import { Dossier } from "@/components/Dossier";
import { FeaturedDossierButton } from "@/components/FeaturedDossierButton";
import { GlobeMount } from "@/components/GlobeMount";
import { LocalAnomalyButton } from "@/components/LocalAnomaly";
import { Timeline } from "@/components/Timeline";
import { manifest, sightings } from "@/lib/data";
import { strangenessBucket } from "@/lib/strangeness";

export default function HomePage() {
  const buckets = { phosphor: 0, amber: 0, redalert: 0 };
  for (const s of sightings) buckets[strangenessBucket(s.strangenessScore)]++;
  const yearLo = new Date(manifest.dateRange[0]).getUTCFullYear();
  const yearHi = new Date(manifest.dateRange[1]).getUTCFullYear();
  // Featured = top-strangeness case (Nimitz in the mock set).
  const featured = [...sightings].sort((a, b) => b.strangenessScore - a.strangenessScore)[0];

  return (
    <main className="relative h-screen w-full overflow-hidden bg-archive-void">
      {/* Globe — full-bleed canvas behind the chrome */}
      <GlobeMount sightings={sightings} />

      {/* Top-left: case ref */}
      <CaseStamp />

      {/* Top-right: classification stamp + audio toggle */}
      <ClassificationStamp />
      <div className="absolute right-4 top-12 z-20">
        <AudioToggle />
      </div>

      {/* Bottom-left: dataset readout (sits above the timeline strip) */}
      <div className="absolute bottom-36 left-4 z-20 w-[224px] select-none border border-archive-line bg-archive-panel/80 px-3 py-2 backdrop-blur-sm md:bottom-32">
        <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
          dataset · {manifest.source}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] mono-tight">
          <span className="text-archive-paper">{manifest.count} files</span>
          <span className="text-archive-paperDim">|</span>
          <span className="text-archive-paperDim">{yearLo}–{yearHi}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] tracking-wider2">
          <BucketChip count={buckets.phosphor} tone="phosphor" />
          <BucketChip count={buckets.amber} tone="amber" />
          <BucketChip count={buckets.redalert} tone="redalert" />
        </div>
        {featured ? <FeaturedDossierButton id={featured.id} label={featured.id} /> : null}
        <LocalAnomalyButton />
        <ConnectionsToggle />
      </div>

      {/* Dossier panel — slides in from the right when a sighting is selected */}
      <Dossier />

      {/* Timeline scrubber — bottom strip */}
      <Timeline />

      {/* Cinematic boot — covers everything until skipped or 3.7s elapsed */}
      <BootSequence />

      {/* Bottom-right: interaction hint (sits above the timeline strip) */}
      <div className="absolute bottom-36 right-4 z-20 select-none text-right text-[10px] uppercase tracking-wider2 text-archive-paperDim/80 md:bottom-32">
        <div>drag · spin</div>
        <div>scroll · zoom</div>
        <div>click · open dossier</div>
      </div>

      {/* Footer */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-3 z-20 px-6 text-center text-[10px] uppercase tracking-wider2 text-archive-paperDim/70 mono-tight">
        DATA SOURCE: war.gov/info &nbsp;•&nbsp; THIS IS A FAN PROJECT, NOT AFFILIATED WITH ANY GOVERNMENT.
      </footer>
    </main>
  );
}

function BucketChip({ count, tone }: { count: number; tone: "phosphor" | "amber" | "redalert" }) {
  const dot =
    tone === "phosphor"
      ? "bg-phosphor shadow-phosphor"
      : tone === "amber"
        ? "bg-amber shadow-amber"
        : "bg-redalert shadow-redalert";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <span className="text-archive-paper">{count}</span>
    </span>
  );
}
