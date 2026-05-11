import { CaseStamp } from "@/components/CaseStamp";
import { ClassificationStamp } from "@/components/ClassificationStamp";
import { GlobeMount } from "@/components/GlobeMount";
import { manifest, sightings } from "@/lib/data";
import { strangenessBucket } from "@/lib/strangeness";

export default function HomePage() {
  const buckets = { phosphor: 0, amber: 0, redalert: 0 };
  for (const s of sightings) buckets[strangenessBucket(s.strangenessScore)]++;
  const yearLo = new Date(manifest.dateRange[0]).getUTCFullYear();
  const yearHi = new Date(manifest.dateRange[1]).getUTCFullYear();

  return (
    <main className="relative h-screen w-full overflow-hidden bg-archive-void">
      {/* Globe — full-bleed canvas behind the chrome */}
      <GlobeMount sightings={sightings} />

      {/* Top-left: case ref */}
      <CaseStamp />

      {/* Top-right: classification stamp */}
      <ClassificationStamp />

      {/* Bottom-left: dataset readout */}
      <div className="absolute bottom-12 left-4 z-20 select-none border border-archive-line bg-archive-panel/80 px-3 py-2 backdrop-blur-sm">
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
      </div>

      {/* Bottom-right: interaction hint */}
      <div className="absolute bottom-12 right-4 z-20 select-none text-right text-[10px] uppercase tracking-wider2 text-archive-paperDim/80">
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
