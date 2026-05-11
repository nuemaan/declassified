import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core archive palette
        archive: {
          void: "#000000",        // pure black background
          paper: "#F0EDE5",       // warm white primary text
          paperDim: "#8C887E",    // muted paper for secondary copy
          line: "#1A1A18",        // hairline / dividers
          panel: "#0A0A09",       // raised surfaces on void
        },
        // Status / classification
        phosphor: "#00FF66",      // confirmed / verified
        amber: "#FFA500",         // unresolved
        redalert: "#FF3333",      // high-strangeness
        // Globe
        bathym: "#031018",
        graticule: "#0EE6FF",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        wider2: "0.18em",
      },
      animation: {
        "scan": "scan 8s linear infinite",
        "flicker": "flicker 7s infinite steps(1, end)",
        "cursor-blink": "cursorBlink 1.05s steps(1) infinite",
        "pulse-marker": "pulseMarker 2.4s ease-in-out infinite",
      },
      keyframes: {
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%, 92%, 100%": { opacity: "1" },
          "93%": { opacity: "0.86" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.92" },
          "97%": { opacity: "1" },
        },
        cursorBlink: {
          "0%, 50%": { opacity: "1" },
          "50.01%, 100%": { opacity: "0" },
        },
        pulseMarker: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.45)", opacity: "0.4" },
        },
      },
      boxShadow: {
        phosphor: "0 0 8px #00FF66, 0 0 24px rgba(0,255,102,0.35)",
        amber: "0 0 8px #FFA500, 0 0 24px rgba(255,165,0,0.3)",
        redalert: "0 0 8px #FF3333, 0 0 24px rgba(255,51,51,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
