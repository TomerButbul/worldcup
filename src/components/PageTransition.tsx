"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";

// A quick cross-fade on every route change — so swiping (and tapping a tab) eases
// in instead of hard-cutting. Keyed by pathname so each page re-animates; opacity-
// only + fast, so it doesn't fight the per-section <Reveal> entrances on the pages.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
