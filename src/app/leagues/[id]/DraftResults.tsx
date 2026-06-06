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

type DraftTab = "standings" | "squads" | "groups" | "bracket" | "fixtures";
const TABS: { key: DraftTab; label: string }[] = [
  { key: "standings", label: "Standings" },
  { key: "squads", label: "Squads" },
  { key: "groups", label: "Groups" },
  { key: "bracket", label: "Bracket" },
  { key: "fixtures", label: "Fixtures" },
];

// Standings shows ONE board at a time (toggle), instead of three stacked pots.
const POT_BOARDS: { key: string; label: string }[] = [
  { key: "1", label: "Top tier" },
  { key: "2", label: "Mid tier" },
  { key: "3", label: "Long shots" },
  { key: "total", label: "Total" },
];

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
  // The board used to stack the scoreboard AND all 16 squads in one giant scroll;
  // it's now two tabs (Standings / Squads). Deep-links (?tab=groups…) seed the
  // initial tab, otherwise we open on the short Standings view.
  const [active, setActive] = useState<DraftTab>(() =>
    tab === "groups" || tab === "bracket" || tab === "fixtures" ? (tab as DraftTab) : "standings",
  );
  // Which scoreboard the Standings tab is showing (a pot race or the combined total).
  const [potBoard, setPotBoard] = useState<string>("1");
  const boardRows = potBoard === "total" ? standings.totals : standings.perPot[Number(potBoard)] ?? [];
  const isTotal = potBoard === "total";

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
    <div className="space-y-4">
      {/* Re-fetches periodically so points tick up live during the tournament. */}
      <AutoRefresh enabled />

      {/* Sticky section tabs — sits below the top chrome so it's always reachable
          without scrolling back up through a long list. */}
      <nav className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-20 -mx-1 flex gap-1 overflow-x-auto rounded-2xl glass-strong p-1.5 lg:top-[calc(env(safe-area-inset-top)+4.75rem)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            aria-current={active === t.key ? "page" : undefined}
            className={`shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
              active === t.key ? "bg-gold text-night glow-gold" : "text-chalk-dim hover:bg-night/5 hover:text-chalk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Standings: one board at a time (a pot race or the combined total) ─ */}
      {active === "standings" && (
        <Reveal>
          <section className="glass-strong rounded-3xl p-4 sm:p-5">
            <header className="mb-3">
              <h2 className="font-display text-2xl text-gradient-gold sm:text-3xl">Scoreboard</h2>
              <p className="mt-0.5 text-xs text-chalk-dim">
                {tournamentStarted
                  ? "Three pot races + a combined total — tap to switch."
                  : "Live points start at kickoff · Jun 11."}
              </p>
            </header>

            {/* Board toggle — one leaderboard; pick which pot (or the total) it shows. */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {POT_BOARDS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setPotBoard(b.key)}
                  aria-current={potBoard === b.key ? "true" : undefined}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    potBoard === b.key ? "bg-gold text-night glow-gold" : "glass text-chalk-dim hover:text-chalk"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <p className="mb-2.5 px-1 text-[11px] text-chalk-dim">
              {isTotal
                ? "🍻 All three pots combined — bragging rights, just for fun."
                : `${POT_LABELS[Number(potBoard) as Pot]} · winner takes a crown 🏆`}
            </p>

            <ul className="glass rounded-2xl p-1.5">
              {boardRows.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-chalk-dim">No points yet.</li>
              ) : (
                boardRows.map((r, i) => {
                  const m = memberById.get(r.userId);
                  const isWinner = !isTotal && i === 0 && r.points > 0;
                  const isSpoon = !isTotal && i === boardRows.length - 1 && boardRows.length > 1 && r.points > 0;
                  return (
                    <li
                      key={r.userId}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm ${isWinner ? "bg-gold/10" : ""}`}
                    >
                      <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-chalk-dim">{i + 1}</span>
                      <Avatar url={m?.avatarUrl} name={m?.name ?? "?"} size={26} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-chalk">{m?.name ?? "?"}</span>
                      {isWinner && <Trophy size={15} />}
                      {isSpoon && <span title="Wooden Spoon — last in this pot">🥄</span>}
                      <span className="font-display text-base tabular-nums text-gold">{r.points}</span>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        </Reveal>
      )}

      {/* ── Squads: each manager's drafted nations (tap a flag for its XI) ──── */}
      {active === "squads" && (
        <section className="glass rounded-3xl p-4 sm:p-5">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl text-chalk">Squads</h2>
            <span className="text-xs text-chalk-dim">{roster.length} managers · 3 picks each</span>
          </header>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {roster.map((m, i) => {
              const squad = byUser.get(m.userId);
              return (
                <motion.div
                  key={m.userId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
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
      )}

      {/* Group stage: all 12 groups, with this manager's drafted nations starred. */}
      {active === "groups" && <DraftGroupStage groups={groupStage} meTeamIds={meTeamIds} />}

      {/* Read-only tournament bracket with this manager's nations traced in gold. */}
      {active === "bracket" && (
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
          <KnockoutBracket rounds={koRounds} teamsById={bracketTeams} highlightIds={meTeamIds} championNo={104} treeOnly />
        </motion.div>
      )}

      {/* Fixtures: every match grouped by day, with who drafted each nation. */}
      {active === "fixtures" && <DraftFixtures leagueId={leagueId} days={fixtures} />}
    </div>
  );
}
