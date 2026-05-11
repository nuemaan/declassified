"use client";

import { useEffect, useState } from "react";
import type { AnalystReport } from "@/lib/anthropic";
import { getSighting } from "@/lib/data";
import { topMatches } from "@/lib/similarity";

interface AIAnalystProps {
  sightingId: string;
}

type FetchState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "needs-key" }
  | { phase: "ok"; report: AnalystReport; mode: "server" | "byok" }
  | { phase: "error"; message: string };

const KEY_STORAGE = "declassified.anthropic.key";
const CACHE_PREFIX = "declassified.analysis:";

function readCachedReport(id: string): AnalystReport | null {
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as AnalystReport;
  } catch {
    return null;
  }
}

function writeCachedReport(id: string, report: AnalystReport): void {
  try {
    window.localStorage.setItem(CACHE_PREFIX + id, JSON.stringify(report));
  } catch {
    /* noop */
  }
}

export function AIAnalyst({ sightingId }: AIAnalystProps) {
  const [state, setState] = useState<FetchState>({ phase: "idle" });
  const [byoKey, setByoKey] = useState("");
  const [showKeyPanel, setShowKeyPanel] = useState(false);

  // On mount / sighting change, show the cached report if we have one.
  useEffect(() => {
    setShowKeyPanel(false);
    const cached = readCachedReport(sightingId);
    if (cached) {
      setState({ phase: "ok", report: cached, mode: "byok" });
    } else {
      setState({ phase: "idle" });
    }
  }, [sightingId]);

  useEffect(() => {
    try {
      const k = window.localStorage.getItem(KEY_STORAGE);
      if (k) setByoKey(k);
    } catch {
      /* noop */
    }
  }, []);

  const run = async () => {
    setState({ phase: "loading" });
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (byoKey.trim()) headers["x-anthropic-key"] = byoKey.trim();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: sightingId }),
      });
      const data = (await res.json()) as
        | { report: AnalystReport; mode: "server" | "byok" }
        | { error: string; message?: string };

      if ("error" in data) {
        if (data.error === "no-key") {
          setShowKeyPanel(true);
          setState({ phase: "needs-key" });
        } else {
          setState({ phase: "error", message: data.message ?? data.error });
        }
        return;
      }

      writeCachedReport(sightingId, data.report);
      setState({ phase: "ok", report: data.report, mode: data.mode });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  };

  const saveKey = () => {
    try {
      if (byoKey.trim()) window.localStorage.setItem(KEY_STORAGE, byoKey.trim());
      else window.localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* noop */
    }
  };

  const clearKey = () => {
    setByoKey("");
    try {
      window.localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-3">
      {state.phase === "idle" ? (
        <button
          type="button"
          onClick={run}
          className="block w-full border border-phosphor/60 bg-phosphor/5 px-3 py-2 text-[11px] uppercase tracking-wider2 text-phosphor hover:bg-phosphor/10"
        >
          ▸ run plausibility analysis
        </button>
      ) : null}

      {state.phase === "loading" ? (
        <div className="border border-archive-line bg-archive-void/40 px-3 py-3 text-[12px] text-archive-paperDim mono-tight">
          Querying analyst<span className="caret" aria-hidden />
        </div>
      ) : null}

      {state.phase === "ok" ? (
        <Report report={state.report} mode={state.mode} sightingId={sightingId} onRerun={run} />
      ) : null}

      {state.phase === "error" ? (
        <div className="space-y-2">
          <div className="border border-redalert/50 bg-redalert/10 px-3 py-2 text-[11px] text-redalert mono-tight">
            {state.message}
          </div>
          <button
            type="button"
            onClick={() => setState({ phase: "idle" })}
            className="block w-full border border-archive-line bg-archive-void px-3 py-2 text-[11px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:text-phosphor"
          >
            ▸ try again
          </button>
        </div>
      ) : null}

      {state.phase === "needs-key" || showKeyPanel ? (
        <KeyPanel
          value={byoKey}
          onChange={setByoKey}
          onSave={() => {
            saveKey();
            run();
          }}
          onClear={clearKey}
          onClose={() => setShowKeyPanel(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowKeyPanel(true)}
          className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/70 hover:text-archive-paper"
        >
          ▸ bring your own anthropic key
        </button>
      )}
    </div>
  );
}

const BUCKET_DEFS: Array<{ key: keyof AnalystReport["plausibility"]; label: string; tone: string }> = [
  { key: "aircraft", label: "Conventional aircraft", tone: "bg-phosphor/80" },
  { key: "atmospheric", label: "Atmospheric / optical", tone: "bg-phosphor/60" },
  { key: "sensor_artifact", label: "Sensor artifact", tone: "bg-amber/80" },
  { key: "hoax", label: "Hoax / misidentification", tone: "bg-amber/60" },
  { key: "unexplained", label: "Unexplained", tone: "bg-redalert/80" },
];

function Report({
  report,
  mode,
  sightingId,
  onRerun,
}: {
  report: AnalystReport;
  mode: "server" | "byok";
  sightingId: string;
  onRerun: () => void;
}) {
  const matches = topMatches(sightingId, 3);
  return (
    <div className="space-y-3">
      {/* Stacked horizontal bar of plausibility */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
          <span>plausibility</span>
          <span>{mode === "server" ? "server analyst" : "byo key"}</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden bg-archive-void">
          {BUCKET_DEFS.map((b) => {
            const v = report.plausibility[b.key];
            return v > 0 ? (
              <div key={b.key} className={`${b.tone}`} style={{ width: `${v}%` }} title={`${b.label}: ${v}%`} />
            ) : null;
          })}
        </div>
        <ul className="mt-2 space-y-1 text-[11px] mono-tight">
          {BUCKET_DEFS.map((b) => {
            const v = report.plausibility[b.key];
            return (
              <li key={b.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 ${b.tone}`} aria-hidden />
                  <span className="text-archive-paper">{b.label}</span>
                </span>
                <span className="tabular-nums text-archive-paperDim">{v}%</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Pull quote */}
      <div className="border-l border-phosphor/60 pl-3 text-[13px] italic text-phosphor/90 mono-tight">
        {report.quote}
      </div>

      {/* Similar cases — sourced from precomputed embeddings/similarity matrix */}
      {matches.length > 0 ? (
        <div>
          <div className="mb-1.5 text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
            similar cases
          </div>
          <ul className="space-y-1.5">
            {matches.map((m) => {
              const s = getSighting(m.id);
              if (!s) return null;
              return (
                <li key={m.id} className="flex items-start justify-between gap-2 border border-archive-line bg-archive-void/50 px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-archive-paper mono-tight truncate">
                      {s.location.region ?? s.location.country}
                    </div>
                    <div className="text-[9px] tracking-wider2 text-archive-paperDim/80">
                      {s.date} · {s.agency} · {s.type}
                    </div>
                  </div>
                  <div className="text-[9px] tabular-nums text-archive-paperDim/80">
                    {(m.score * 100).toFixed(0)}%
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onRerun}
        className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/70 hover:text-archive-paper"
      >
        ▸ rerun
      </button>
    </div>
  );
}

function KeyPanel({
  value,
  onChange,
  onSave,
  onClear,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="border border-amber/40 bg-archive-void/60 p-3">
      <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-wider2 text-amber/90">
        <span>bring your own key</span>
        <button
          type="button"
          onClick={onClose}
          className="text-archive-paperDim hover:text-archive-paper"
          aria-label="Close BYO-key panel"
        >
          close
        </button>
      </div>
      <p className="mb-2 text-[10px] text-archive-paper/90 mono-tight">
        Paste an Anthropic API key. Stored only in this browser. Sent to /api/analyze as a header — never logged.
      </p>
      <input
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="sk-ant-..."
        className="block w-full border border-archive-line bg-archive-void px-2 py-1.5 text-[11px] text-archive-paper outline-none placeholder:text-archive-paperDim/40 focus:border-phosphor"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!value.trim()}
          className="border border-phosphor/60 bg-phosphor/5 px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-phosphor hover:bg-phosphor/10 disabled:opacity-30"
        >
          ▸ save + run
        </button>
        <button
          type="button"
          onClick={onClear}
          className="border border-archive-line bg-archive-void px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-archive-paperDim hover:border-redalert hover:text-redalert"
        >
          ▸ clear
        </button>
      </div>
    </div>
  );
}
