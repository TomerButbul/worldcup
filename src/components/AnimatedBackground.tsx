"use client";

import { motion, useReducedMotion } from "motion/react";
import SoccerBall from "@/components/SoccerBall";
import { Trophy, PlayerKick, Pennant } from "@/components/BackgroundSprites";

// Stadium-feel backdrop. Perf note: the glow orbs are STATIC (a moving 64px
// blur repaints every frame and tanks mobile). The few drifting sprites only
// run on desktop (sm+) and never under reduced-motion. Mobile = no continuous
// animation back here at all.
export default function AnimatedBackground() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* pitch stripe texture */}
      <div className="absolute inset-0 pitch-stripes opacity-60" />

      {/* football pitch markings (subtle, static) */}
      <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-night/[0.06]" />
      <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-night/15" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-night/[0.05]" />
      <div className="absolute left-1/2 top-0 h-28 w-72 -translate-x-1/2 border-x border-b border-night/[0.07] sm:w-96" />
      <div className="absolute left-1/2 top-0 h-12 w-40 -translate-x-1/2 border-x border-b border-night/[0.07]" />
      <div className="absolute bottom-0 left-1/2 h-28 w-72 -translate-x-1/2 border-x border-t border-night/[0.07] sm:w-96" />
      <div className="absolute bottom-0 left-1/2 h-12 w-40 -translate-x-1/2 border-x border-t border-night/[0.07]" />
      <div className="absolute left-0 top-0 h-6 w-6 rounded-br-full border-b border-r border-night/[0.07]" />
      <div className="absolute right-0 top-0 h-6 w-6 rounded-bl-full border-b border-l border-night/[0.07]" />
      <div className="absolute bottom-0 left-0 h-6 w-6 rounded-tr-full border-t border-r border-night/[0.07]" />
      <div className="absolute bottom-0 right-0 h-6 w-6 rounded-tl-full border-t border-l border-night/[0.07]" />

      {/* vibrant glow orbs — STATIC (painted once, then just composited) */}
      <div
        className="absolute -left-32 top-10 h-96 w-96 rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.22), transparent 70%)" }}
      />
      <div
        className="absolute right-0 top-1/4 h-[28rem] w-[28rem] rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(219,39,119,0.18), transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.22), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-10 right-1/4 h-72 w-72 rounded-full blur-2xl sm:blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(245,180,0,0.20), transparent 70%)" }}
      />

      {/* a few floating sprites — DESKTOP ONLY, and never under reduced motion */}
      {!reduce &&
        SPRITES.map((s, i) => (
          <motion.div
            key={i}
            className="absolute hidden opacity-20 sm:block"
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

      {/* whisper-soft edge shade */}
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

// Trimmed to 4 (was 6) and slowed down — desktop ambiance without the churn.
const SPRITES: SpriteSpec[] = [
  { kind: "trophy", size: 40, left: "8%", drift: 30, dur: 34, delay: 0, rotate: 8 },
  { kind: "ball", size: 34, left: "85%", drift: 20, dur: 32, delay: 9, rotate: 16 },
  { kind: "player", color: "#db2777", size: 44, left: "22%", drift: 35, dur: 38, delay: 6, rotate: -8 },
  { kind: "flag", color: "#10b981", size: 38, left: "67%", drift: -20, dur: 44, delay: 14, rotate: -12 },
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
