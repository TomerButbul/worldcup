"use client";

import { motion } from "motion/react";
import { useMemo } from "react";

// A burst of emojis raining down once. Re-mount (change `key`) to replay.
export default function EmojiRain({
  emojis = ["🍅", "🤡", "💩", "👎"],
  count = 24,
}: {
  emojis?: string[];
  count?: number;
}) {
  const drops = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        delay: Math.random() * 0.5,
        dur: 1.6 + Math.random() * 1.2,
        rotate: (Math.random() - 0.5) * 720,
        size: 18 + Math.random() * 22,
      })),
    [count, emojis],
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {drops.map((d) => (
        <motion.span
          key={d.id}
          className="absolute"
          style={{ left: `${d.left}%`, fontSize: d.size }}
          initial={{ y: -60, opacity: 0, rotate: 0 }}
          animate={{ y: "110vh", opacity: [0, 1, 1, 0.8], rotate: d.rotate }}
          transition={{ duration: d.dur, delay: d.delay, ease: "easeIn" }}
        >
          {d.emoji}
        </motion.span>
      ))}
    </div>
  );
}
