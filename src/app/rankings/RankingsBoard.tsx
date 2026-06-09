"use client";

import { useMemo, useState, type ComponentType } from "react";
import { motion } from "motion/react";
import Avatar from "@/components/Avatar";
import Flag from "@/components/Flag";
import CountUp from "@/components/CountUp";
import { Upfront, Live, Trophy } from "@/components/icons";
import type { GlobalRank } from "@/lib/globalRankings";

type SlimTeam = { id: number; name: string; code: string | null; logo_url: string | null };
type Crown = "total" | "upfront" | "live";

// Top-3 rank-number tint: gold / silver / bronze.
const RANK_COLOR = ["text-gold", "text-slate-300", "text-amber-600"];

const TABS: { key: Crown; label: string; Icon: ComponentType<{ size?: number }>; blurb: string }[] = [
  { key: "total", label: "Total", Icon: Trophy, blurb: "Upfront + Live combined" },
  { key: "upfront", label: "Upfront", Icon: Upfront, blurb: "Bracket + awards" },
  { key: "live", label: "Live", Icon: Live, blurb: "In-running match picks" },
];

export default function RankingsBoard({
  ranks,
  teams,
  meId,
}: {
  ranks: GlobalRank[];
  teams: SlimTeam[];
  meId: string;
}) {
  const [by, setBy] = useState<Crown>("total");
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  // Re-rank by the chosen crown (stable: ties keep the cached/default order).
  const sorted = useMemo(() => [...ranks].sort((a, b) => b[by] - a[by]), [ranks, by]);
  const active = TABS.find((t) => t.key === by)!;

  const row = (r: GlobalRank, i: number) => {
    const isMe = r.user_id === meId;
    const team = r.favTeamId ? teamById.get(r.favTeamId) : null;
    return (
      <motion.li
        key={r.user_id}
        layout
        transition={{ type: "spring", stiffness: 500, damping: 40 }}
        className={`flex items-center gap-3 break-inside-avoid border-b border-night/5 px-3 py-3 last:border-b-0 sm:px-4 ${
          isMe ? "bg-gold/15 ring-1 ring-inset ring-gold/50" : ""
        }`}
      >
        <span className="w-7 shrink-0 text-center font-bold tabular-nums">
          <span className={RANK_COLOR[i] ?? "text-chalk-dim"}>{i + 1}</span>
        </span>
        <Avatar url={r.avatarUrl} name={r.name} size={40} />
        {r.favTeamId && (
          <Flag teamId={r.favTeamId} logoUrl={team?.logo_url} code={team?.code} name={team?.name} size={18} />
        )}
        <span className="min-w-0 flex-1 truncate font-semibold text-chalk">{r.name}</span>
        {isMe && (
          <span className="shrink-0 rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold">you</span>
        )}
        <CountUp value={r[by]} className="shrink-0 font-display text-lg text-gold" />
      </motion.li>
    );
  };

  return (
    <div className="glass-strong overflow-hidden rounded-3xl">
      {/* Crown switch — a header bar attached to the board it controls, so it reads as
          this list's controls rather than floating in the gap above it. */}
      <div className="border-b border-night/10 px-3 py-3 sm:px-4">
        <div className="inline-flex rounded-xl bg-night/5 p-0.5 text-sm font-semibold">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setBy(key)}
              aria-current={by === key}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition sm:px-3 ${
                by === key ? "bg-gold text-night glow-gold" : "text-chalk-dim hover:text-chalk"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-chalk-dim">{active.blurb}</p>
      </div>

      {/* One continuous list on mobile; two balanced columns on large screens
          (break-inside-avoid keeps each row whole across the column split). */}
      {sorted.length === 0 ? (
        <p className="p-8 text-center text-sm text-chalk-dim">
          No scores yet — check back once games kick off.
        </p>
      ) : (
        <ul className="lg:columns-2 lg:gap-x-8">{sorted.map((r, i) => row(r, i))}</ul>
      )}
    </div>
  );
}
