"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { Player } from "@/lib/types";
import { savePrediction } from "./actions";
import { useAutosave } from "@/lib/useAutosave";
import SaveStatus from "@/components/SaveStatus";
import Flag from "@/components/Flag";
import PlayerAvatar from "@/components/PlayerAvatar";
import { PlayerCardButton } from "@/components/PlayerCard";
import MatchCountdown from "@/components/MatchCountdown";
import { nowMs } from "@/lib/clock";
import { stageLabel } from "@/lib/stages";

export interface MatchCardData {
  id: number;
  stage: string;
  kickoff_at: string;
  status: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeGoalsActual: number | null;
  awayGoalsActual: number | null;
}

export interface Lineup {
  starters: number[]; // player ids in the starting XI
  subs: number[]; // player ids on the bench
}

interface Props {
  leagueId: string;
  match: MatchCardData;
  homePlayers: Player[];
  awayPlayers: Player[];
  initial: { home_goals: number | null; away_goals: number | null; scorer_goals: Record<string, number>; pen_winner_team_id: number | null } | null;
  // The user's upfront bracket scoreline for this match (group stage only).
  bracketScore: { h: number; a: number } | null;
  // Official lineups once posted (~40 min pre-kickoff); null → full squad.
  homeLineup?: Lineup | null;
  awayLineup?: Lineup | null;
}

export default function MatchCard({
  leagueId,
  match,
  homePlayers,
  awayPlayers,
  initial,
  bracketScore,
  homeLineup,
  awayLineup,
}: Props) {
  // Group scorelines live in the bracket; the live game scores scorers there.
  // Knockouts capture a full scoreline here.
  const isGroup = match.stage === "group";

  const [locked, setLocked] = useState(() => new Date(match.kickoff_at).getTime() <= nowMs());
  const [home, setHome] = useState(initial?.home_goals ?? 0);
  const [away, setAway] = useState(initial?.away_goals ?? 0);
  // player_id (string) -> predicted goals for that player.
  const [scorerGoals, setScorerGoals] = useState<Record<string, number>>(() => ({ ...(initial?.scorer_goals ?? {}) }));
  const [penWinner, setPenWinner] = useState<number | null>(initial?.pen_winner_team_id ?? null);

  const kickoff = new Date(match.kickoff_at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const live = match.status === "live";
  const allPlayers = [...homePlayers, ...awayPlayers];
  const playerName = (id: number) => allPlayers.find((p) => p.id === id)?.name ?? `#${id}`;

  // Per-team goal caps: group → your bracket scoreline; knockout → the steppers.
  const homeCap = isGroup ? (bracketScore?.h ?? 0) : home;
  const awayCap = isGroup ? (bracketScore?.a ?? 0) : away;
  const sumFor = (players: Player[]) => players.reduce((s, p) => s + (scorerGoals[String(p.id)] ?? 0), 0);

  function adjust(playerId: number, delta: number, players: Player[], cap: number) {
    setScorerGoals((prev) => {
      const cur = prev[String(playerId)] ?? 0;
      const next = cur + delta;
      if (next < 0) return prev;
      if (delta > 0 && players.reduce((s, p) => s + (prev[String(p.id)] ?? 0), 0) >= cap) return prev;
      const out = { ...prev };
      if (next === 0) delete out[String(playerId)];
      else out[String(playerId)] = next;
      return out;
    });
  }

  function step(setter: (fn: (n: number) => number) => void, delta: number) {
    setter((n) => Math.max(0, n + delta));
  }

  const saveFn = useCallback(
    () =>
      savePrediction(
        leagueId,
        match.id,
        isGroup ? null : home,
        isGroup ? null : away,
        scorerGoals,
        !isGroup && home === away ? penWinner : null,
      ),
    [leagueId, match.id, isGroup, home, away, scorerGoals, penWinner],
  );
  // Auto-save the prediction ~0.8s after the last tap — no Save button.
  const signature = `${isGroup ? "g" : `${home}-${away}-${penWinner ?? ""}`}|${JSON.stringify(scorerGoals)}`;
  const { state: saveState, error: saveErr } = useAutosave(signature, saveFn, { enabled: !locked });

  const pickScore = isGroup
    ? bracketScore
      ? `${bracketScore.h}–${bracketScore.a}`
      : null
    : initial && initial.home_goals != null
      ? `${initial.home_goals}–${initial.away_goals}`
      : null;

  const lockedScorers = Object.entries(initial?.scorer_goals ?? {})
    .map(([pid, n]) => `${playerName(Number(pid))}${n > 1 ? ` ×${n}` : ""}`)
    .join(", ");

  const penName =
    initial?.pen_winner_team_id == null
      ? null
      : initial.pen_winner_team_id === match.homeTeamId
        ? match.homeName
        : initial.pen_winner_team_id === match.awayTeamId
          ? match.awayName
          : null;

  return (
    <motion.div layout className="glass rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-chalk-dim">
        <span className="font-display text-gold">{stageLabel(match.stage)}</span>
        <span className="flex shrink-0 items-center gap-2">
          {live && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-red-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
            </span>
          )}
          {!locked && <MatchCountdown kickoff={match.kickoff_at} onExpire={() => setLocked(true)} />}
          <span className="whitespace-nowrap">{kickoff}</span>
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 text-center sm:gap-4">
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
          <span className="truncate">{match.homeName}</span>
          <Flag teamId={match.homeTeamId} name={match.homeName} size={26} className="shrink-0" />
        </span>

        {locked ? (
          <span className="net rounded-xl bg-night/5 px-4 py-2 font-display text-xl text-chalk">
            {match.status === "finished" || live
              ? `${match.homeGoalsActual ?? 0} – ${match.awayGoalsActual ?? 0}`
              : "vs"}
          </span>
        ) : isGroup ? (
          <span className="flex flex-col items-center">
            <span className="net rounded-xl bg-gold/10 px-4 py-2 font-display text-xl text-gold">
              {bracketScore ? `${bracketScore.h}–${bracketScore.a}` : "—"}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wider text-chalk-dim">from bracket</span>
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <Stepper value={home} onDec={() => step(setHome, -1)} onInc={() => step(setHome, 1)} />
            <span className="text-chalk-dim">–</span>
            <Stepper value={away} onDec={() => step(setAway, -1)} onInc={() => step(setAway, 1)} />
          </div>
        )}

        <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
          <Flag teamId={match.awayTeamId} name={match.awayName} size={26} className="shrink-0" />
          <span className="truncate">{match.awayName}</span>
        </span>
      </div>

      {locked ? (
        <div className="mt-3 flex flex-col items-center gap-1.5 text-center text-xs text-chalk-dim">
          <span>
            {pickScore || lockedScorers || penName ? (
              <>
                Your pick:{" "}
                {pickScore && <span className="text-chalk">{pickScore}</span>}
                {penName && <> {pickScore ? "· " : ""}🥅 {penName}</>}
                {lockedScorers && <> {pickScore || penName ? "· " : ""}⚽ {lockedScorers}</>}
              </>
            ) : (
              <span>🔒 Locked — no prediction made</span>
            )}
          </span>
          <Link
            href={`/leagues/${leagueId}/matches/${match.id}`}
            className="font-semibold text-gold transition hover:text-gold-bright"
          >
            Match summary →
          </Link>
        </div>
      ) : (
        <>
          {!isGroup && home === away && (
            <div className="mt-3 rounded-xl bg-gold/10 p-2.5 text-center">
              <p className="mb-1.5 text-xs font-semibold text-chalk">🥅 Tied — who wins on penalties?</p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPenWinner(match.homeTeamId)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                    penWinner != null && penWinner === match.homeTeamId
                      ? "border-grass bg-grass text-night"
                      : "border-night/10 text-chalk hover:bg-night/5"
                  }`}
                >
                  {match.homeName}
                </button>
                <button
                  type="button"
                  onClick={() => setPenWinner(match.awayTeamId)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                    penWinner != null && penWinner === match.awayTeamId
                      ? "border-grass bg-grass text-night"
                      : "border-night/10 text-chalk hover:bg-night/5"
                  }`}
                >
                  {match.awayName}
                </button>
              </div>
            </div>
          )}
          {isGroup && !bracketScore && (
            <p className="mt-3 rounded-xl bg-gold/10 px-3 py-2 text-center text-xs text-chalk-dim">
              Set your <Link href={`/leagues/${leagueId}/bracket`} className="font-semibold text-gold">bracket score</Link> for this match to pick its scorers.
            </p>
          )}
          {allPlayers.length === 0 ? (
            <p className="mt-4 text-xs text-chalk-dim">⚽ Goal-scorer list loads once squads are synced.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <TeamScorers
                label={match.homeName}
                players={homePlayers}
                cap={homeCap}
                sum={sumFor(homePlayers)}
                scorerGoals={scorerGoals}
                lineup={homeLineup}
                onAdjust={(pid, d) => adjust(pid, d, homePlayers, homeCap)}
              />
              <TeamScorers
                label={match.awayName}
                players={awayPlayers}
                cap={awayCap}
                sum={sumFor(awayPlayers)}
                scorerGoals={scorerGoals}
                lineup={awayLineup}
                onAdjust={(pid, d) => adjust(pid, d, awayPlayers, awayCap)}
              />
            </div>
          )}
          <div className="mt-4 flex items-center justify-end">
            <SaveStatus state={saveState} error={saveErr} />
          </div>
        </>
      )}
    </motion.div>
  );
}

function TeamScorers({
  label,
  players,
  cap,
  sum,
  scorerGoals,
  lineup,
  onAdjust,
}: {
  label: string;
  players: Player[];
  cap: number;
  sum: number;
  scorerGoals: Record<string, number>;
  lineup?: Lineup | null;
  onAdjust: (playerId: number, delta: number) => void;
}) {
  const atCap = sum >= cap;
  const starters = new Set(lineup?.starters ?? []);
  const subs = new Set(lineup?.subs ?? []);
  const hasLineup = starters.size > 0 || subs.size > 0;
  // With an official lineup, show only the matchday squad (XI + subs, plus any
  // already-picked player), starters first. Otherwise show the full squad.
  const rank = (id: number) => (starters.has(id) ? 0 : subs.has(id) ? 1 : 2);
  const inMain = (id: number) => starters.has(id) || subs.has(id) || (scorerGoals[String(id)] ?? 0) > 0;
  // With a lineup (official XI or the team's last XI), show that XI up front and
  // tuck the rest of the squad into a collapsed "Full squad" section.
  const list = hasLineup ? players.filter((p) => inMain(p.id)).sort((a, b) => rank(a.id) - rank(b.id)) : players;
  const bench = hasLineup ? players.filter((p) => !inMain(p.id)) : [];
  const badgeFor = (id: number) => (!hasLineup ? null : starters.has(id) ? "XI" : subs.has(id) ? "sub" : null);

  const renderChip = (p: Player) => {
    const count = scorerGoals[String(p.id)] ?? 0;
    const b = badgeFor(p.id);
    const badgeEl = b ? (
      <span className={`ml-0.5 rounded px-1 text-[9px] font-bold uppercase ${b === "XI" ? "bg-grass/20 text-grass" : "bg-night/10 text-chalk-dim"}`}>
        {b}
      </span>
    ) : null;
    if (count === 0) {
      return (
        <span
          key={p.id}
          className="flex items-center rounded-full border border-night/10 text-xs text-chalk transition hover:bg-night/5"
        >
          <PlayerCardButton playerId={p.id} name={p.name} className="shrink-0 rounded-full py-1 pl-0.5">
            <PlayerAvatar playerId={p.id} name={p.name} size={20} />
          </PlayerCardButton>
          <button
            onClick={() => onAdjust(p.id, 1)}
            disabled={atCap}
            className="flex items-center gap-1 py-1 pl-1.5 pr-2.5 disabled:opacity-40"
          >
            {p.name}
            {badgeEl}
          </button>
        </span>
      );
    }
    return (
      <span key={p.id} className="flex items-center gap-1 rounded-full border border-grass bg-grass/15 py-0.5 pl-0.5 pr-1 text-xs text-chalk">
        <PlayerCardButton playerId={p.id} name={p.name} className="shrink-0 rounded-full">
          <PlayerAvatar playerId={p.id} name={p.name} size={20} />
        </PlayerCardButton>
        <span className="font-semibold">{p.name}</span>
        {badgeEl}
        <span className="font-display text-grass">×{count}</span>
        <button
          onClick={() => onAdjust(p.id, -1)}
          aria-label={`One fewer for ${p.name}`}
          className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-night/10 text-sm leading-none text-chalk hover:bg-night/20"
        >
          −
        </button>
        <button
          onClick={() => onAdjust(p.id, 1)}
          disabled={atCap}
          aria-label={`One more for ${p.name}`}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-grass text-sm leading-none text-night hover:brightness-110 disabled:opacity-40"
        >
          +
        </button>
      </span>
    );
  };

  return (
    <div>
      <p className="mb-1.5 flex items-center justify-between text-xs font-medium text-chalk-dim">
        <span className="flex min-w-0 items-center gap-1 truncate">
          ⚽ {label}
          {hasLineup && (
            <span className="rounded bg-grass/15 px-1 text-[9px] font-bold uppercase text-grass">lineup</span>
          )}
        </span>
        <span className={sum > cap ? "text-red-600" : ""}>
          {sum}/{cap} goals
        </span>
      </p>
      {cap === 0 ? (
        <p className="text-[11px] text-chalk-dim">Predict a goal for {label} to assign scorers.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">{list.map(renderChip)}</div>
          {bench.length > 0 && (
            <details>
              <summary className="cursor-pointer list-none text-[11px] font-semibold text-chalk-dim transition hover:text-chalk">
                ⬇ Full squad ({bench.length} more)
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{bench.map(renderChip)}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <button onClick={onInc} className="px-3 py-1 text-base leading-none text-chalk-dim hover:text-chalk" aria-label="Increase">
        ▲
      </button>
      <span className="net w-9 rounded-lg bg-night/5 py-1 text-center font-display text-lg text-chalk">
        {value}
      </span>
      <button onClick={onDec} className="px-3 py-1 text-base leading-none text-chalk-dim hover:text-chalk" aria-label="Decrease">
        ▼
      </button>
    </div>
  );
}
