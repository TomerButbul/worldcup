"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

// First-load title card — bright & festive (light pastel wash, flag bunting,
// confetti, gold). The ball bounces in and the wordmark pops in the FIFA gradient,
// then the card fades to reveal the app.
//
// iOS PWA note: an installed PWA shows a NATIVE (white) launch screen while the
// page boots, and keeps the web session alive across reopens. So we (a) don't play
// the entrance until the page is actually VISIBLE (else it animates behind the
// native screen and you miss it), and (b) in standalone, show it on every cold
// launch rather than once-per-session (sessionStorage persists there forever).
// Tap-to-skip; skipped entirely for prefers-reduced-motion.
const SEEN_KEY = "wc_splash_v3";

const PALETTE = ["#ffcf3d", "#34d399", "#2563eb", "#db2777", "#e0a400", "#ffffff"];
const PENNANTS = Array.from({ length: 15 }, (_, i) => PALETTE[i % PALETTE.length]);
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

type Phase = "wait" | "play" | "exit";

export default function SplashIntro() {
  const [show, setShow] = useState(true);
  const [phase, setPhase] = useState<Phase>("wait");
  const finished = useRef(false);
  const armed = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    document.body.style.overflow = "";
    setShow(false);
  }, []);

  useEffect(() => {
    const mm = (q: string) => !!window.matchMedia?.(q).matches;
    if (mm("(prefers-reduced-motion: reduce)")) { finished.current = true; setShow(false); return; }

    const standalone =
      mm("(display-mode: standalone)") || (navigator as { standalone?: boolean }).standalone === true;

    if (!standalone) {
      // Browser tab: once per session.
      let seen = false;
      try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch {}
      if (seen) { finished.current = true; setShow(false); return; }
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}
    }

    document.body.style.overflow = "hidden";

    let tArm: ReturnType<typeof setTimeout>;
    let tExit: ReturnType<typeof setTimeout>;
    const tHardStop = setTimeout(finish, 6000); // absolute backstop — never stick

    const arm = () => {
      if (armed.current) return;
      armed.current = true;
      document.removeEventListener("visibilitychange", onVis);
      setPhase("play");
      tExit = setTimeout(() => setPhase("exit"), 2000);
    };
    const onVis = () => { if (document.visibilityState === "visible") arm(); };

    if (document.visibilityState === "hidden") {
      // iOS standalone often reports hidden while the native launch screen is up.
      document.addEventListener("visibilitychange", onVis);
      tArm = setTimeout(arm, 2500); // fallback if it never fires
    } else {
      // Visible already: in standalone give the native launch a beat to clear.
      tArm = setTimeout(arm, standalone ? 750 : 16);
    }

    return () => {
      clearTimeout(tArm); clearTimeout(tExit); clearTimeout(tHardStop);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [finish]);

  if (!show) return null;

  const playing = phase !== "wait";
  const content = (delay: number, hidden: Record<string, number>, shown: Record<string, number>) => ({
    initial: hidden,
    animate: playing ? shown : hidden,
    transition: { delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <motion.div
      aria-hidden
      onClick={() => setPhase("exit")}
      className="fixed inset-0 z-[300] flex cursor-pointer flex-col items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(125% 100% at 50% 22%, #ffffff 0%, #eef3ff 48%, #dfe8ff 100%)" }}
      initial={{ opacity: 1, scale: 1 }}
      animate={{ opacity: phase === "exit" ? 0 : 1, scale: phase === "exit" ? 1.06 : 1 }}
      transition={{ duration: 0.62, ease: [0.76, 0, 0.24, 1] }}
      onAnimationComplete={() => { if (phase === "exit") finish(); }}
    >
      {/* warm gold glow — visible from the first frame so a glimpse is never white */}
      <div
        className="pointer-events-none absolute left-1/2 top-[26%] h-[58vmin] w-[58vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(224,164,0,0.18), rgba(224,164,0,0) 70%)" }}
      />

      {/* pennant bunting */}
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

      {/* content — entrance held until the page is visible (see arm()) */}
      <div className="relative flex flex-col items-center px-6 text-center">
        <motion.img
          src="/ball.svg"
          alt=""
          width={66}
          height={66}
          style={{ width: 66, height: 66 }}
          className="mb-4 drop-shadow-[0_10px_22px_rgba(20,27,61,0.25)]"
          initial={{ y: -120, rotate: -200, opacity: 0 }}
          animate={playing ? { y: 0, rotate: 0, opacity: 1 } : { y: -120, rotate: -200, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 13 }}
        />

        <motion.span {...content(0.35, { opacity: 0, y: 20 }, { opacity: 1, y: 0 })} className="font-display text-[0.72rem] uppercase tracking-[0.4em] text-gold">
          FIFA World Cup 2026
        </motion.span>

        <motion.div
          className="text-gradient-fifa mt-2 font-display text-[clamp(2.6rem,12vw,5rem)] leading-[0.9] tracking-tight"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={playing ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 10 }}
          transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.12 }}
        >
          Predict the
          <br />
          World Cup
        </motion.div>

        <motion.span {...content(0.5, { opacity: 0, y: 20 }, { opacity: 1, y: 0 })} className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-chalk-dim">
          Bracket · Scores · Glory
        </motion.span>
      </div>

      <span className="absolute bottom-[max(env(safe-area-inset-bottom),1.25rem)] text-[0.65rem] uppercase tracking-[0.25em] text-chalk-dim/60">
        tap to skip
      </span>
    </motion.div>
  );
}
