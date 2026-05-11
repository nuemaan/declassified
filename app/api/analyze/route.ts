import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import {
  ANALYST_SYSTEM,
  ANALYST_TOOL_NAME,
  ANALYST_TOOL_SCHEMA,
  type AnalystReport,
} from "@/lib/anthropic";
import { getSighting } from "@/lib/data";

export const runtime = "nodejs";

const MODEL = "claude-sonnet-4-6";

// -------- per-IP rate limiting (in-memory, single-instance) --------
// Good enough for a portfolio demo. Production would use KV / Redis.
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LIMIT = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { ok: true } | { ok: false; resetIn: number } {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (b.count >= LIMIT) return { ok: false, resetIn: b.resetAt - now };
  b.count++;
  return { ok: true };
}

function ipOf(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

// -------- handler --------
export async function POST(req: NextRequest) {
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid-json" }, 400);
  }
  const id = body.id?.toString() ?? "";
  const sighting = getSighting(id);
  if (!sighting) return json({ error: "not-found" }, 404);

  // Pick the key. Server env wins; otherwise the client supplies their own.
  const serverKey = process.env.ANTHROPIC_API_KEY?.trim();
  const clientKey = req.headers.get("x-anthropic-key")?.trim() ?? "";
  const apiKey = serverKey || clientKey;
  const mode: "server" | "byok" = serverKey ? "server" : "byok";

  if (!apiKey) {
    return json(
      {
        error: "no-key",
        message:
          "No ANTHROPIC_API_KEY on the server and no client key supplied. Open the BYO-key panel and paste a key.",
      },
      401
    );
  }

  // Rate limit by IP — only when using the server key. BYO-key callers pay
  // for their own usage, so we don't gatekeep them here.
  if (mode === "server") {
    const rl = rateLimit(ipOf(req));
    if (!rl.ok) {
      return json(
        {
          error: "rate-limited",
          message: `Try again in ${Math.ceil(rl.resetIn / 60000)} min.`,
          retryAfterMs: rl.resetIn,
        },
        429
      );
    }
  }

  const client = new Anthropic({ apiKey });

  // Compact sighting payload — we don't need to send the redactions or seeds.
  const compact = {
    id: sighting.id,
    date: sighting.date,
    location: sighting.location,
    agency: sighting.agency,
    type: sighting.type,
    description: sighting.description,
    witnesses: sighting.witnesses,
    duration_minutes: sighting.durationMinutes,
  };

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: ANALYST_SYSTEM,
      tool_choice: { type: "tool", name: ANALYST_TOOL_NAME },
      tools: [ANALYST_TOOL_SCHEMA],
      messages: [{ role: "user", content: JSON.stringify(compact) }],
    });

    const toolUse = resp.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return json({ error: "no-tool-call" }, 502);
    }
    const report = toolUse.input as AnalystReport;
    // Normalize percentages so the UI never deals with sums ≠ 100.
    const sum =
      report.plausibility.aircraft +
      report.plausibility.atmospheric +
      report.plausibility.sensor_artifact +
      report.plausibility.hoax +
      report.plausibility.unexplained;
    if (sum > 0 && Math.abs(sum - 100) > 1) {
      const k = 100 / sum;
      report.plausibility = {
        aircraft: Math.round(report.plausibility.aircraft * k),
        atmospheric: Math.round(report.plausibility.atmospheric * k),
        sensor_artifact: Math.round(report.plausibility.sensor_artifact * k),
        hoax: Math.round(report.plausibility.hoax * k),
        unexplained: Math.round(report.plausibility.unexplained * k),
      };
    }

    return json({ report, mode });
  } catch (err) {
    // Surface the Anthropic error code so the BYO-key panel can show "invalid key" specifically.
    const status = err instanceof Anthropic.APIError ? err.status ?? 500 : 500;
    const message =
      err instanceof Error
        ? err.message.slice(0, 240)
        : "Unknown error contacting the analyst.";
    return json({ error: "upstream", status, message }, 502);
  }
}

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
