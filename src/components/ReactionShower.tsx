"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";

// Emoji "reaction shower" for the draft room. Taps fire a Supabase Realtime
// *broadcast* (ephemeral — no DB writes), so every connected manager sees the
// same emoji rain in real time. Spam away; we just cap concurrent sprites.
const EMOJIS = ["🔥", "😂", "💩", "🤡", "🧠", "👀"];
const MAX = 36;

interface Floater {
  id: number;
  emoji: string;
  left: number; // vw %
  dur: number; // seconds
  drift: number; // px horizontal sway
  size: number; // rem
}

export default function ReactionShower({ leagueId }: { leagueId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const idRef = useRef(0);

  function spawn(emoji: string) {
    setFloaters((cur) => {
      const next: Floater = {
        id: idRef.current++,
        emoji,
        left: 3 + Math.random() * 90,
        dur: 2.6 + Math.random() * 1.9,
        drift: (Math.random() - 0.5) * 90,
        size: 1.6 + Math.random() * 1.4,
      };
      const arr = [...cur, next];
      return arr.length > MAX ? arr.slice(arr.length - MAX) : arr;
    });
  }

  useEffect(() => {
    const channel = supabase.channel(`reactions-${leagueId}`);
    channel
      .on("broadcast", { event: "react" }, ({ payload }) => {
        const emoji = (payload as { emoji?: string })?.emoji;
        if (emoji) spawn(emoji); // reactions from everyone else
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, leagueId]);

  function react(emoji: string) {
    spawn(emoji); // our own tap shows instantly (no round-trip)
    channelRef.current?.send({ type: "broadcast", event: "react", payload: { emoji } });
  }

  return (
    <>
      {/* Falling emoji overlay (doesn't block taps). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.span
              key={f.id}
              className="absolute"
              style={{ left: `${f.left}%`, top: 0, fontSize: `${f.size}rem` }}
              initial={{ y: "-12vh", x: 0, opacity: 0, rotate: 0 }}
              animate={{ y: "112vh", x: f.drift, opacity: [0, 1, 1, 1, 0.9], rotate: f.drift > 0 ? 50 : -50 }}
              exit={{ opacity: 0 }}
              transition={{ duration: f.dur, ease: "linear", opacity: { duration: f.dur, times: [0, 0.08, 0.5, 0.85, 1] } }}
              onAnimationComplete={() =>
                setFloaters((cur) => cur.filter((x) => x.id !== f.id))
              }
            >
              {f.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* Reaction bar — only the pill is tappable, so it never blocks the
          content around it. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3">
        <div className="glass-strong pointer-events-auto flex items-center gap-1 rounded-full px-2.5 py-2 shadow-xl">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => react(e)}
              aria-label={`React ${e}`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-2xl leading-none transition active:scale-90 hover:bg-night/5"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
