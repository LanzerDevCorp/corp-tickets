"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";

// ---------------------------------------------------------------------------
// useReducedMotion
// ---------------------------------------------------------------------------
// Reads window.matchMedia synchronously on the first render (lazy useState)
// so the correct motion variant is applied without a flash. Falls back to
// false (allow motion) when matchMedia is unavailable (SSR or older browsers).
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

// ---------------------------------------------------------------------------
// NewTicketHighlight
// ---------------------------------------------------------------------------
// "New ticket" indicator: a small emerald dot that gently bounces, wrapped in
// a soft "ping" halo, shown to the left of the ticket subject. Powered by
// Motion (motion/react).
//
// - isNew=true  → the dot mounts with a scale/fade-in, then loops a subtle
//                 vertical bounce while a halo pulses outward behind it.
// - isNew=false → AnimatePresence plays a scale/fade-out, then the node
//                 unmounts (so the subject text reflows flush-left).
//
// Under prefers-reduced-motion the looping bounce + halo are disabled and a
// static dot is shown instead; enter/exit collapse to a near-instant fade.
// The element is aria-hidden — "new" state is conveyed elsewhere for AT.
// ---------------------------------------------------------------------------

type NewTicketHighlightProps = {
  isNew: boolean;
};

export function NewTicketHighlight({ isNew }: NewTicketHighlightProps) {
  const reducedMotion = useReducedMotion();

  const enterExitTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <AnimatePresence initial={false}>
      {isNew && (
        <motion.span
          data-testid="new-ticket-indicator"
          aria-hidden="true"
          className="relative inline-flex size-2.5 shrink-0 items-center justify-center"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.4 }}
          transition={enterExitTransition}
        >
          {/* Halo: expanding "ping" pulse behind the dot (motion-safe only) */}
          {!reducedMotion && (
            <motion.span
              data-testid="new-ticket-halo"
              className="absolute inset-0 rounded-full bg-emerald-500/60"
              animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          )}

          {/* The bouncing dot */}
          <motion.span
            className="relative size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
            animate={reducedMotion ? undefined : { y: [0, -5, 0] }}
            transition={
              reducedMotion
                ? undefined
                : {
                    duration: 1,
                    repeat: Infinity,
                    times: [0, 0.4, 1],
                    ease: ["easeOut", "easeIn"],
                  }
            }
          />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
