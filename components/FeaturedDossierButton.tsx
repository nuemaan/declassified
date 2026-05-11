"use client";

import { useArchive } from "@/lib/store";

interface FeaturedDossierButtonProps {
  /** Sighting ID to open. */
  id: string;
  /** Short label shown to the reader. */
  label: string;
}

export function FeaturedDossierButton({ id, label }: FeaturedDossierButtonProps) {
  const setSelected = useArchive((s) => s.setSelected);
  return (
    <button
      type="button"
      onClick={() => setSelected(id)}
      title={`Open featured dossier — ${label}`}
      className="mt-2 inline-flex w-full items-center justify-between gap-2 border border-archive-line bg-archive-void/40 px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-phosphor/90 hover:border-phosphor/60 hover:bg-phosphor/5"
    >
      <span className="truncate">▸ featured</span>
      <span className="truncate text-archive-paperDim/80">{label}</span>
    </button>
  );
}
