"use client";

import type { Sighting } from "./types";

const STORAGE_KEY = "declassified.user-submissions.v1";

/**
 * Approved user submissions are kept in this browser's localStorage. There's
 * no shared backend, so every reader sees their own approved set.
 */
export function loadUserSubmissions(): Sighting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Sighting[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s === "object" && typeof s.id === "string");
  } catch {
    return [];
  }
}

export function saveUserSubmission(s: Sighting): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadUserSubmissions();
    // Replace by id if it already exists.
    const next = [...current.filter((c) => c.id !== s.id), s];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("declassified:user-sightings-changed"));
  } catch {
    /* noop */
  }
}
