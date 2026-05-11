import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSighting } from "@/lib/data";
import { strangenessBucket } from "@/lib/strangeness";

interface PageProps {
  params: { id: string };
  searchParams: { i?: string };
}

export function generateMetadata({ params, searchParams }: PageProps): Metadata {
  const s = getSighting(params.id);
  if (!s) {
    return {
      title: "Case not found — DECLASSIFIED",
    };
  }
  const region = s.location.region ?? s.location.country;
  const title = `${region} · ${s.date} — DECLASSIFIED`;
  const description = s.description.slice(0, 160);
  const investigator = searchParams.i ? `&i=${encodeURIComponent(searchParams.i)}` : "";
  const ogUrl = `/api/og?id=${encodeURIComponent(s.id)}${investigator}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

const BUCKET_RING: Record<"phosphor" | "amber" | "redalert", string> = {
  phosphor: "border-phosphor text-phosphor shadow-phosphor",
  amber: "border-amber text-amber shadow-amber",
  redalert: "border-redalert text-redalert shadow-redalert",
};

const BUCKET_LABEL: Record<"phosphor" | "amber" | "redalert", string> = {
  phosphor: "ROUTINE / EXPLAINED",
  amber: "UNRESOLVED",
  redalert: "HIGH STRANGENESS",
};

export default function SightingPage({ params, searchParams }: PageProps) {
  const s = getSighting(params.id);
  if (!s) notFound();

  const investigator = (searchParams.i ?? "").trim().toUpperCase().slice(0, 32);
  const bucket = strangenessBucket(s.strangenessScore);
  const region = s.location.region ?? s.location.country;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-archive-void">
      <div className="pointer-events-none absolute right-4 top-4 z-20">
        <div className="border border-phosphor/70 px-2.5 py-1 text-[10px] uppercase tracking-wider2 text-phosphor/90 shadow-phosphor">
          Classification: Public
        </div>
      </div>

      <div className="pointer-events-none absolute left-4 top-4 z-20 text-[10px] uppercase tracking-wider2 text-archive-paperDim/80">
        <div>file ref</div>
        <div className="mt-0.5 text-archive-paper/90">{s.id}</div>
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
        <div className={`inline-block self-start border px-2 py-1 text-[10px] uppercase tracking-wider2 ${BUCKET_RING[bucket]}`}>
          {BUCKET_LABEL[bucket]}
        </div>
        <h1 className="mt-4 font-mono text-[44px] font-light leading-[1.05] tracking-tight md:text-[64px]">
          DE<span className="text-phosphor">CLASSIFIED</span>
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wider2 text-archive-paperDim">
          <span>{s.date}</span>
          <span>·</span>
          <span>{s.agency}</span>
          <span>·</span>
          <span>{s.type}</span>
          <span>·</span>
          <span>strangeness {s.strangenessScore}/10</span>
        </div>

        <div className="mt-8 text-phosphor">
          <div className="text-[28px] tracking-tight md:text-[36px]">{region}</div>
          <div className="text-[10px] uppercase tracking-wider2 text-archive-paperDim/70">
            {s.location.lat.toFixed(2)}°, {s.location.lng.toFixed(2)}° · {s.location.precision}
          </div>
        </div>

        <p className="mt-6 max-w-[60ch] text-[15px] leading-relaxed text-archive-paper mono-tight">
          {s.description}
        </p>

        {s.hook ? (
          <div className="mt-6 border-l border-amber/60 pl-4 text-[13px] italic text-amber">
            {s.hook}
          </div>
        ) : null}

        {investigator ? (
          <div className="mt-10 flex items-center gap-3 text-[11px] uppercase tracking-wider2 text-archive-paperDim/80">
            <span className="inline-block h-px w-10 bg-archive-paperDim/60" />
            <span>investigator · {investigator}</span>
            <span className="inline-block h-px w-10 bg-archive-paperDim/60" />
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-3 text-[10px] uppercase tracking-wider2">
          <Link
            href="/"
            className="border border-archive-line bg-archive-panel px-3 py-2 text-archive-paper hover:border-phosphor hover:text-phosphor"
          >
            ▸ explore the archive
          </Link>
        </div>
      </section>

      <footer className="absolute inset-x-0 bottom-3 z-10 px-6 text-center text-[10px] uppercase tracking-wider2 text-archive-paperDim/70 mono-tight">
        DATA SOURCE: war.gov/info &nbsp;·&nbsp; THIS IS A FAN PROJECT, NOT AFFILIATED WITH ANY GOVERNMENT.
      </footer>
    </main>
  );
}
