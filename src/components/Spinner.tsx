"use client";

import { motion, useReducedMotion } from "motion/react";
import SoccerBall from "@/components/SoccerBall";

export default function Spinner({ label = "Loading…" }: { label?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center gap-4 text-chalk-dim">
      <motion.div
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      >
        <SoccerBall size={44} />
      </motion.div>
      <p className="text-sm">{label}</p>
    </div>
  );
}
