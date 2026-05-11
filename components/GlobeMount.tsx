"use client";

import dynamic from "next/dynamic";
import type { Sighting } from "@/lib/types";

// react-globe.gl pulls in three.js and reaches for `window` at import time,
// so it can only be rendered on the client.
const Globe = dynamic(() => import("./Globe"), { ssr: false });

export function GlobeMount({ sightings }: { sightings: Sighting[] }) {
  return <Globe sightings={sightings} />;
}
