"use client";

import { useEffect, useRef, useState } from "react";
import { countUpValue } from "@/lib/countUp";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// An integer that tallies to its new value when `value` changes (a score landing),
// driven by a requestAnimationFrame clock over `countUpValue`. Snaps instantly under
// reduced motion. By default it does NOT animate on first mount (the board already
// has scores), so the count only fires on a real change; pass `playOnMount` for a
// hero number that should roll up from 0 on reveal. With `flash`, the digits glow
// gold while counting and ease back to their base colour when they settle.
export default function CountUp({
  value,
  durationMs = 700,
  playOnMount = false,
  flash = false,
  className = "",
}: {
  value: number;
  durationMs?: number;
  playOnMount?: boolean;
  flash?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [counting, setCounting] = useState(false);
  const fromRef = useRef(value); // where the next count starts
  const displayRef = useRef(value); // what's currently on screen (for smooth interrupts)
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const isMount = !mountedRef.current;
    mountedRef.current = true;

    const snap = () => {
      setDisplay(value);
      displayRef.current = value;
      fromRef.current = value;
      setCounting(false);
    };

    // First render with no roll-up requested, reduced motion, or zero duration: snap.
    if ((isMount && !playOnMount) || prefersReducedMotion() || durationMs <= 0) {
      snap();
      return;
    }

    const from = isMount && playOnMount ? 0 : fromRef.current;
    const to = value;
    if (from === to) {
      snap();
      return;
    }

    setCounting(true);
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const progress = (now - startRef.current) / durationMs;
      const v = countUpValue(from, to, progress);
      displayRef.current = v;
      setDisplay(v);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        rafRef.current = null;
        setCounting(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      // Interrupted mid-count: start the next count from the number on screen now.
      fromRef.current = displayRef.current;
    };
  }, [value, durationMs, playOnMount]);

  return (
    <span
      className={`tabular-nums transition-colors duration-300 ${className}`}
      style={flash && counting ? { color: "var(--color-gold)" } : undefined}
    >
      {display}
    </span>
  );
}
