"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

interface RedactionRevealProps {
  reveal: string;
}

/**
 * A black bar that occupies the same horizontal space as the text underneath.
 * Click to "declassify": the bar tears apart and the text fades in.
 *
 * This is purely a visualization device. The dossier footer states clearly
 * that source files were not redacted in this way.
 */
export function RedactionReveal({ reveal }: RedactionRevealProps) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return (
      <motion.span
        initial={{ opacity: 0, backgroundColor: "rgba(0, 255, 102, 0.45)" }}
        animate={{ opacity: 1, backgroundColor: "rgba(0, 255, 102, 0)" }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="rounded-[1px] px-[2px] text-phosphor"
      >
        {reveal}
      </motion.span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="group relative inline-flex h-[1.05em] items-center align-baseline"
      aria-label={`Declassify redacted segment (${reveal.length} characters)`}
    >
      {/* Invisible placeholder text keeps the line width identical to the revealed state */}
      <span className="invisible whitespace-pre" aria-hidden>
        {reveal}
      </span>

      {/* The bar */}
      <AnimatePresence>
        <motion.span
          key="bar"
          initial={{ scaleX: 1, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ scaleX: 0.04, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.7, 0, 0.3, 1] }}
          className="pointer-events-none absolute inset-0 origin-center bg-archive-paper transition-colors group-hover:bg-phosphor"
        />
      </AnimatePresence>

      {/* "DECLASSIFY" hint label on hover */}
      <span
        className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] uppercase tracking-wider2 text-phosphor opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        aria-hidden
      >
        ▸ declassify
      </span>
    </button>
  );
}
