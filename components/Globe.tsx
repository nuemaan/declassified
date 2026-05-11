"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GlobeGL, { type GlobeMethods } from "react-globe.gl";
import { useArchive } from "@/lib/store";
import { strangenessBucket } from "@/lib/strangeness";
import type { Sighting } from "@/lib/types";

interface MarkerPoint {
  id: string;
  lat: number;
  lng: number;
  color: string;
  /** Numeric tuple "r, g, b" for ring rgba interpolation. */
  colorRgb: string;
  /** Surface dot radius in globe units. */
  radius: number;
  /** Ring's outer reach in degrees. */
  maxRadius: number;
  /** Time between successive pulses, ms. */
  period: number;
  size: number;
  glow: number;
}

const BUCKET_COLOR: Record<"phosphor" | "amber" | "redalert", { hex: string; rgb: string }> = {
  phosphor: { hex: "#00FF66", rgb: "0, 255, 102" },
  amber: { hex: "#FFA500", rgb: "255, 165, 0" },
  redalert: { hex: "#FF3333", rgb: "255, 51, 51" },
};

function toMarker(s: Sighting): MarkerPoint {
  const bucket = strangenessBucket(s.strangenessScore);
  const { hex, rgb } = BUCKET_COLOR[bucket];
  // Map duration → size on a tame log scale.
  const durFactor = Math.min(1, Math.log10(s.durationMinutes + 1) / Math.log10(1000));
  const radius = 0.22 + durFactor * 0.5;
  const maxRadius = 1.8 + durFactor * 4.2;
  // Higher confidence → faster pulse.
  const period = 1400 + (1 - s.confidence) * 1600;
  return {
    id: s.id,
    lat: s.location.lat,
    lng: s.location.lng,
    color: hex,
    colorRgb: rgb,
    radius,
    maxRadius,
    period,
    size: radius,
    glow: s.confidence,
  };
}

interface GlobeProps {
  sightings: Sighting[];
}

export default function Globe({ sightings }: GlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const selectedId = useArchive((s) => s.selectedSightingId);
  const setSelected = useArchive((s) => s.setSelected);
  const setInteracting = useArchive((s) => s.setGlobeInteracting);
  const interacting = useArchive((s) => s.globeInteracting);

  // Timeline filter — markers whose date is past the playhead are hidden.
  const revealedThrough = useArchive((s) => s.revealedThrough);

  // Markers — recomputed when the dataset or timeline playhead changes.
  const markers = useMemo(
    () => sightings.filter((s) => s.date <= revealedThrough).map(toMarker),
    [sightings, revealedThrough]
  );

  // Track container size for the canvas.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDims({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Initial controls + auto-rotate.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls() as unknown as {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableDamping: boolean;
      dampingFactor: number;
      minDistance: number;
      maxDistance: number;
      enablePan: boolean;
    };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 180;
    controls.maxDistance = 520;
    controls.enablePan = false;
    g.pointOfView({ lat: 28, lng: -40, altitude: 2.2 }, 0);
  }, []);

  // Pause auto-rotate while the user is dragging; resume after a quiet beat.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls() as unknown as {
      autoRotate: boolean;
    };
    if (interacting) {
      controls.autoRotate = false;
      return;
    }
    const t = window.setTimeout(() => {
      controls.autoRotate = true;
    }, 2500);
    return () => window.clearTimeout(t);
  }, [interacting]);

  // Recenter on selected sighting (smooth fly-to).
  useEffect(() => {
    if (!selectedId) return;
    const s = sightings.find((x) => x.id === selectedId);
    if (!s || !globeRef.current) return;
    globeRef.current.pointOfView(
      { lat: s.location.lat, lng: s.location.lng, altitude: 1.6 },
      1100
    );
  }, [selectedId, sightings]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${hoverId ? "cursor-pointer" : "reticle"}`}
      onPointerDown={() => setInteracting(true)}
      onPointerUp={() => setInteracting(false)}
      onPointerLeave={() => setInteracting(false)}
    >
      {dims.width > 0 && dims.height > 0 ? (
        <GlobeGL
          ref={globeRef}
          width={dims.width}
          height={dims.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          showGraticules={true}
          showAtmosphere={true}
          atmosphereColor="#0EE6FF"
          atmosphereAltitude={0.18}
          // Surface dots
          pointsData={markers}
          pointLat={(p: object) => (p as MarkerPoint).lat}
          pointLng={(p: object) => (p as MarkerPoint).lng}
          pointAltitude={0.008}
          pointRadius={(p: object) => (p as MarkerPoint).radius}
          pointColor={(p: object) => (p as MarkerPoint).color}
          pointResolution={6}
          pointLabel={(p: object) => {
            const m = p as MarkerPoint;
            const s = sightings.find((x) => x.id === m.id);
            if (!s) return "";
            const region = s.location.region ?? s.location.country;
            return `<div style="font-family:ui-monospace,monospace;background:#000;border:1px solid ${m.color};padding:6px 8px;color:#F0EDE5;font-size:11px;letter-spacing:0.04em;">
              <div style="color:${m.color};font-size:9px;text-transform:uppercase;letter-spacing:0.18em;">${s.id}</div>
              <div style="margin-top:2px;">${region}</div>
              <div style="color:#8C887E;font-size:9px;margin-top:2px;">${s.date} · ${s.agency} · ${s.type}</div>
            </div>`;
          }}
          onPointClick={(p: object) => {
            const m = p as MarkerPoint;
            setSelected(m.id);
          }}
          onPointHover={(p: object | null) => {
            setHoverId(p ? (p as MarkerPoint).id : null);
          }}
          // Pulsing rings
          ringsData={markers}
          ringLat={(p: object) => (p as MarkerPoint).lat}
          ringLng={(p: object) => (p as MarkerPoint).lng}
          ringMaxRadius={(p: object) => (p as MarkerPoint).maxRadius}
          ringPropagationSpeed={2.5}
          ringRepeatPeriod={(p: object) => (p as MarkerPoint).period}
          ringColor={(p: object) => {
            const rgb = (p as MarkerPoint).colorRgb;
            return (t: number) => `rgba(${rgb}, ${(1 - t).toFixed(3)})`;
          }}
          ringResolution={48}
        />
      ) : null}
    </div>
  );
}
