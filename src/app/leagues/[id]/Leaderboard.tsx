"use client";

import { useEffect, useMemo, useState } from "react";
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
  meId,
}: {
  leagueId: string;
  initialRows: LeaderboardRow[];
  meId?: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [rain, setRain] = useState<number | null>(null);
  const [tab, setTab] = useState<"total" | "upfront" | "live">("total");

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

  // Sort by the active metric (Total / Upfront / Live = the three crowns).
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b[tab] - a[tab]),
    [rows, tab],
  );

  // Win/lose drama only once the tournament has produced points.
  const started = sorted.length > 1 && sorted[0]?.[tab] > 0;
  const lastIndex = sorted.length - 1;

  const TABS = [
    { key: "total" as const, label: "👑 Total" },
    { key: "upfront" as const, label: "🎯 Upfront" },
    { key: "live" as const, label: "⚡ Live" },
  ];

  function troll() {
    const id = Date.now();
    setRain(id);
    playWomp();
    setTimeout(() => setRain((c) => (c === id ? null : c)), 3500);
  }

  return (
    <>
      {rain && <EmojiRain key={rain} />}

      <div className="mb-3 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              tab === t.key
                ? "bg-grass text-night"
                : "glass text-chalk-dim hover:text-chalk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="glass-strong overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[1.25rem_1fr_2rem_2rem_2.5rem] items-center gap-1.5 border-b border-white/10 px-3 py-2.5 text-xs uppercase tracking-wider text-chalk-dim sm:grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem] sm:gap-2 sm:px-4">
          <span>#</span>
          <span>Player</span>
          <span className={`text-right ${tab === "upfront" ? "text-grass-bright" : ""}`}>🎯</span>
          <span className={`text-right ${tab === "live" ? "text-grass-bright" : ""}`}>⚡</span>
          <span className={`text-right ${tab === "total" ? "text-grass-bright" : ""}`}>👑</span>
        </div>

        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-chalk-dim">No players yet.</p>
        ) : (
          <ul className="relative">
            <AnimatePresence>
              {sorted.map((r, i) => {
                const isWinner = started && i === 0;
                const isLoser = started && i === lastIndex;
                const isMe = !!meId && r.user_id === meId;
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
                    className={`grid grid-cols-[1.25rem_1fr_2rem_2rem_2.5rem] items-center gap-1.5 border-b border-white/5 px-3 py-3 text-sm sm:grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem] sm:gap-2 sm:px-4 ${
                      isWinner ? "animate-pulse-glow bg-gold/15" : isLoser ? "bg-red-500/5" : ""
                    } ${isMe ? "ring-1 ring-inset ring-grass/50" : ""}`}
                  >
                    <span className="text-lg">
                      {isWinner ? "👑" : MEDALS[i] ?? <span className="text-chalk-dim">{i + 1}</span>}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Avatar url={r.avatarUrl} name={r.name} size={22} />
                      {r.favTeamId && <Flag teamId={r.favTeamId} size={16} />}
                      <span className="min-w-0 flex-1 truncate font-semibold text-chalk">{r.name}</span>
                      {isMe && (
                        <span className="shrink-0 rounded bg-grass/20 px-1.5 py-0.5 text-[10px] font-bold text-grass-bright">
                          you
                        </span>
                      )}
                      {isWinner && <span className="shrink-0 text-sm">✨</span>}
                      {isLoser && (
                        <>
                          <span title="Last place" className="shrink-0 text-base">🥄</span>
                          <button
                            onClick={troll}
                            className="shrink-0 rounded-full border border-red-400/40 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/20"
                            title="Rain shame on the loser"
                            aria-label="Rain shame on the loser"
                          >
                            🍅<span className="hidden sm:inline"> troll</span>
                          </button>
                        </>
                      )}
                    </span>
                    <span className="text-right tabular-nums text-chalk/70">{r.upfront}</span>
                    <span className="text-right tabular-nums text-chalk/70">{r.live}</span>
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
