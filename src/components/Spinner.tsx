"use client";

import { motion } from "motion/react";

export default function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-chalk-dim">
      <motion.div
        className="text-4xl"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      >
        ⚽
      </motion.div>
      <p className="text-sm">{label}</p>
    </div>
  );
}
