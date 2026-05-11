import { create } from "zustand";

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
}));
