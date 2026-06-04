"use client";

import { motion } from "motion/react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { PlayerCardButton } from "@/components/PlayerCard";
import { rowLabels } from "@/lib/positions";

type LP = { player_id: number; name: string; number: number | null; pos: string | null; grid: string | null; ovr?: number | null };
export type TeamLineup = { formation: string | null; xi: LP[] };

const POS_ROW: Record<string, number> = { G: 1, D: 2, M: 3, F: 4 };

// Derive a "4-4-2"-style label from positions when the API didn't supply one.
function deriveFormation(xi: LP[]): string {
  const c = (k: string) => xi.filter((p) => (p.pos ?? "").toUpperCase().startsWith(k)).length;
  const d = c("D"),
    m = c("M"),
    f = c("F");
  return d && (m || f) ? `${d}-${m}-${f}` : "";
}

// Position one team across the full pitch. Prefer real grid "row:col" coords;
// fall back to position (G/D/M/F) rows when the lineup has no grid.
function positioned(xi: LP[]) {
  const useGrid = xi.some((p) => !!p.grid && p.grid.includes(":"));
  const parsed = xi.map((p, i) => {
    if (useGrid) {
      const [r, c] = (p.grid ?? "1:1").split(":").map((n) => parseInt(n, 10) || 1);
      return { p, r, c };
    }
    const r = POS_ROW[(p.pos ?? "M").charAt(0).toUpperCase()] ?? 3;
    return { p, r, c: i };
  });
  const maxRow = Math.max(1, ...parsed.map((x) => x.r));
  const byRow = new Map<number, typeof parsed>();
  for (const x of parsed) {
    if (!byRow.has(x.r)) byRow.set(x.r, []);
    byRow.get(x.r)!.push(x);
  }
  const out: { p: LP; x: number; y: number; label: string }[] = [];
  for (const [r, players] of byRow) {
    const sorted = [...players].sort((a, b) => a.c - b.c);
    const frac = maxRow > 1 ? (r - 1) / (maxRow - 1) : 0; // 0 = keeper, 1 = forwards
    const line = sorted.map((x) => x.p.pos).find(Boolean) ?? "M";
    const labels = rowLabels(line, sorted.length, frac);
    // Half-pitch: GK near the goal line (bottom), forwards near the halfway line (top).
    sorted.forEach((x, i) =>
      out.push({ p: x.p, x: ((i + 0.5) / sorted.length) * 100, y: 88 - frac * 74, label: labels[i] ?? "" }),
    );
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
        Most recent XI{(lineup.formation || deriveFormation(lineup.xi)) ? ` · ${lineup.formation || deriveFormation(lineup.xi)}` : ""}
      </p>
      {/* Half pitch (one team): their goal at the bottom, halfway-line arc at the top. */}
      <div className="relative mx-auto aspect-[5/6] w-full max-w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-grass/70 to-grass/55">
        <div className="absolute bottom-0 left-1/2 h-12 w-28 -translate-x-1/2 border-x border-t border-white/25" />
        <div className="absolute bottom-0 left-1/2 h-5 w-14 -translate-x-1/2 border-x border-t border-white/25" />
        <div className="absolute -top-9 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border border-white/25" />
        {pos.map(({ p, x, y, label }) => (
          <motion.div
            key={p.player_id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute w-14 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <PlayerCardButton
              playerId={p.player_id}
              name={p.name}
              detailPos={label}
              className="flex w-full flex-col items-center gap-0.5"
            >
              <span className="relative inline-block">
                <PlayerAvatar playerId={p.player_id} name={p.name} size={30} className="border-2 border-white/80 shadow" />
                {p.ovr != null && (
                  <span
                    title="EA FC 26 overall"
                    className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-white/70 bg-gold px-0.5 text-[8px] font-bold leading-none text-night shadow"
                  >
                    {p.ovr}
                  </span>
                )}
              </span>
              {label && (
                <span className="rounded bg-night/70 px-1 text-[8px] font-bold uppercase leading-tight text-gold">
                  {label}
                </span>
              )}
              <span className="max-w-[3.5rem] truncate rounded bg-night/45 px-1 text-[8px] leading-tight text-white">
                {p.name.split(" ").slice(-1)[0] ?? p.name}
              </span>
            </PlayerCardButton>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
