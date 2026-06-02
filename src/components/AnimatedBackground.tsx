"use client";

import { motion, useReducedMotion } from "motion/react";
import SoccerBall from "@/components/SoccerBall";
import { Trophy, PlayerKick, Pennant } from "@/components/BackgroundSprites";

// Drifting glow orbs + pitch lines behind everything for a stadium feel.
export default function AnimatedBackground() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* pitch stripe texture */}
      <div className="absolute inset-0 pitch-stripes opacity-60" />

      {/* football pitch markings (subtle) */}
      <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-night/[0.06]" />
      <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-night/15" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-night/[0.05]" />
      {/* penalty + goal boxes, top and bottom */}
      <div className="absolute left-1/2 top-0 h-28 w-72 -translate-x-1/2 border-x border-b border-night/[0.07] sm:w-96" />
      <div className="absolute left-1/2 top-0 h-12 w-40 -translate-x-1/2 border-x border-b border-night/[0.07]" />
      <div className="absolute bottom-0 left-1/2 h-28 w-72 -translate-x-1/2 border-x border-t border-night/[0.07] sm:w-96" />
      <div className="absolute bottom-0 left-1/2 h-12 w-40 -translate-x-1/2 border-x border-t border-night/[0.07]" />
      {/* corner arcs */}
      <div className="absolute left-0 top-0 h-6 w-6 rounded-br-full border-b border-r border-night/[0.07]" />
      <div className="absolute right-0 top-0 h-6 w-6 rounded-bl-full border-b border-l border-night/[0.07]" />
      <div className="absolute bottom-0 left-0 h-6 w-6 rounded-tr-full border-t border-r border-night/[0.07]" />
      <div className="absolute bottom-0 right-0 h-6 w-6 rounded-tl-full border-t border-l border-night/[0.07]" />

      {/* drifting vibrant glow orbs (lighter blur on mobile for paint perf) */}
      <motion.div
        className="absolute -left-32 top-10 h-96 w-96 rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.22), transparent 70%)" }}
        animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-0 top-1/4 h-[28rem] w-[28rem] rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(219,39,119,0.18), transparent 70%)" }}
        animate={reduce ? undefined : { x: [0, -50, 0], y: [0, 60, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.22), transparent 70%)" }}
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-10 right-1/4 h-72 w-72 rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(245,180,0,0.20), transparent 70%)" }}
        animate={reduce ? undefined : { x: [0, -35, 0], y: [0, -45, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* floating themed sprites — fewer on mobile, none if reduced motion */}
      {!reduce &&
        SPRITES.map((s, i) => (
          <motion.div
            key={i}
            className={`absolute opacity-70 ${i >= 3 ? "hidden sm:block" : ""}`}
            style={{ left: s.left }}
            initial={{ y: "110vh", rotate: 0 }}
            animate={{ y: "-20vh", x: [0, s.drift, 0], rotate: [0, s.rotate, 0] }}
            transition={{
              y: { duration: s.dur, repeat: Infinity, ease: "linear", delay: s.delay },
              x: { duration: s.dur / 3, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: s.dur / 4, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            {renderSprite(s)}
          </motion.div>
        ))}

      {/* whisper-soft edge shade (light mode — keeps it airy) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_80%,rgba(12,20,48,0.05))]" />
    </div>
  );
}

type SpriteSpec = {
  kind: "trophy" | "ball" | "player" | "flag";
  color?: string;
  size: number;
  left: string;
  drift: number;
  dur: number;
  delay: number;
  rotate: number;
};

const SPRITES: SpriteSpec[] = [
  { kind: "trophy", size: 40, left: "8%", drift: 30, dur: 26, delay: 0, rotate: 8 },
  { kind: "flag", color: "#2563eb", size: 38, left: "48%", drift: -25, dur: 32, delay: 6, rotate: -10 },
  { kind: "ball", size: 34, left: "85%", drift: 20, dur: 24, delay: 9, rotate: 16 },
  { kind: "player", color: "#db2777", size: 44, left: "22%", drift: 35, dur: 29, delay: 12, rotate: -8 },
  { kind: "trophy", size: 36, left: "67%", drift: -30, dur: 35, delay: 3, rotate: 10 },
  { kind: "flag", color: "#10b981", size: 38, left: "93%", drift: -20, dur: 38, delay: 15, rotate: -12 },
];

function renderSprite(s: SpriteSpec) {
  switch (s.kind) {
    case "trophy":
      return <Trophy size={s.size} />;
    case "ball":
      return <SoccerBall size={s.size} />;
    case "player":
      return <PlayerKick size={s.size} color={s.color} />;
    case "flag":
      return <Pennant size={s.size} color={s.color} />;
  }
}
