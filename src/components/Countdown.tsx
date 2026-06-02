"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { KICKOFF_MS } from "@/lib/clock";
import { celebrate } from "@/lib/confetti";
import { goalCelebration } from "@/lib/goal";

type Parts = { days: number; hours: number; mins: number; secs: number };

function partsUntil(target: number): Parts | null {
  const diff = target - Date.now();
  if (diff <= 0) return null;
  const total = Math.floor(diff / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    mins: Math.floor((total % 3600) / 60),
    secs: total % 60,
  };
}

export default function Countdown({
  target = KICKOFF_MS,
  className = "",
}: {
  target?: number;
  className?: string;
}) {
  // parts stays null until mounted (keeps SSR + first client render identical),
  // and again once kickoff passes.
  const [parts, setParts] = useState<Parts | null>(null);
  const [mounted, setMounted] = useState(false);
  const [live, setLive] = useState(false);
  const reduce = useReducedMotion();

  // Latches so the kickoff party fires exactly once — and only if the user
  // actually watched the clock cross zero (not on every post-kickoff reload).
  const fired = useRef(false);
  const sawCountdown = useRef(false);

  useEffect(() => {
    setMounted(true);

    const tick = () => {
      const p = partsUntil(target);
      if (p) {
        sawCountdown.current = true;
        setParts(p);
        return;
      }
      setParts(null);
      setLive(true);
      if (!fired.current && sawCountdown.current) {
        fired.current = true;
        celebrate();
        goalCelebration("KICK OFF!");
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (mounted && live) return <LiveBadge className={className} reduce={!!reduce} />;

  const units = [
    { value: parts?.days ?? null, label: "Days" },
    { value: parts?.hours ?? null, label: "Hrs" },
    { value: parts?.mins ?? null, label: "Min" },
    { value: parts?.secs ?? null, label: "Sec" },
  ];

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <p className="flex items-center gap-2 font-display text-sm tracking-widest text-chalk-dim sm:text-base">
        <span className="text-lg">⚽</span> Kickoff in
      </p>
      <div className="flex items-stretch gap-2 sm:gap-3">
        {units.map((u) => (
          <Tile key={u.label} value={u.value} label={u.label} reduce={!!reduce} />
        ))}
      </div>
    </div>
  );
}

function Tile({
  value,
  label,
  reduce,
}: {
  value: number | null;
  label: string;
  reduce: boolean;
}) {
  const text = value == null ? "––" : String(value).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-16 w-14 overflow-hidden rounded-2xl glass-strong sm:h-24 sm:w-20">
        <span className="absolute inset-0 net opacity-30" aria-hidden />
        {reduce || value == null ? (
          <span className="absolute inset-0 flex items-center justify-center font-display text-3xl text-gradient-gold sm:text-5xl">
            {text}
          </span>
        ) : (
          <AnimatePresence initial={false}>
            <motion.span
              key={text}
              className="absolute inset-0 flex items-center justify-center font-display text-3xl text-gradient-gold sm:text-5xl"
              initial={{ y: "-110%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={{ y: "110%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              {text}
            </motion.span>
          </AnimatePresence>
        )}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-chalk-dim sm:text-xs">
        {label}
      </span>
    </div>
  );
}

function LiveBadge({ className, reduce }: { className: string; reduce: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <motion.div
        className="glass-strong glow-grass flex items-center gap-3 rounded-2xl px-5 py-4 animate-pulse-glow"
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
      >
        <motion.span
          className="text-3xl sm:text-4xl"
          animate={reduce ? undefined : { rotate: [0, 14, -14, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          ⚽
        </motion.span>
        <span className="font-display text-xl text-gradient-fifa sm:text-3xl">
          The World Cup is LIVE
        </span>
      </motion.div>
      <p className="text-sm text-chalk-dim">Brackets are locked — let the games begin.</p>
    </div>
  );
}
