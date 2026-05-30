"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import Flag from "@/components/Flag";
import Avatar from "@/components/Avatar";
import EmojiRain from "@/components/EmojiRain";
import { playWomp } from "@/lib/sound";

export interface LeaderboardRow {
  user_id: string;
  name: string;
  avatarUrl: string | null;
  favTeamId: number | null;
  upfront: number;
  live: number;
  total: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard({
  leagueId,
  initialRows,
}: {
  leagueId: string;
  initialRows: LeaderboardRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [rain, setRain] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function refresh() {
      const { data } = await supabase
        .from("scores")
        .select("user_id, upfront_points, live_points, total_points, profiles ( display_name, team_name, avatar_url, favorite_team_id )")
        .eq("league_id", leagueId)
        .order("total_points", { ascending: false });
      if (data) {
        setRows(
          data.map((s) => {
            const p = s.profiles as unknown as {
              display_name: string;
              team_name: string | null;
              avatar_url: string | null;
              favorite_team_id: number | null;
            };
            return {
              user_id: s.user_id,
              name: p?.team_name || p?.display_name || "?",
              avatarUrl: p?.avatar_url ?? null,
              favTeamId: p?.favorite_team_id ?? null,
              upfront: s.upfront_points,
              live: s.live_points,
              total: s.total_points,
            };
          }),
        );
      }
    }

    const channel = supabase
      .channel(`scores-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `league_id=eq.${leagueId}` },
        refresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId]);

  // Win/lose drama only once the tournament has produced points.
  const started = rows.length > 1 && rows[0]?.total > 0;
  const lastIndex = rows.length - 1;

  function troll() {
    const id = Date.now();
    setRain(id);
    playWomp();
    setTimeout(() => setRain((c) => (c === id ? null : c)), 3500);
  }

  return (
    <>
      {rain && <EmojiRain key={rain} />}

      <div className="glass-strong overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem] items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs uppercase tracking-wider text-chalk-dim">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">🎯</span>
          <span className="text-right">⚡</span>
          <span className="text-right">👑</span>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-chalk-dim">No players yet.</p>
        ) : (
          <ul className="relative">
            <AnimatePresence>
              {rows.map((r, i) => {
                const isWinner = started && i === 0;
                const isLoser = started && i === lastIndex;
                return (
                  <motion.li
                    key={r.user_id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={
                      isLoser
                        ? { opacity: 1, x: [0, -3, 3, -3, 3, 0] }
                        : { opacity: 1 }
                    }
                    transition={
                      isLoser
                        ? { x: { duration: 0.6, repeat: Infinity, repeatDelay: 2.5 }, layout: { type: "spring", stiffness: 500, damping: 40 } }
                        : { type: "spring", stiffness: 500, damping: 40 }
                    }
                    className={`grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem] items-center gap-2 border-b border-white/5 px-4 py-3 text-sm ${
                      isWinner ? "animate-pulse-glow bg-gold/15" : isLoser ? "bg-red-500/5" : ""
                    }`}
                  >
                    <span className="text-lg">
                      {isWinner ? "👑" : MEDALS[i] ?? <span className="text-chalk-dim">{i + 1}</span>}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar url={r.avatarUrl} name={r.name} size={26} />
                      {r.favTeamId && <Flag teamId={r.favTeamId} size={16} />}
                      <span className="truncate font-semibold text-chalk">{r.name}</span>
                      {isWinner && <span className="text-sm">✨</span>}
                      {isLoser && (
                        <>
                          <span title="Last place" className="text-base">🥄</span>
                          <button
                            onClick={troll}
                            className="ml-1 rounded-full border border-red-400/40 px-2 py-0.5 text-[10px] text-red-300 transition hover:bg-red-500/20"
                            title="Rain shame on the loser"
                          >
                            🍅 troll
                          </button>
                        </>
                      )}
                    </span>
                    <span className="text-right tabular-nums text-chalk-dim">{r.upfront}</span>
                    <span className="text-right tabular-nums text-chalk-dim">{r.live}</span>
                    <motion.span
                      key={r.total}
                      initial={{ scale: 1.4, color: "#ffd970" }}
                      animate={{ scale: 1, color: "#eaf3ee" }}
                      transition={{ duration: 0.4 }}
                      className="text-right font-display text-base tabular-nums"
                    >
                      {r.total}
                    </motion.span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </>
  );
}
