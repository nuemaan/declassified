"use client";

import { useEffect, useState } from "react";

function generateCaseNumber(): string {
  const yr = 1947 + Math.floor(Math.random() * 80);
  const a = Math.floor(Math.random() * 26 * 26)
    .toString(36)
    .toUpperCase()
    .padStart(2, "X");
  const n = Math.floor(Math.random() * 9000 + 1000);
  return `CASE-${yr}-${a}-${n}`;
}

export function CaseStamp() {
  // Generated client-side so each visit gets a fresh case ID without
  // hydration mismatch warnings.
  const [caseId, setCaseId] = useState<string>("CASE-----");

  useEffect(() => {
    setCaseId(generateCaseNumber());
  }, []);

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20 select-none text-[10px] uppercase tracking-wider2 text-archive-paperDim/80">
      <div>FILE REF</div>
      <div className="mt-0.5 text-archive-paper/90">{caseId}</div>
    </div>
  );
}
