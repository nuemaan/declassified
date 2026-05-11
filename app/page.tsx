import { CaseStamp } from "@/components/CaseStamp";
import { ClassificationStamp } from "@/components/ClassificationStamp";

export default function HomePage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <ClassificationStamp />
      <CaseStamp />

      {/* Centerpiece — placeholder for the globe scene */}
      <section className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <p className="text-archive-paperDim text-[10px] uppercase tracking-wider2 mono-tight">
          {">"} initiating archive interface
        </p>
        <h1 className="mt-3 text-center font-mono text-[44px] font-light leading-[1.05] tracking-tight md:text-[68px]">
          DE<span className="text-phosphor">CLASSIFIED</span>
        </h1>
        <p className="mt-4 max-w-xl text-center text-sm text-archive-paperDim mono-tight">
          162 files. Six decades. One archive. Built from the May 8, 2026
          Pentagon release. Open the dossier. Decide for yourself.
        </p>

        {/* Color token preview row — confirms the palette is wired */}
        <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-3">
          <Swatch label="CONFIRMED" hex="#00FF66" cls="bg-phosphor text-black shadow-phosphor" />
          <Swatch label="UNRESOLVED" hex="#FFA500" cls="bg-amber text-black shadow-amber" />
          <Swatch label="HIGH STRANGENESS" hex="#FF3333" cls="bg-redalert text-black shadow-redalert" />
        </div>

        <div className="mt-10 flex items-center gap-3 text-[11px] uppercase tracking-wider2 text-archive-paperDim">
          <span className="inline-block h-px w-10 bg-archive-paperDim/60" />
          <span>foundation step 1 / 12 — bootstrap online</span>
          <span className="inline-block h-px w-10 bg-archive-paperDim/60" />
        </div>
      </section>

      <footer className="absolute inset-x-0 bottom-3 z-10 px-6 text-center text-[10px] uppercase tracking-wider2 text-archive-paperDim/70 mono-tight">
        DATA SOURCE: war.gov/info &nbsp;•&nbsp; THIS IS A FAN PROJECT, NOT AFFILIATED WITH ANY GOVERNMENT.
      </footer>
    </main>
  );
}

function Swatch({ label, hex, cls }: { label: string; hex: string; cls: string }) {
  return (
    <div className="flex items-center justify-between border border-archive-line bg-archive-panel px-4 py-3">
      <span className={`inline-block h-3 w-3 rounded-full ${cls}`} aria-hidden />
      <span className="text-[11px] uppercase tracking-wider2 text-archive-paper">{label}</span>
      <span className="text-[10px] tracking-wider2 text-archive-paperDim">{hex}</span>
    </div>
  );
}
