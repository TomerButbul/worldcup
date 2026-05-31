"use client";

import { motion } from "motion/react";
import { useMemo } from "react";

// Deterministic pseudo-random in [0,1) from a seed — pure (no Math.random),
// so it's safe to call during render. Varied enough for confetti.
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

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
        left: rand(i + 1) * 100,
        emoji: emojis[Math.floor(rand(i * 7 + 3) * emojis.length)],
        delay: rand(i * 3 + 2) * 0.5,
        dur: 1.6 + rand(i * 5 + 4) * 1.2,
        rotate: (rand(i * 9 + 5) - 0.5) * 720,
        size: 18 + rand(i * 11 + 6) * 22,
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
