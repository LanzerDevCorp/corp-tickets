"use client";

import { useState, useEffect } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useTransform,
} from "motion/react";

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
// "New ticket" indicator: a glowing emerald pulse dot with soft, medium
// expanding waves, shown to the left of the ticket subject. Powered by Motion.
//
// Uses Motion's frame loop (`useAnimationFrame`) + MotionValues instead of
// repeat keyframes. That makes the pulse explicit frame-by-frame and avoids the
// previous failure mode where the DOM reached the final keyframe and looked
// static in the live dashboard:
//   1. two expanding filled waves (scale grows, opacity fades)
//   2. two soft resting halos
//   3. a bright core that scales and brightens/dims
//
// - isNew=true  → mounts with a fade/scale-in, then idles as the pulse above.
// - isNew=false → AnimatePresence glides the whole indicator out to the left
//                 over 200ms (soft easing), then unmounts.
//
// Under prefers-reduced-motion every loop is disabled (static dot) and the
// enter/exit collapse to a near-instant fade. The element is aria-hidden and
// pointer-events-none — the expanding glow never intercepts the subject hover.
// ---------------------------------------------------------------------------

const SOFT_EASE = [0.16, 1, 0.3, 1] as const;
const PULSE_MS = 1400;

type NewTicketHighlightProps = {
  isNew: boolean;
};

function AnimatedPulseLayers() {
  const phase = useMotionValue(0);

  useAnimationFrame((time) => {
    phase.set((time % PULSE_MS) / PULSE_MS);
  });

  const waveOneScale = useTransform(phase, (p) => 1 + p * 1.4);
  const waveOneOpacity = useTransform(phase, (p) =>
    Math.max(0, 0.58 * (1 - p) ** 1.6),
  );

  const waveTwoScale = useTransform(phase, (p) => {
    const shifted = (p + 0.5) % 1;
    return 1 + shifted * 1.4;
  });
  const waveTwoOpacity = useTransform(phase, (p) => {
    const shifted = (p + 0.5) % 1;
    return Math.max(0, 0.5 * (1 - shifted) ** 1.6);
  });

  const pulse = useTransform(phase, (p) => {
    // 0 -> 1 -> 0 over the cycle.
    return (1 - Math.cos(p * Math.PI * 2)) / 2;
  });
  const coreScale = useTransform(pulse, (p) => 1 + p * 0.28);
  const coreShadow = useTransform(
    pulse,
    (p) =>
      `0 0 ${5 + p * 8}px ${1 + p * 3}px rgba(16,185,129,${0.1 + p * 0.05})`,
  );
  const haloScale = useTransform(pulse, (p) => 1 + p * 0.2);
  const haloOpacity = useTransform(pulse, (p) => 0.16 + p * 0.12);

  return (
    <>
      <motion.span
        data-testid="new-ticket-wave"
        className="absolute block size-2.5 rounded-full bg-emerald-400"
        style={{ scale: waveOneScale, opacity: waveOneOpacity }}
      />
      <motion.span
        data-testid="new-ticket-wave"
        className="absolute block size-2.5 rounded-full bg-emerald-400"
        style={{ scale: waveTwoScale, opacity: waveTwoOpacity }}
      />

      <motion.span
        className="absolute block size-4 rounded-full bg-emerald-400 blur-sm"
        style={{ scale: haloScale, opacity: haloOpacity }}
      />
      <span className="absolute block size-3 rounded-full bg-emerald-400/25" />

      <motion.span
        className="relative block size-2 rounded-full bg-emerald-500"
        style={{ scale: coreScale, boxShadow: coreShadow }}
      />
    </>
  );
}

export function NewTicketHighlight({ isNew }: NewTicketHighlightProps) {
  const reducedMotion = useReducedMotion();

  const enterTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: SOFT_EASE };

  // Exit (hover/seen): glide left in 200ms with soft easing.
  const exitTarget = reducedMotion
    ? { opacity: 0, transition: { duration: 0 } }
    : {
        opacity: 0,
        x: -20,
        transition: { duration: 0.2, ease: SOFT_EASE },
      };

  return (
    <AnimatePresence initial={false}>
      {isNew && (
        <motion.span
          data-testid="new-ticket-indicator"
          data-reduced-motion={reducedMotion ? "true" : "false"}
          aria-hidden="true"
          className="pointer-events-none relative -mr-0.5 -ml-1 inline-flex size-4 shrink-0 items-center justify-center overflow-visible"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={exitTarget}
          transition={enterTransition}
        >
          {reducedMotion ? (
            <>
              <span className="absolute block size-4 rounded-full bg-emerald-400/15 blur-sm" />
              <span className="absolute block size-3 rounded-full bg-emerald-400/25" />
              <span className="relative block size-2 rounded-full bg-emerald-500 shadow-[0_0_5px_1px_rgba(16,185,129,0.55)]" />
            </>
          ) : (
            <AnimatedPulseLayers />
          )}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
