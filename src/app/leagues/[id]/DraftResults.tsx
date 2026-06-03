"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Avatar from "@/components/Avatar";
import AutoRefresh from "@/components/AutoRefresh";
import TeamFormation, { type TeamLineup } from "./TeamFormation";
import { DRAFT_POTS, POT_LABELS, teamAt, type Pot } from "@/lib/draft";
import type { StandingRow } from "@/lib/draft-scoring";
import type { DraftMember, PickRow } from "./draftTypes";

const POTS: Pot[] = [1, 2, 3];

export default function DraftResults({
  picks,
  members,
  standings,
  teamLineups,
  tournamentStarted,
}: {
  picks: PickRow[];
  members: DraftMember[];
  standings: { perPot: Record<number, StandingRow[]>; totals: StandingRow[] };
  teamLineups: Record<string, { formation: string | null; xi: unknown[] }>;
  tournamentStarted: boolean;
}) {
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const [open, setOpen] = useState<string | null>(null);
  // Pivot the flat pick list into per-manager, per-pot squads.
  const byUser = new Map<string, Map<number, PickRow>>();
  for (const p of picks) {
    let pots = byUser.get(p.user_id);
    if (!pots) byUser.set(p.user_id, (pots = new Map()));
    pots.set(p.pot, p);
  }

  // Seated managers, in draft-order so the board they just watched lines up.
  const roster = [...members]
    .filter((m) => m.seat != null)
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="glass-strong rounded-3xl p-6 text-center sm:p-8"
      >
        <p className="text-5xl sm:text-6xl">🏆</p>
        <h2 className="mt-2 font-display text-3xl text-gradient-gold sm:text-4xl">Draft complete!</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-chalk-dim">
          Every squad is locked in. Whoever&apos;s team goes furthest in each pot takes the crown —
          winners &amp; losers are decided once the tournament plays out.
        </p>
        {!tournamentStarted && (
          <p className="mt-3 inline-block rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
            📊 Pot standings unlock at kickoff
          </p>
        )}
      </motion.div>

      {tournamentStarted && (
        <div className="space-y-4">
          {/* Standings fill in live as drafted teams advance. */}
          <AutoRefresh enabled />
          {POTS.map((pot) => {
            const rows = standings.perPot[pot] ?? [];
            return (
              <div key={pot} className="glass rounded-2xl p-4">
                <h3 className="mb-2 font-display text-chalk">{POT_LABELS[pot]} — standings</h3>
                <ul className="space-y-1.5">
                  {rows.map((r, i) => {
                    const m = memberById.get(r.userId);
                    const isWinner = i === 0 && r.points > 0;
                    const isSpoon = i === rows.length - 1 && rows.length > 1;
                    return (
                      <li key={r.userId} className="flex items-center gap-2 text-sm">
                        <span className="w-5 shrink-0 text-center text-chalk-dim">{i + 1}</span>
                        <Avatar url={m?.avatarUrl} name={m?.name ?? "?"} size={22} />
                        <span className="min-w-0 flex-1 truncate text-chalk">{m?.name ?? "?"}</span>
                        {isWinner && <span title="Pot winner">🏆</span>}
                        {isSpoon && <span title="Wooden Spoon — worst team in the pot">🥄</span>}
                        <span className="font-display text-gold">{r.points}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <div className="glass rounded-2xl p-4">
            <h3 className="font-display text-chalk">🍻 Bragging-rights total</h3>
            <p className="mb-2 text-[11px] text-chalk-dim">
              All three pots combined — just for fun; doesn&apos;t affect the pot competitions.
            </p>
            <ul className="space-y-1.5">
              {standings.totals.map((r, i) => {
                const m = memberById.get(r.userId);
                return (
                  <li key={r.userId} className="flex items-center gap-2 text-sm">
                    <span className="w-5 shrink-0 text-center text-chalk-dim">{i + 1}</span>
                    <Avatar url={m?.avatarUrl} name={m?.name ?? "?"} size={22} />
                    <span className="min-w-0 flex-1 truncate text-chalk">{m?.name ?? "?"}</span>
                    <span className="font-display text-gold">{r.points}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {roster.map((m, i) => {
          const squad = byUser.get(m.userId);
          return (
            <motion.div
              key={m.userId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.5) }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-night/10 font-display text-xs text-chalk">
                  {m.seat}
                </span>
                <Avatar url={m.avatarUrl} name={m.name} size={28} />
                <span className="min-w-0 truncate font-display text-lg text-chalk">{m.name}</span>
              </div>

              <ul className="mt-3 space-y-1.5">
                {POTS.map((pot) => {
                  const pick = squad?.get(pot);
                  const team = pick ? teamAt(pot, pick.slot) : undefined;
                  const key = `${m.userId}-${pot}`;
                  const isOpen = open === key;
                  const lineup = team ? (teamLineups[team.name] ?? null) : null;
                  return (
                    <li key={pot}>
                      <button
                        type="button"
                        onClick={() => team && setOpen(isOpen ? null : key)}
                        disabled={!team}
                        className="flex w-full items-center gap-2.5 rounded-xl bg-night/5 px-3 py-2 text-left transition hover:bg-night/10 disabled:cursor-default"
                      >
                        <span className="text-xl">{team?.flag ?? "—"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-chalk">
                            {team?.name ?? "No pick"}
                          </span>
                          <span className="block truncate text-[11px] uppercase tracking-wider text-chalk-dim">
                            {POT_LABELS[pot]}
                          </span>
                        </span>
                        {team && (
                          <span className={`shrink-0 text-xs text-chalk-dim transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
                        )}
                      </button>
                      {isOpen && team && (
                        <div className="mt-1.5 rounded-xl bg-night/5 p-2">
                          <TeamFormation lineup={lineup as TeamLineup | null} teamName={team.name} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-chalk-dim">
        {roster.length} managers · {DRAFT_POTS[1].length * POTS.length} teams drafted across 3 pots
      </p>
    </div>
  );
}
