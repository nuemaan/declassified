import { ImageResponse } from "next/og";
import { getSighting } from "@/lib/data";
import { strangenessBucket } from "@/lib/strangeness";

export const runtime = "nodejs";

const BUCKET_HEX: Record<"phosphor" | "amber" | "redalert", string> = {
  phosphor: "#00FF66",
  amber: "#FFA500",
  redalert: "#FF3333",
};

const BUCKET_LABEL: Record<"phosphor" | "amber" | "redalert", string> = {
  phosphor: "ROUTINE / EXPLAINED",
  amber: "UNRESOLVED",
  redalert: "HIGH STRANGENESS",
};

const PAGE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  background: "#000000",
  color: "#F0EDE5",
  padding: 64,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

function row(extra: React.CSSProperties = {}): React.CSSProperties {
  return { display: "flex", ...extra };
}

function col(extra: React.CSSProperties = {}): React.CSSProperties {
  return { display: "flex", flexDirection: "column", ...extra };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") ?? "";
    const investigator = (searchParams.get("i") ?? "").slice(0, 32).toUpperCase();
    const s = getSighting(id);

    if (!s) {
      return new ImageResponse(
        (
          <div style={{ ...PAGE, alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "flex", fontSize: 40, letterSpacing: 6 }}>
              DECLASSIFIED · CASE NOT FOUND
            </div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const bucket = strangenessBucket(s.strangenessScore);
    const tone = BUCKET_HEX[bucket];
    const toneLabel = BUCKET_LABEL[bucket];
    const region = s.location.region ?? s.location.country;
    const desc =
      s.description.length > 240
        ? s.description.slice(0, 237).trimEnd() + "…"
        : s.description;

    return new ImageResponse(
      (
        <div style={PAGE}>
          {/* Header */}
          <div style={row({ justifyContent: "space-between", alignItems: "flex-start" })}>
            <div style={col()}>
              <div style={{ display: "flex", fontSize: 18, color: "#8C887E", letterSpacing: 4 }}>
                FILE REF
              </div>
              <div style={{ display: "flex", fontSize: 26, marginTop: 6, color: "#F0EDE5" }}>
                {s.id}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                border: `2px solid ${tone}`,
                color: tone,
                padding: "8px 14px",
                fontSize: 18,
                letterSpacing: 4,
              }}
            >
              CLASSIFICATION: PUBLIC
            </div>
          </div>

          {/* Title — "DE" and "CLASSIFIED" each in their own flex child */}
          <div style={row({ marginTop: 38, fontSize: 84, lineHeight: 1 })}>
            <div style={{ display: "flex", color: "#F0EDE5" }}>DE</div>
            <div style={{ display: "flex", color: tone }}>CLASSIFIED</div>
          </div>

          {/* Sub-title row */}
          <div style={row({ marginTop: 24, fontSize: 18, letterSpacing: 4, color: "#8C887E" })}>
            <div style={{ display: "flex", color: tone }}>{toneLabel}</div>
            <div style={{ display: "flex", margin: "0 18px" }}>·</div>
            <div style={{ display: "flex" }}>{s.agency}</div>
            <div style={{ display: "flex", margin: "0 18px" }}>·</div>
            <div style={{ display: "flex" }}>{s.type.toUpperCase()}</div>
            <div style={{ display: "flex", margin: "0 18px" }}>·</div>
            <div style={{ display: "flex" }}>{s.date}</div>
          </div>

          {/* Location */}
          <div style={col({ marginTop: 36 })}>
            <div style={{ display: "flex", fontSize: 38, lineHeight: 1.15, color: tone }}>
              {region}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                lineHeight: 1.4,
                marginTop: 18,
                color: "#F0EDE5",
                maxWidth: 1080,
              }}
            >
              {desc}
            </div>
          </div>

          {/* Spacer */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* Footer */}
          <div
            style={row({
              justifyContent: "space-between",
              alignItems: "flex-end",
              borderTop: "1px solid #1A1A18",
              paddingTop: 18,
            })}
          >
            <div style={col()}>
              <div style={{ display: "flex", fontSize: 14, color: "#8C887E", letterSpacing: 4 }}>
                INVESTIGATOR
              </div>
              <div style={{ display: "flex", fontSize: 22, color: "#F0EDE5", marginTop: 4 }}>
                {investigator || "UNKNOWN"}
              </div>
            </div>
            <div style={col({ alignItems: "flex-end" })}>
              <div style={{ display: "flex", fontSize: 14, color: "#8C887E", letterSpacing: 4 }}>
                ARCHIVE
              </div>
              <div style={{ display: "flex", fontSize: 22, color: "#F0EDE5", marginTop: 4 }}>
                declassified.local
              </div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (err) {
    return new Response(
      `og-render-failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500, headers: { "content-type": "text/plain" } }
    );
  }
}
