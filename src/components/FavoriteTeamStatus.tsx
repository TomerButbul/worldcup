"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import type { FavTeamStatus } from "@/lib/favoriteStatus";
import Flag from "@/components/Flag";
import Trophy from "@/components/art/Trophy";
import { playCheer, playWomp } from "@/lib/sound";
import { celebrate } from "@/lib/confetti";

export default function FavoriteTeamStatus({ status }: { status: FavTeamStatus }) {
  const good = status.mood === "good";
  const bad = status.mood === "bad";

  // Auto-play sound reaction once on mount (only fires if user has interacted + unmuted).
  useEffect(() => {
    if (good) playCheer();
    else if (bad) playWomp();
  }, [good, bad]);

  const ring = good
    ? "border-grass/60 glow-grass"
    : bad
      ? "border-red-500/50"
      : "border-night/10";

  const kickoff = status.next
    ? new Date(status.next.kickoff).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass-strong rounded-2xl border p-5 ${ring}`}
    >
      <div className="flex items-center gap-4">
        <motion.div
          animate={
            good
              ? { y: [0, -8, 0] }
              : bad
                ? { rotate: [0, -6, 6, -6, 0] }
                : {}
          }
          transition={{ duration: good ? 1.6 : 0.6, repeat: Infinity, repeatDelay: good ? 0.4 : 2 }}
          className="shrink-0 text-4xl"
        >
          {status.champion ? <Trophy size={44} /> : <Flag teamId={status.team.id} logoUrl={status.team.logo_url} code={status.team.code} name={status.team.name} size={44} />}
        </motion.div>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-chalk-dim">Your team {status.emoji}</p>
          <p className={`font-display text-lg ${good ? "text-grass" : bad ? "text-red-600" : "text-chalk"}`}>
            {status.headline}
          </p>
          {kickoff && (
            <p className="mt-1 text-sm text-chalk-dim">
              Next: vs {status.next!.opponentName} · {kickoff}
            </p>
          )}
        </div>

        <button
          onClick={() => {
            if (good) {
              celebrate();
            } else if (bad) {
              playWomp();
            }
          }}
          className="shrink-0 rounded-full glass px-3 py-2 text-lg transition hover:scale-110"
          title="Replay reaction"
        >
          {good ? "🎉" : bad ? "📢" : "▶️"}
        </button>
      </div>
    </motion.div>
  );
}
