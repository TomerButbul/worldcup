"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

// First-load title sequence. A deep-night stage → gold bloom → the ball spins in
// → the wordmark ignites in the FIFA gradient with a light sweep → a curtain rises
// to reveal the app. Shown once per browser session, skippable (tap anywhere),
// and skipped entirely for prefers-reduced-motion. Mounted in the root layout, so
// it overlays everything (bunting, nav) on the first page of a session.
const SEEN_KEY = "wc_splash_v1";

export default function SplashIntro() {
  const [show, setShow] = useState(true);
  const [exiting, setExiting] = useState(false);
  const finished = useRef(false);

  // Begin the curtain rise (skip or auto), once.
  const dismiss = () => setExiting(true);
  // Tear down: restore scroll + unmount. Idempotent.
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    document.body.style.overflow = "";
    setShow(false);
  };

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch {}
    if (reduce || seen) { finished.current = true; setShow(false); return; }
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}

    document.body.style.overflow = "hidden"; // hold the page still behind the curtain
    const tExit = setTimeout(dismiss, 1750);
    const tSafety = setTimeout(finish, 2700); // belt-and-suspenders if onAnimationComplete misses
    return () => { clearTimeout(tExit); clearTimeout(tSafety); };
  }, []);

  if (!show) return null;

  // Staggered text reveal
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <motion.div
      aria-hidden
      onClick={dismiss}
      className="fixed inset-0 z-[300] flex cursor-pointer items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(125% 90% at 50% 32%, #1b2452 0%, #0c1430 52%, #06091e 100%)" }}
      initial={{ y: 0 }}
      animate={{ y: exiting ? "-101%" : 0 }}
      transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}
      onAnimationComplete={() => { if (exiting) finish(); }}
    >
      {/* gold bloom */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[32%] h-[64vmin] w-[64vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,207,61,0.30), rgba(255,207,61,0) 70%)" }}
        initial={{ opacity: 0, scale: 0.55 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      {/* faint stadium centre-circle */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[32%] h-[78vmin] w-[78vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* spinning ball drop-in */}
        <motion.img
          src="/ball.svg"
          alt=""
          width={66}
          height={66}
          style={{ width: 66, height: 66 }}
          className="mb-5 drop-shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
          initial={{ y: -130, rotate: -230, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 15, delay: 0.05 }}
        />

        <motion.span
          {...rise(0.42)}
          className="font-display text-[0.72rem] uppercase tracking-[0.42em] text-gold-bright"
        >
          FIFA World Cup 2026
        </motion.span>

        {/* wordmark + one-shot light sweep */}
        <div className="relative mt-2 overflow-hidden">
          <motion.div
            {...rise(0.56)}
            className="text-gradient-fifa font-display text-[clamp(2.6rem,12vw,5rem)] leading-[0.9] tracking-tight"
          >
            Predict the
            <br />
            World Cup
          </motion.div>
          <motion.div
            className="pointer-events-none absolute inset-0 -skew-x-12"
            style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)", mixBlendMode: "overlay" }}
            initial={{ x: "-130%" }}
            animate={{ x: "130%" }}
            transition={{ delay: 1.0, duration: 0.7, ease: "easeInOut" }}
          />
        </div>

        <motion.span
          {...rise(0.78)}
          className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-chalk-dim"
        >
          Bracket · Scores · Glory
        </motion.span>
      </div>

      <motion.span
        className="absolute bottom-[max(env(safe-area-inset-bottom),1.25rem)] text-[0.65rem] uppercase tracking-[0.25em] text-white/35"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        tap to skip
      </motion.span>
    </motion.div>
  );
}
