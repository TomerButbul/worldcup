"use client";

import { motion, useReducedMotion } from "motion/react";

// Drifting glow orbs + pitch lines behind everything for a stadium feel.
export default function AnimatedBackground() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* pitch stripe texture */}
      <div className="absolute inset-0 pitch-stripes opacity-60" />

      {/* center circle (subtle) */}
      <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/5" />

      {/* drifting glow orbs (lighter blur on mobile for paint perf) */}
      <motion.div
        className="absolute -left-32 top-10 h-96 w-96 rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(25,195,125,0.35), transparent 70%)" }}
        animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(246,196,83,0.22), transparent 70%)" }}
        animate={reduce ? undefined : { x: [0, -50, 0], y: [0, 60, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(11,61,44,0.6), transparent 70%)" }}
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* floating party balloons — fewer on mobile, none if reduced motion */}
      {!reduce &&
        BALLOONS.map((b, i) => (
          <motion.div
            key={i}
            className={`absolute text-3xl opacity-70 ${i >= 3 ? "hidden sm:block" : ""}`}
            style={{ left: b.left }}
            initial={{ y: "110vh" }}
            animate={{ y: "-20vh", x: [0, b.drift, 0] }}
            transition={{
              y: { duration: b.dur, repeat: Infinity, ease: "linear", delay: b.delay },
              x: { duration: b.dur / 3, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            {b.emoji}
          </motion.div>
        ))}

      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55))]" />
    </div>
  );
}

const BALLOONS = [
  { emoji: "🎈", left: "8%", drift: 30, dur: 26, delay: 0 },
  { emoji: "🎉", left: "48%", drift: -25, dur: 32, delay: 6 },
  { emoji: "⚽", left: "85%", drift: 20, dur: 24, delay: 9 },
  { emoji: "🎈", left: "22%", drift: 35, dur: 29, delay: 12 },
  { emoji: "🥳", left: "67%", drift: -30, dur: 35, delay: 3 },
  { emoji: "🎈", left: "93%", drift: -20, dur: 38, delay: 15 },
];
