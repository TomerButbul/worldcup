"use client";

import { motion } from "motion/react";
import Countdown from "@/components/Countdown";
import Trophy from "@/components/art/Trophy";

export default function Hero() {
  return (
    <div className="space-y-5">
      <motion.p
        className="font-display text-sm uppercase tracking-[0.35em] text-gold/90 sm:text-base"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        TopCorner
      </motion.p>
      <motion.div
        className="text-6xl sm:text-8xl"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
      >
        <motion.span
          className="inline-block drop-shadow-[0_0_25px_rgba(246,196,83,0.6)]"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Trophy size={92} />
        </motion.span>
      </motion.div>

      <motion.h1
        className="font-display text-4xl leading-none sm:text-7xl"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <span className="text-gradient-gold">Play the</span>{" "}
        <span className="text-shimmer-fifa">World Cup</span>
      </motion.h1>

      <motion.p
        className="mx-auto max-w-lg text-chalk-dim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.45 }}
      >
        Predict the 2026 tournament your way, or just follow every match live — scores,
        lineups, stats and every squad, all in one place. Football obsessive or
        first-timer, you&apos;re in.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="pt-2"
      >
        <Countdown />
      </motion.div>
    </div>
  );
}
