import { create } from "zustand";
import type { Agency, SightingType } from "./types";

type Bucket = "phosphor" | "amber" | "redalert";

interface ArchiveState {
  /** ID of the currently focused sighting, or null. Drives the dossier panel. */
  selectedSightingId: string | null;
  setSelected: (id: string | null) => void;

  /** True when audio playback is enabled. Off by default. */
  audioEnabled: boolean;
  toggleAudio: () => void;
  setAudioEnabled: (v: boolean) => void;

  /** Timeline scrubber position (ISO date). Filters markers visible on globe. */
  revealedThrough: string;
  setRevealedThrough: (iso: string) => void;

  /** True when the user is dragging the globe — pauses auto-rotate. */
  globeInteracting: boolean;
  setGlobeInteracting: (v: boolean) => void;

  /** True when Connections mode is on — draws arcs between similar sightings. */
  connectionsEnabled: boolean;
  toggleConnections: () => void;

  /** Filter rail state. `null` for a dimension means "all". */
  filterRailOpen: boolean;
  agencyFilter: ReadonlySet<Agency> | null;
  typeFilter: ReadonlySet<SightingType> | null;
  bucketFilter: ReadonlySet<Bucket> | null;
  toggleFilterRail: () => void;
  setAgencyFilter: (next: ReadonlySet<Agency> | null) => void;
  setTypeFilter: (next: ReadonlySet<SightingType> | null) => void;
  setBucketFilter: (next: ReadonlySet<Bucket> | null) => void;
  resetFilters: () => void;
}

const DEFAULT_END = "2026-12-31";

export const useArchive = create<ArchiveState>((set) => ({
  selectedSightingId: null,
  setSelected: (id) => set({ selectedSightingId: id }),

  audioEnabled: false,
  toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),
  setAudioEnabled: (v) => set({ audioEnabled: v }),

  revealedThrough: DEFAULT_END,
  setRevealedThrough: (iso) => set({ revealedThrough: iso }),

  globeInteracting: false,
  setGlobeInteracting: (v) => set({ globeInteracting: v }),

  connectionsEnabled: false,
  toggleConnections: () => set((s) => ({ connectionsEnabled: !s.connectionsEnabled })),

  filterRailOpen: false,
  agencyFilter: null,
  typeFilter: null,
  bucketFilter: null,
  toggleFilterRail: () => set((s) => ({ filterRailOpen: !s.filterRailOpen })),
  setAgencyFilter: (next) => set({ agencyFilter: next }),
  setTypeFilter: (next) => set({ typeFilter: next }),
  setBucketFilter: (next) => set({ bucketFilter: next }),
  resetFilters: () =>
    set({ agencyFilter: null, typeFilter: null, bucketFilter: null }),
}));
