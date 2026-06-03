"use client";

import { motion } from "motion/react";

type LP = { player_id: number; name: string; number: number | null; pos: string | null; grid: string | null };
export type TeamLineup = { formation: string | null; xi: LP[] };

// Position one team across the full pitch from grid "row:col" (formation-agnostic).
function positioned(xi: LP[]) {
  const parsed = xi.map((p) => {
    const [r, c] = (p.grid ?? "1:1").split(":").map((n) => parseInt(n, 10) || 1);
    return { p, r, c };
  });
  const maxRow = Math.max(1, ...parsed.map((x) => x.r));
  const byRow = new Map<number, typeof parsed>();
  for (const x of parsed) {
    if (!byRow.has(x.r)) byRow.set(x.r, []);
    byRow.get(x.r)!.push(x);
  }
  const out: { p: LP; x: number; y: number }[] = [];
  for (const [r, players] of byRow) {
    const sorted = [...players].sort((a, b) => a.c - b.c);
    const frac = maxRow > 1 ? (r - 1) / (maxRow - 1) : 0; // 0 = keeper, 1 = forwards
    sorted.forEach((x, i) => out.push({ p: x.p, x: ((i + 0.5) / sorted.length) * 100, y: 92 - frac * 84 }));
  }
  return out;
}

export default function TeamFormation({ lineup, teamName }: { lineup: TeamLineup | null; teamName: string }) {
  if (!lineup || !lineup.xi?.length) {
    return (
      <p className="rounded-xl bg-night/5 p-3 text-center text-xs text-chalk-dim">
        No recent lineup for {teamName} yet — it&apos;ll fill in from their next match.
      </p>
    );
  }
  const pos = positioned(lineup.xi);
  return (
    <div className="space-y-2">
      <p className="text-center text-[11px] uppercase tracking-wider text-chalk-dim">
        Most recent XI{lineup.formation ? ` · ${lineup.formation}` : ""}
      </p>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-grass/70 to-grass/55">
        <div className="absolute left-1/2 top-0 h-10 w-24 -translate-x-1/2 border-x border-b border-white/25" />
        <div className="absolute bottom-0 left-1/2 h-10 w-24 -translate-x-1/2 border-x border-t border-white/25" />
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
        {pos.map(({ p, x, y }) => (
          <motion.div
            key={p.player_id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute flex w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold tabular-nums text-night shadow">
              {p.number ?? "•"}
            </span>
            <span className="max-w-[3rem] truncate text-[8px] leading-tight text-chalk">
              {p.name.split(" ").slice(-1)[0] ?? p.name}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
