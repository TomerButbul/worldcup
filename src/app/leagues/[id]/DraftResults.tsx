"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Avatar from "@/components/Avatar";
import AutoRefresh from "@/components/AutoRefresh";
import Reveal from "@/components/Reveal";
import Trophy from "@/components/art/Trophy";
import TeamFormation, { type TeamLineup } from "./TeamFormation";
import { POT_LABELS, teamAt, type Pot } from "@/lib/draft";
import DraftFixtures, { type FixtureDay } from "./DraftFixtures";
import DraftGroupStage, { type GroupStageGroup } from "./DraftGroupStage";
import KnockoutBracket, { type BracketRound, type BracketTeam } from "@/components/KnockoutBracket";
import type { StandingRow } from "@/lib/draft-scoring";
import type { DraftMember, PickRow } from "./draftTypes";

const POTS: Pot[] = [1, 2, 3];

export default function DraftResults({
  tab,
  leagueId,
  picks,
  members,
  standings,
  teamLineups,
  fixtures,
  koRounds,
  bracketTeams,
  meTeamIds,
  groupStage,
  tournamentStarted,
}: {
  tab: string;
  leagueId: string;
  picks: PickRow[];
  members: DraftMember[];
  standings: { perPot: Record<number, StandingRow[]>; totals: StandingRow[] };
  teamLineups: Record<string, { formation: string | null; xi: unknown[] }>;
  fixtures: FixtureDay[];
  koRounds: BracketRound[];
  bracketTeams: Record<number, BracketTeam>;
  meTeamIds: number[];
  groupStage: GroupStageGroup[];
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

  // One section at a time, chosen by the active tab (a separate bottom nav
  // supplies the links). "board" pairs the standings scoreboard with the
  // managers' drafted squads — together the managers/standings view.
  return (
    <div className="space-y-6">
      {tab === "board" && (
      <>
      <Reveal>
      <section className="glass-strong rounded-3xl p-4 sm:p-5">
        {/* Re-fetches periodically so points tick up live during the tournament. */}
        <AutoRefresh enabled />
        <header className="mb-4">
          <h2 className="font-display text-2xl text-gradient-gold sm:text-3xl">Scoreboard</h2>
          <p className="mt-0.5 text-xs text-chalk-dim">
            {tournamentStarted
              ? "Three pot races — winner of each takes a crown."
              : "Live points start at kickoff · Jun 11."}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {POTS.map((pot) => {
            const rows = standings.perPot[pot] ?? [];
            return (
              <div key={pot} className="glass rounded-2xl p-3.5">
                <h3 className="mb-2.5 font-display text-xs uppercase tracking-wide text-chalk-dim">
                  {POT_LABELS[pot]}
                </h3>
                <ul className="space-y-2">
                  {rows.map((r, i) => {
                    const m = memberById.get(r.userId);
                    const isWinner = i === 0 && r.points > 0;
                    const isSpoon = i === rows.length - 1 && rows.length > 1 && r.points > 0;
                    return (
                      <li key={r.userId} className="flex items-center gap-2 text-sm">
                        <span className="w-4 shrink-0 text-center text-xs tabular-nums text-chalk-dim">{i + 1}</span>
                        <Avatar url={m?.avatarUrl} name={m?.name ?? "?"} size={20} />
                        <span className="min-w-0 flex-1 truncate text-chalk">{m?.name ?? "?"}</span>
                        {isWinner && <Trophy size={13} className="inline-block align-[-2px]" />}
                        {isSpoon && <span title="Wooden Spoon — worst team in the pot">🥄</span>}
                        <span className="font-display tabular-nums text-gold">{r.points}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="glass mt-3 rounded-2xl p-3.5">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h3 className="font-display text-xs uppercase tracking-wide text-chalk-dim">
              🍻 Bragging rights
            </h3>
            <span className="text-[11px] text-chalk-dim">All pots · just for fun</span>
          </div>
          <ul className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
            {standings.totals.map((r, i) => {
              const m = memberById.get(r.userId);
              return (
                <li key={r.userId} className="flex items-center gap-2 text-sm">
                  <span className="w-4 shrink-0 text-center text-xs tabular-nums text-chalk-dim">{i + 1}</span>
                  <Avatar url={m?.avatarUrl} name={m?.name ?? "?"} size={20} />
                  <span className="min-w-0 flex-1 truncate text-chalk">{m?.name ?? "?"}</span>
                  <span className="font-display tabular-nums text-gold">{r.points}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      </Reveal>

      {/* Squads — the managers' drafted teams; shares the "board" tab with the
          scoreboard. Tap a nation to peek its formation. */}
      <Reveal index={1}>
      <section className="glass rounded-3xl p-4 sm:p-5">
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-chalk">Squads</h2>
          <span className="text-xs text-chalk-dim">
            {roster.length} managers · 3 picks each
          </span>
        </header>

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
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-xs tabular-nums text-gold">
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
      </section>
      </Reveal>
      </>
      )}

      {/* Group stage: all 12 groups, with this manager's drafted nations starred. */}
      {tab === "groups" && <DraftGroupStage groups={groupStage} meTeamIds={meTeamIds} />}

      {/* Read-only tournament bracket with this manager's nations traced in gold. */}
      {tab === "bracket" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-4 sm:p-5"
        >
          <header className="mb-3">
            <h3 className="font-display text-lg text-chalk">Road to the final</h3>
            <p className="mt-0.5 text-xs text-chalk-dim">
              Your drafted nations light up gold along their path. TBD until the knockouts begin.
            </p>
          </header>
          <KnockoutBracket
            rounds={koRounds}
            teamsById={bracketTeams}
            highlightIds={meTeamIds}
            championNo={104}
            treeOnly
          />
        </motion.div>
      )}

      {/* Fixtures: every match grouped by day, with who drafted each nation. */}
      {tab === "fixtures" && <DraftFixtures leagueId={leagueId} days={fixtures} />}
    </div>
  );
}
