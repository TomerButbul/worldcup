"use client";

import { motion } from "motion/react";
import Countdown from "@/components/Countdown";
import Trophy from "@/components/art/Trophy";

export default function Hero() {
  return (
    <div className="space-y-5">
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
          <Trophy size={112} className="h-[72px] w-[72px] sm:h-28 sm:w-28" />
        </motion.span>
      </motion.div>

      <motion.h1
        className="font-display text-4xl leading-none sm:text-7xl"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <span className="text-gradient-fifa">World</span>{" "}
        <span className="text-gradient-gold">Cup</span>{" "}
        <span className="text-grass">2026</span>
      </motion.h1>

      <motion.p
        className="mx-auto max-w-md text-chalk-dim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.45 }}
      >
        Predict the bracket, call every match, and battle your friends across three
        leaderboards. Glory awaits.
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
