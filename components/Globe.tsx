"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GlobeGL, { type GlobeMethods } from "react-globe.gl";
import { audio } from "@/lib/audio";
import { pairsAbove } from "@/lib/similarity";
import { useArchive } from "@/lib/store";
import { strangenessBucket } from "@/lib/strangeness";
import type { Sighting } from "@/lib/types";
import { loadUserSubmissions } from "@/lib/userSightings";

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
  const agencyFilter = useArchive((s) => s.agencyFilter);
  const typeFilter = useArchive((s) => s.typeFilter);
  const bucketFilter = useArchive((s) => s.bucketFilter);
  const sourceFilter = useArchive((s) => s.sourceFilter);

  // Merge static + user-submitted sightings, refreshed whenever submissions change.
  const [userSubmissions, setUserSubmissions] = useState<Sighting[]>([]);
  useEffect(() => {
    setUserSubmissions(loadUserSubmissions());
    const onChange = () => setUserSubmissions(loadUserSubmissions());
    window.addEventListener("declassified:user-sightings-changed", onChange);
    return () => window.removeEventListener("declassified:user-sightings-changed", onChange);
  }, []);
  const mergedSightings = useMemo(
    () => [...sightings, ...userSubmissions],
    [sightings, userSubmissions]
  );

  // Markers — recomputed when the dataset, timeline playhead, or filters change.
  const markers = useMemo(() => {
    return mergedSightings
      .filter((s) => s.date <= revealedThrough)
      .filter((s) => (agencyFilter === null ? true : agencyFilter.has(s.agency)))
      .filter((s) => (typeFilter === null ? true : typeFilter.has(s.type)))
      .filter((s) =>
        bucketFilter === null ? true : bucketFilter.has(strangenessBucket(s.strangenessScore))
      )
      .filter((s) => {
        if (sourceFilter === null) return true;
        const src = s.source ?? (s.userSubmitted ? "user-submitted" : "pentagon-2026");
        return sourceFilter.has(src);
      })
      .map((s) => ({ ...toMarker(s), source: s.source ?? "pentagon-2026" }));
  }, [mergedSightings, revealedThrough, agencyFilter, typeFilter, bucketFilter, sourceFilter]);

  // Connections — top arcs between visible sightings whose similarity is above
  // a threshold. Recomputed when the visible set changes (timeline playhead)
  // or when the mode toggles on.
  const connectionsEnabled = useArchive((s) => s.connectionsEnabled);
  const arcs = useMemo(() => {
    if (!connectionsEnabled) return [];
    const visibleIds = new Set(markers.map((m) => m.id));
    const byId = new Map(sightings.map((s) => [s.id, s] as const));
    const pairs = pairsAbove(0.22)
      .filter((p) => visibleIds.has(p.from) && visibleIds.has(p.to))
      .slice(0, 140);
    return pairs.map((p) => {
      const a = byId.get(p.from)!;
      const b = byId.get(p.to)!;
      // Stronger correlation → brighter arc.
      const alpha = Math.min(1, 0.25 + p.score * 1.5);
      const color = `rgba(14, 230, 255, ${alpha.toFixed(3)})`;
      return {
        startLat: a.location.lat,
        startLng: a.location.lng,
        endLat: b.location.lat,
        endLng: b.location.lng,
        color,
        score: p.score,
      };
    });
  }, [connectionsEnabled, markers, sightings]);

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
    const s = mergedSightings.find((x) => x.id === selectedId);
    if (!s || !globeRef.current) return;
    globeRef.current.pointOfView(
      { lat: s.location.lat, lng: s.location.lng, altitude: 1.6 },
      1100
    );
  }, [selectedId, mergedSightings]);

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
          pointColor={(p: object) => {
            const m = p as MarkerPoint & { source: string };
            // Blue Book + user-submitted: dim the fill so the source reads
            // immediately on the globe vs Pentagon's solid markers.
            if (m.source === "blue-book") return m.color + "AA";
            return m.color;
          }}
          pointResolution={6}
          pointLabel={(p: object) => {
            const m = p as MarkerPoint;
            const s = mergedSightings.find((x) => x.id === m.id);
            if (!s) return "";
            const region = s.location.region ?? s.location.country;
            const sourceLabel =
              s.source === "blue-book"
                ? `<div style="color:#0EE6FF;font-size:9px;text-transform:uppercase;letter-spacing:0.18em;margin-top:2px;">[BLUE BOOK]</div>`
                : s.userSubmitted
                  ? `<div style="color:#FFA500;font-size:9px;text-transform:uppercase;letter-spacing:0.18em;margin-top:2px;">[USER-SUBMITTED]</div>`
                  : "";
            return `<div style="font-family:ui-monospace,monospace;background:#000;border:1px solid ${m.color};padding:6px 8px;color:#F0EDE5;font-size:11px;letter-spacing:0.04em;">
              <div style="color:${m.color};font-size:9px;text-transform:uppercase;letter-spacing:0.18em;">${s.id}</div>
              <div style="margin-top:2px;">${region}</div>
              <div style="color:#8C887E;font-size:9px;margin-top:2px;">${s.date} · ${s.agency} · ${s.type}</div>
              ${sourceLabel}
            </div>`;
          }}
          onPointClick={(p: object) => {
            const m = p as MarkerPoint;
            setSelected(m.id);
          }}
          onPointHover={(p: object | null) => {
            const id = p ? (p as MarkerPoint).id : null;
            setHoverId(id);
            if (id) audio().ping();
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
          // Connections arcs — drawn between similar sightings when enabled
          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={(d: object) => (d as { color: string }).color}
          arcStroke={0.35}
          arcAltitudeAutoScale={0.45}
          arcDashLength={0.4}
          arcDashGap={0.25}
          arcDashAnimateTime={3200}
        />
      ) : null}
    </div>
  );
}
