"use client";

import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// useReducedMotion
// ---------------------------------------------------------------------------
// Reads window.matchMedia synchronously on the first render (lazy useState)
// so the correct CSS class is applied without a flash. Falls back to false
// (allow motion) when matchMedia is unavailable (SSR or older browsers).
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

// ---------------------------------------------------------------------------
// Particle delays (8 particles staggered evenly across the 2.4 s cycle)
// ---------------------------------------------------------------------------
const PARTICLE_DELAYS: number[] = Array.from(
  { length: 8 },
  (_, i) => parseFloat(((i * 2.4) / 8).toFixed(3)),
);

// ---------------------------------------------------------------------------
// NewTicketHighlight
// ---------------------------------------------------------------------------
// Renders an absolutely-positioned overlay that draws a traveling rainbow
// border + synchronized glow + particle trail around the parent <tr> row.
// The parent row must have `position: relative` (class "relative").
//
// When isNew=false the component renders null — no DOM nodes are emitted.
// All animated layers are inside @media (prefers-reduced-motion: no-preference)
// in app/globals.css; under reduced motion a static gradient ring is shown.
// ---------------------------------------------------------------------------

type NewTicketHighlightProps = {
  isNew: boolean;
};

export function NewTicketHighlight({ isNew }: NewTicketHighlightProps) {
  const reducedMotion = useReducedMotion();

  if (!isNew) return null;

  const modeClass = reducedMotion ? "new-ticket-static" : "new-ticket-animated";

  return (
    <div
      className={`new-ticket-overlay ${modeClass}`}
      data-testid="new-ticket-overlay"
      aria-hidden="true"
    >
      {/* Layer 1: traveling rainbow border (CSS conic-gradient + mask) */}
      <div className="new-ticket-border" />

      {/* Layer 2: synchronized glow (CSS keyframe, same 2.4 s period) */}
      <div className="new-ticket-glow" />

      {/* Layer 3: particle trail — only rendered when motion is allowed */}
      {!reducedMotion &&
        PARTICLE_DELAYS.map((delay, i) => (
          <span
            key={i}
            className="new-ticket-particle"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
    </div>
  );
}
