"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

// Entrance animation. Use `index` to stagger items in a list.
export default function Reveal({
  children,
  index = 0,
  className,
  y = 16,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
