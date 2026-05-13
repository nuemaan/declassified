"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Agency, Sighting, SightingType } from "@/lib/types";
import { saveUserSubmission } from "@/lib/userSightings";

const AGENCIES: Agency[] = ["FBI", "DoD", "NASA", "State", "Other"];
const TYPES: SightingType[] = ["visual", "radar", "multi-sensor", "infrared", "photographic"];

interface SubmitSightingButtonProps {
  /** Number of currently-saved user submissions — shown in the button label. */
  userCount: number;
}

const KEY_STORAGE = "declassified.anthropic.key";

export function SubmitSightingButton({ userCount }: SubmitSightingButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-6 border-t border-archive-line pt-3">
      <h3 className="mb-2 text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
        ▸ user submissions
      </h3>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-between gap-2 border border-amber/60 bg-amber/10 px-2 py-1.5 text-[10px] uppercase tracking-wider2 text-amber hover:bg-amber/20"
      >
        <span>▸ submit a sighting</span>
        <span className="text-amber/70">{userCount} on file</span>
      </button>
      <p className="mt-1 text-[9px] tracking-wider2 text-archive-paperDim/70">
        Submissions go through Claude moderation. Approved entries are stored only in your browser.
      </p>
      <SubmitModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

interface FormState {
  date: string;
  country: string;
  region: string;
  lat: string;
  lng: string;
  agency: Agency;
  type: SightingType;
  description: string;
  witnesses: string;
  durationMinutes: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "approved"; saved: Sighting }
  | { kind: "rejected"; reason: string }
  | { kind: "error"; message: string };

function emptyForm(): FormState {
  return {
    date: "",
    country: "",
    region: "",
    lat: "",
    lng: "",
    agency: "Other",
    type: "visual",
    description: "",
    witnesses: "",
    durationMinutes: "5",
  };
}

function SubmitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [byoKey, setByoKey] = useState("");

  useEffect(() => {
    if (!open) return;
    try {
      setByoKey(window.localStorage.getItem(KEY_STORAGE) ?? "");
    } catch {
      /* noop */
    }
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const validate = (f: FormState): string | null => {
    if (!f.date) return "Date is required.";
    if (!f.country.trim()) return "Country is required.";
    if (f.description.trim().length < 40) return "Description must be at least 40 characters.";
    const lat = Number(f.lat);
    const lng = Number(f.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return "Latitude must be between -90 and 90.";
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return "Longitude must be between -180 and 180.";
    const dur = Number(f.durationMinutes);
    if (!Number.isFinite(dur) || dur < 0) return "Duration must be a non-negative number.";
    return null;
  };

  const submit = async () => {
    const issue = validate(form);
    if (issue) {
      setPhase({ kind: "error", message: issue });
      return;
    }
    setPhase({ kind: "submitting" });

    const candidate = {
      date: form.date,
      country: form.country.trim(),
      region: form.region.trim() || undefined,
      lat: Number(form.lat),
      lng: Number(form.lng),
      agency: form.agency,
      type: form.type,
      description: form.description.trim(),
      witnesses: form.witnesses
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean),
      durationMinutes: Number(form.durationMinutes),
    };

    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (byoKey.trim()) headers["x-anthropic-key"] = byoKey.trim();
      const res = await fetch("/api/moderate", {
        method: "POST",
        headers,
        body: JSON.stringify(candidate),
      });
      const data = (await res.json()) as
        | { decision: "approve"; sighting: Sighting }
        | { decision: "reject"; reason: string }
        | { error: string; message?: string };

      if ("error" in data) {
        setPhase({ kind: "error", message: data.message ?? data.error });
        return;
      }
      if (data.decision === "reject") {
        setPhase({ kind: "rejected", reason: data.reason });
        return;
      }
      saveUserSubmission(data.sighting);
      setPhase({ kind: "approved", saved: data.sighting });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Network error." });
    }
  };

  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="submit-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-archive-void/85 px-4 py-6 backdrop-blur-sm"
        >
          <motion.div
            key="submit-modal"
            initial={{ y: 12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 6, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.7, 0, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto border border-archive-line bg-archive-panel"
            role="dialog"
            aria-label="Submit a sighting"
          >
            <header className="flex items-center justify-between border-b border-archive-line px-4 py-2.5">
              <div>
                <div className="text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">submit</div>
                <div className="text-[12px] uppercase tracking-wider2 text-archive-paper mono-tight">
                  your sighting
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center border border-archive-line text-archive-paperDim hover:border-redalert hover:text-redalert"
              >
                <span className="text-[14px] leading-none">×</span>
              </button>
            </header>

            <div className="px-4 py-4">
              {phase.kind === "approved" ? (
                <ApprovedState saved={phase.saved} onDismiss={() => { setForm(emptyForm()); setPhase({ kind: "idle" }); onClose(); }} />
              ) : phase.kind === "rejected" ? (
                <RejectedState reason={phase.reason} onBack={() => setPhase({ kind: "idle" })} />
              ) : (
                <SubmitForm
                  form={form}
                  setForm={setForm}
                  phase={phase}
                  byoKey={byoKey}
                  onSubmit={submit}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalTarget
  );
}

function SubmitForm({
  form,
  setForm,
  phase,
  byoKey,
  onSubmit,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  phase: Phase;
  byoKey: string;
  onSubmit: () => void;
}) {
  const submitting = phase.kind === "submitting";
  const error = phase.kind === "error" ? phase.message : null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-archive-paper mono-tight">
        Your submission is reviewed by Claude for spam, hostility, and basic
        plausibility. Approved entries appear with a{" "}
        <span className="text-amber">[USER-SUBMITTED]</span> tag in this browser only.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" required>
          <input
            type="date"
            value={form.date}
            max="2026-12-31"
            min="1900-01-01"
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Duration (min)">
          <input
            type="number"
            min={0}
            step={1}
            value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field label="Country" required>
          <input
            type="text"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            placeholder="United States"
            className={inputCls}
          />
        </Field>
        <Field label="Region (optional)">
          <input
            type="text"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            placeholder="Phoenix, AZ"
            className={inputCls}
          />
        </Field>

        <Field label="Latitude" required>
          <input
            type="number"
            value={form.lat}
            step="0.0001"
            placeholder="33.4484"
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Longitude" required>
          <input
            type="number"
            value={form.lng}
            step="0.0001"
            placeholder="-112.074"
            onChange={(e) => setForm({ ...form, lng: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field label="Agency">
          <select
            value={form.agency}
            onChange={(e) => setForm({ ...form, agency: e.target.value as Agency })}
            className={inputCls}
          >
            {AGENCIES.map((a) => (
              <option key={a} value={a} className="bg-archive-void">
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sensor">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as SightingType })}
            className={inputCls}
          >
            {TYPES.map((t) => (
              <option key={t} value={t} className="bg-archive-void">
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description (≥ 40 chars)" required>
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What happened, what you saw or measured, and the conditions at the time."
          className={`${inputCls} resize-none`}
        />
      </Field>

      <Field label="Witnesses (comma-separated, optional)">
        <input
          type="text"
          value={form.witnesses}
          onChange={(e) => setForm({ ...form, witnesses: e.target.value })}
          placeholder="Jane Smith, Officer Hart"
          className={inputCls}
        />
      </Field>

      {!byoKey ? (
        <div className="border border-amber/40 bg-amber/5 px-3 py-2 text-[10px] leading-relaxed text-amber mono-tight">
          ▸ moderation needs your own Anthropic key. Get one free at{" "}
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber/80"
          >
            console.anthropic.com
          </a>
          , then save it inside any dossier → AI Analyst panel.
        </div>
      ) : null}

      {error ? (
        <div className="border border-redalert/50 bg-redalert/10 px-3 py-2 text-[11px] text-redalert mono-tight">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={submitting}
        onClick={onSubmit}
        className="block w-full border border-amber/70 bg-amber/10 px-3 py-2 text-[11px] uppercase tracking-wider2 text-amber hover:bg-amber/20 disabled:opacity-40"
      >
        {submitting ? "▸ moderating…" : "▸ submit for review"}
      </button>
    </div>
  );
}

const inputCls =
  "block w-full border border-archive-line bg-archive-void px-2 py-1.5 text-[12px] text-archive-paper outline-none placeholder:text-archive-paperDim/40 focus:border-phosphor";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[9px] uppercase tracking-wider2 text-archive-paperDim/80">
        {label}
        {required ? <span className="ml-1 text-redalert">·</span> : null}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function ApprovedState({ saved, onDismiss }: { saved: Sighting; onDismiss: () => void }) {
  return (
    <div className="space-y-3">
      <div className="border border-phosphor/60 bg-phosphor/5 px-3 py-2 text-[11px] text-phosphor mono-tight shadow-phosphor">
        ▸ approved · saved as {saved.id}
      </div>
      <p className="text-[11px] text-archive-paper mono-tight">
        Your sighting now appears on the globe with a{" "}
        <span className="text-amber">[USER-SUBMITTED]</span> tag. It lives only in this
        browser's storage — nothing was sent to a server beyond moderation.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="block w-full border border-archive-line bg-archive-void px-3 py-2 text-[11px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:text-phosphor"
      >
        ▸ close
      </button>
    </div>
  );
}

function RejectedState({ reason, onBack }: { reason: string; onBack: () => void }) {
  return (
    <div className="space-y-3">
      <div className="border border-redalert/60 bg-redalert/5 px-3 py-2 text-[11px] text-redalert mono-tight">
        ▸ rejected
      </div>
      <p className="text-[11px] text-archive-paper mono-tight">{reason}</p>
      <button
        type="button"
        onClick={onBack}
        className="block w-full border border-archive-line bg-archive-void px-3 py-2 text-[11px] uppercase tracking-wider2 text-archive-paper hover:border-phosphor hover:text-phosphor"
      >
        ▸ revise + resubmit
      </button>
    </div>
  );
}
