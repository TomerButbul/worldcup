"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

// First-load title card — bright & festive to match the app (light pastel wash,
// flag bunting, confetti, gold). The ball bounces in, the wordmark pops in the
// FIFA gradient, confetti rains, then the whole card fades to reveal the app.
// Shown once per browser session, tap-to-skip, and skipped entirely for
// prefers-reduced-motion. Mounted in the root layout so it overlays everything.
const SEEN_KEY = "wc_splash_v2";

// Festive palette (gold / grass / electric / magenta + white).
const PALETTE = ["#ffcf3d", "#34d399", "#2563eb", "#db2777", "#e0a400", "#ffffff"];
// Pennant bunting colors (alternating, evokes the app's FlagGarland).
const PENNANTS = Array.from({ length: 15 }, (_, i) => PALETTE[i % PALETTE.length]);
// Deterministic confetti (fixed values → no hydration drift, no Math.random).
const CONFETTI = [
  { l: 6, s: 10, d: 0.0, dur: 2.7, dx: 14 }, { l: 14, s: 8, d: 0.6, dur: 3.1, dx: -10 },
  { l: 23, s: 12, d: 0.2, dur: 2.5, dx: 8 }, { l: 31, s: 7, d: 1.1, dur: 3.3, dx: -14 },
  { l: 39, s: 9, d: 0.4, dur: 2.9, dx: 12 }, { l: 47, s: 11, d: 0.9, dur: 2.6, dx: -8 },
  { l: 55, s: 8, d: 0.1, dur: 3.2, dx: 10 }, { l: 63, s: 10, d: 0.7, dur: 2.8, dx: -12 },
  { l: 71, s: 7, d: 1.3, dur: 3.0, dx: 6 }, { l: 79, s: 12, d: 0.3, dur: 2.6, dx: -10 },
  { l: 87, s: 9, d: 0.8, dur: 3.2, dx: 14 }, { l: 94, s: 8, d: 1.0, dur: 2.9, dx: -6 },
  { l: 19, s: 9, d: 1.5, dur: 2.8, dx: 9 }, { l: 50, s: 7, d: 1.7, dur: 3.1, dx: -9 },
  { l: 83, s: 10, d: 1.4, dur: 2.7, dx: 7 },
].map((c, i) => ({ ...c, color: PALETTE[i % PALETTE.length] }));

export default function SplashIntro() {
  const [show, setShow] = useState(true);
  const [exiting, setExiting] = useState(false);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    document.body.style.overflow = "";
    setShow(false);
  }, []);
  const dismiss = useCallback(() => setExiting(true), []);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch {}
    if (reduce || seen) { finished.current = true; setShow(false); return; }
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}

    document.body.style.overflow = "hidden";
    const tExit = setTimeout(() => setExiting(true), 2000);
    const tSafety = setTimeout(finish, 3000); // backstop if onAnimationComplete misses
    return () => { clearTimeout(tExit); clearTimeout(tSafety); };
  }, [finish]);

  if (!show) return null;

  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <motion.div
      aria-hidden
      onClick={dismiss}
      className="fixed inset-0 z-[300] flex cursor-pointer flex-col items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(125% 100% at 50% 22%, #ffffff 0%, #eef3ff 48%, #dfe8ff 100%)" }}
      initial={{ opacity: 1, scale: 1 }}
      animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 1.06 : 1 }}
      transition={{ duration: 0.62, ease: [0.76, 0, 0.24, 1] }}
      onAnimationComplete={() => { if (exiting) finish(); }}
    >
      {/* warm gold glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-[26%] h-[58vmin] w-[58vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(224,164,0,0.18), rgba(224,164,0,0) 70%)" }}
      />

      {/* pennant bunting, sways in from the top */}
      <motion.div
        className="absolute inset-x-0 top-0 flex origin-top justify-center gap-1 px-2"
        initial={{ y: -40, opacity: 0, rotate: -2 }}
        animate={{ y: 0, opacity: 1, rotate: [-2, 1.5, -1, 0] }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      >
        {PENNANTS.map((c, i) => (
          <span
            key={i}
            style={{ borderTopColor: c }}
            className="h-0 w-0 border-l-[9px] border-r-[9px] border-t-[15px] border-l-transparent border-r-transparent drop-shadow-sm"
          />
        ))}
      </motion.div>

      {/* confetti rain */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <motion.span
            key={i}
            className="absolute top-0 rounded-[2px]"
            style={{ left: `${c.l}%`, width: c.s, height: c.s, background: c.color }}
            initial={{ y: "-12vh", rotate: 0, opacity: 0 }}
            animate={{ y: "115vh", x: [0, c.dx, 0], rotate: 340, opacity: [0, 1, 1, 0] }}
            transition={{ duration: c.dur, delay: c.d, repeat: Infinity, ease: "linear", times: [0, 0.1, 0.85, 1] }}
          />
        ))}
      </div>

      {/* content */}
      <div className="relative flex flex-col items-center px-6 text-center">
        <motion.img
          src="/ball.svg"
          alt=""
          width={66}
          height={66}
          style={{ width: 66, height: 66 }}
          className="mb-4 drop-shadow-[0_10px_22px_rgba(20,27,61,0.25)]"
          initial={{ y: -120, rotate: -200, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 13, delay: 0.05 }}
        />

        <motion.span
          {...rise(0.4)}
          className="font-display text-[0.72rem] uppercase tracking-[0.4em] text-gold"
        >
          FIFA World Cup 2026
        </motion.span>

        <motion.div
          className="text-gradient-fifa mt-2 font-display text-[clamp(2.6rem,12vw,5rem)] leading-[0.9] tracking-tight"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.5 }}
        >
          Predict the
          <br />
          World Cup
        </motion.div>

        <motion.span
          {...rise(0.85)}
          className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-chalk-dim"
        >
          Bracket · Scores · Glory
        </motion.span>
      </div>

      <motion.span
        className="absolute bottom-[max(env(safe-area-inset-bottom),1.25rem)] text-[0.65rem] uppercase tracking-[0.25em] text-chalk-dim/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        tap to skip
      </motion.span>
    </motion.div>
  );
}
