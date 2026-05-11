/**
 * Shared shapes + the structured-output tool schema used by the AI Analyst.
 * Lives in lib so the API route and the client component agree on the wire.
 */

export interface PlausibilityBreakdown {
  /** Conventional aircraft, drones, or balloons. */
  aircraft: number;
  /** Optical effects, atmospheric refraction, plasma, meteors. */
  atmospheric: number;
  /** Radar/IR/camera glitch, lens flare, sensor noise. */
  sensor_artifact: number;
  /** Likely fabrication, hoax, or misidentification of a known prank. */
  hoax: number;
  /** Genuinely not resolved by any of the above. */
  unexplained: number;
}

export interface AnalystReport {
  plausibility: PlausibilityBreakdown;
  /** A single sentence (≤ 22 words) that captures the case's strangeness. */
  quote: string;
}

export const ANALYST_TOOL_NAME = "report_analysis";

export const ANALYST_TOOL_SCHEMA = {
  name: ANALYST_TOOL_NAME,
  description:
    "Return a structured plausibility analysis of a UAP sighting record. Percentages MUST sum to 100. Do not claim what the object was; remain neutral.",
  input_schema: {
    type: "object" as const,
    required: ["plausibility", "quote"],
    properties: {
      plausibility: {
        type: "object" as const,
        required: ["aircraft", "atmospheric", "sensor_artifact", "hoax", "unexplained"],
        properties: {
          aircraft: { type: "integer", minimum: 0, maximum: 100 },
          atmospheric: { type: "integer", minimum: 0, maximum: 100 },
          sensor_artifact: { type: "integer", minimum: 0, maximum: 100 },
          hoax: { type: "integer", minimum: 0, maximum: 100 },
          unexplained: { type: "integer", minimum: 0, maximum: 100 },
        },
      },
      quote: {
        type: "string",
        description:
          "A single sentence under 22 words capturing the case's strangeness. Neutral tone. Do not make claims about origin.",
      },
    },
  },
};

export const ANALYST_SYSTEM = `You are a careful archivist analyzing declassified UAP reports.

You will receive one sighting record. Use the report_analysis tool to return:

1. plausibility: percentage breakdown across five categories. Percentages must be non-negative integers and MUST sum to 100. Pick weights based on the actual evidence in the record (sensor count, witness count, duration, agency).
2. quote: a single neutral sentence (under 22 words) that captures the case's most striking detail. NEVER claim alien origin or what the object was. Never editorialize.

Constraints:
- Do not invent details that are not in the record.
- Do not use the words "alien", "extraterrestrial", or "spacecraft".
- Do not include external commentary outside the tool call.`;
