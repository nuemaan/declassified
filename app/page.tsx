import { CaseStamp } from "@/components/CaseStamp";
import { ClassificationStamp } from "@/components/ClassificationStamp";
import { manifest, sightings } from "@/lib/data";
import { strangenessBucket } from "@/lib/strangeness";
import { pairsAbove } from "@/lib/similarity";

export default function HomePage() {
  const buckets = { phosphor: 0, amber: 0, redalert: 0 };
  for (const s of sightings) buckets[strangenessBucket(s.strangenessScore)]++;
  const arcCount = pairsAbove(0.2).length;
  const yearLo = new Date(manifest.dateRange[0]).getUTCFullYear();
  const yearHi = new Date(manifest.dateRange[1]).getUTCFullYear();

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <ClassificationStamp />
      <CaseStamp />

      <section className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <p className="text-archive-paperDim text-[10px] uppercase tracking-wider2 mono-tight">
          {">"} archive interface online
        </p>
        <h1 className="mt-3 text-center font-mono text-[44px] font-light leading-[1.05] tracking-tight md:text-[68px]">
          DE<span className="text-phosphor">CLASSIFIED</span>
        </h1>
        <p className="mt-4 max-w-xl text-center text-sm text-archive-paperDim mono-tight">
          {manifest.count} files. {yearHi - yearLo} years. One archive.
          {" "}Built from the May 8, 2026 Pentagon release. Open the dossier. Decide for yourself.
        </p>

        {/* Dataset readout — proves the pipeline is wired through to the UI */}
        <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden border border-archive-line bg-archive-line md:grid-cols-4">
          <Cell label="Records" value={String(manifest.count)} />
          <Cell label="Range" value={`${yearLo} → ${yearHi}`} />
          <Cell label="Source" value={manifest.source.toUpperCase()} tone={manifest.source === "mock" ? "warn" : undefined} />
          <Cell label="Connections" value={String(arcCount)} />
        </div>

        <div className="mt-3 grid w-full max-w-3xl grid-cols-3 gap-px overflow-hidden border border-archive-line bg-archive-line">
          <Bucket label="Confirmed" count={buckets.phosphor} tone="phosphor" />
          <Bucket label="Unresolved" count={buckets.amber} tone="amber" />
          <Bucket label="High Strangeness" count={buckets.redalert} tone="redalert" />
        </div>

        {/* Sample dossier — confirms record shape end-to-end */}
        <div className="mt-8 w-full max-w-3xl border border-archive-line bg-archive-panel p-5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider2 text-archive-paperDim">
            <span>Sample dossier</span>
            <span>{topRed(sightings)?.id ?? "—"}</span>
          </div>
          <SampleDossier />
        </div>

        <div className="mt-10 flex items-center gap-3 text-[11px] uppercase tracking-wider2 text-archive-paperDim">
          <span className="inline-block h-px w-10 bg-archive-paperDim/60" />
          <span>foundation step 2 / 12 — data pipeline online ({manifest.source})</span>
          <span className="inline-block h-px w-10 bg-archive-paperDim/60" />
        </div>
      </section>

      <footer className="absolute inset-x-0 bottom-3 z-10 px-6 text-center text-[10px] uppercase tracking-wider2 text-archive-paperDim/70 mono-tight">
        DATA SOURCE: war.gov/info &nbsp;•&nbsp; THIS IS A FAN PROJECT, NOT AFFILIATED WITH ANY GOVERNMENT.
      </footer>
    </main>
  );
}

function topRed(s: typeof sightings) {
  return [...s].sort((a, b) => b.strangenessScore - a.strangenessScore)[0];
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  const valueColor = tone === "warn" ? "text-amber" : "text-archive-paper";
  return (
    <div className="bg-archive-panel px-4 py-3">
      <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">{label}</div>
      <div className={`mt-1 text-sm ${valueColor}`}>{value}</div>
    </div>
  );
}

function Bucket({ label, count, tone }: { label: string; count: number; tone: "phosphor" | "amber" | "redalert" }) {
  const dot = tone === "phosphor" ? "bg-phosphor shadow-phosphor" : tone === "amber" ? "bg-amber shadow-amber" : "bg-redalert shadow-redalert";
  return (
    <div className="flex items-center gap-3 bg-archive-panel px-4 py-3">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
      <div className="flex-1">
        <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">{label}</div>
        <div className="text-sm text-archive-paper">{count}</div>
      </div>
    </div>
  );
}

function SampleDossier() {
  const s = [...sightings].sort((a, b) => b.strangenessScore - a.strangenessScore)[0];
  if (!s) return null;
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-3 text-[10px] uppercase tracking-wider2 text-archive-paperDim/90">
        <span>{s.date}</span>
        <span>{s.agency}</span>
        <span className="text-right">{s.type}</span>
      </div>
      <div className="text-[13px] text-archive-paper mono-tight">
        <span className="text-phosphor">{s.location.region ?? s.location.country}</span>
        {" — "}
        {s.description}
      </div>
      {s.hook ? (
        <div className="border-l border-amber/60 pl-3 text-[12px] italic text-amber">{s.hook}</div>
      ) : null}
    </div>
  );
}
