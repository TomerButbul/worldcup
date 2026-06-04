"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { Player } from "@/lib/types";
import { savePrediction } from "./actions";
import { useAutosave } from "@/lib/useAutosave";
import SaveStatus from "@/components/SaveStatus";
import Flag from "@/components/Flag";
import { TeamCardButton } from "@/components/TeamCard";
import PlayerAvatar from "@/components/PlayerAvatar";
import { PlayerCardButton } from "@/components/PlayerCard";
import Ball from "@/components/art/Ball";
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
  homeLineup,
  awayLineup,
}: Props) {
  // Every match — group and knockout — captures a full scoreline here now (the
  // upfront bracket is table-order only). Locks at kickoff.
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

  // The scorer cap is the current scoreline (editable until kickoff).
  const homeCap = home;
  const awayCap = away;
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
      savePrediction(leagueId, match.id, home, away, scorerGoals, !isGroup && home === away ? penWinner : null),
    [leagueId, match.id, isGroup, home, away, scorerGoals, penWinner],
  );
  // Auto-save ~0.8s after the last tap — no Save button.
  const signature = `${home}-${away}-${penWinner ?? ""}|${JSON.stringify(scorerGoals)}`;
  const { state: saveState, error: saveErr } = useAutosave(signature, saveFn, { enabled: !locked });

  const pickScore =
    initial && initial.home_goals != null ? `${initial.home_goals}–${initial.away_goals}` : null;

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
        {match.homeTeamId != null ? (
          <TeamCardButton
            teamId={match.homeTeamId}
            name={match.homeName}
            className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk transition hover:opacity-80 sm:gap-2 sm:text-base"
          >
            <span className="truncate">{match.homeName}</span>
            <Flag teamId={match.homeTeamId} name={match.homeName} size={26} className="shrink-0" />
          </TeamCardButton>
        ) : (
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
            <span className="truncate">{match.homeName}</span>
            <Flag teamId={match.homeTeamId} name={match.homeName} size={26} className="shrink-0" />
          </span>
        )}

        {locked ? (
          <span className="net rounded-xl bg-night/5 px-4 py-2 font-display text-xl text-chalk">
            {match.status === "finished" || live
              ? `${match.homeGoalsActual ?? 0} – ${match.awayGoalsActual ?? 0}`
              : "vs"}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Stepper value={home} onDec={() => step(setHome, -1)} onInc={() => step(setHome, 1)} />
            <span className="text-chalk-dim">–</span>
            <Stepper value={away} onDec={() => step(setAway, -1)} onInc={() => step(setAway, 1)} />
          </span>
        )}

        {match.awayTeamId != null ? (
          <TeamCardButton
            teamId={match.awayTeamId}
            name={match.awayName}
            className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk transition hover:opacity-80 sm:gap-2 sm:text-base"
          >
            <Flag teamId={match.awayTeamId} name={match.awayName} size={26} className="shrink-0" />
            <span className="truncate">{match.awayName}</span>
          </TeamCardButton>
        ) : (
          <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base">
            <Flag teamId={match.awayTeamId} name={match.awayName} size={26} className="shrink-0" />
            <span className="truncate">{match.awayName}</span>
          </span>
        )}
      </div>

      {locked ? (
        <div className="mt-3 flex flex-col items-center gap-1.5 text-center text-xs text-chalk-dim">
          <span>
            {pickScore || lockedScorers || penName ? (
              <>
                Your pick:{" "}
                {pickScore && <span className="text-chalk">{pickScore}</span>}
                {penName && <> {pickScore ? "· " : ""}🥅 {penName}</>}
                {lockedScorers && <> {pickScore || penName ? "· " : ""}<Ball size={13} className="mr-1 inline-block align-[-2px]" />{lockedScorers}</>}
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
          {allPlayers.length === 0 ? (
            <p className="mt-4 text-xs text-chalk-dim"><Ball size={14} className="mr-1 inline-block align-[-2px]" />Goal-scorer list loads once squads are synced.</p>
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

const POS_SHORT: Record<string, string> = { Goalkeeper: "GK", Defender: "DF", Midfielder: "MF", Attacker: "FW" };
function posShort(pos: string | null | undefined): string {
  if (!pos) return "";
  return POS_SHORT[pos] ?? pos.slice(0, 3).toUpperCase();
}
const POS_ORDER: Record<string, number> = { Attacker: 0, Midfielder: 1, Defender: 2, Goalkeeper: 3 };
function posOrder(pos: string | null | undefined): number {
  return pos ? (POS_ORDER[pos] ?? 4) : 5;
}

// Accent-insensitive fold so "Jimenez" finds "Jiménez", "Muller" → "Müller".
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

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
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const atCap = sum >= cap;
  const starters = new Set(lineup?.starters ?? []);
  const subs = new Set(lineup?.subs ?? []);
  const hasLineup = starters.size > 0 || subs.size > 0;
  const picked = (id: number) => (scorerGoals[String(id)] ?? 0) > 0;
  const rank = (id: number) => (starters.has(id) ? 0 : subs.has(id) ? 1 : 2);
  const byPos = (a: Player, b: Player) =>
    posOrder(a.position) - posOrder(b.position) || a.name.localeCompare(b.name);
  const byRankPos = (a: Player, b: Player) => rank(a.id) - rank(b.id) || byPos(a, b);

  // Your chosen scorers are always pinned at the top. Candidates to add are:
  // searching → all name matches; otherwise the likely scorers (the XI, forwards
  // first), with "Show full squad" to reveal the rest — so you're never scrolling
  // 40+ names to find someone.
  const selected = players.filter((p) => picked(p.id)).sort(byPos);
  const q = fold(query.trim());
  const unpicked = players.filter((p) => !picked(p.id));
  let candidates: Player[];
  if (q.length >= 1) {
    candidates = unpicked.filter((p) => fold(p.name).includes(q)).sort(byRankPos).slice(0, 30);
  } else if (hasLineup && !showAll) {
    candidates = unpicked.filter((p) => starters.has(p.id) || subs.has(p.id)).sort(byRankPos);
  } else if (!showAll) {
    candidates = [...unpicked].sort(byRankPos).slice(0, 16);
  } else {
    candidates = [...unpicked].sort(byRankPos);
  }
  const moreAvailable = q.length === 0 && !showAll && candidates.length < unpicked.length;

  // One full-width row: tap the name/avatar → player card (stats, OVR); the
  // right side is a direct +Goal (or −count+ once picked) so adding is one tap,
  // no modal.
  const row = (p: Player) => {
    const count = scorerGoals[String(p.id)] ?? 0;
    const pos = posShort(p.position);
    const sel = count > 0;
    return (
      <div
        key={p.id}
        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${sel ? "border-grass bg-grass/10" : "border-night/10"}`}
      >
        <PlayerCardButton
          playerId={p.id}
          name={p.name}
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition hover:opacity-80"
        >
          <PlayerAvatar playerId={p.id} name={p.name} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-chalk">{p.name}</span>
            <span className="block text-[10px] text-chalk-dim">
              {pos || "—"}
              {p.ovr != null && <> · <span className="font-semibold text-gold">{p.ovr} OVR</span></>}
            </span>
          </span>
        </PlayerCardButton>
        {sel ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => onAdjust(p.id, -1)}
              aria-label={`One fewer for ${p.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-night/10 text-base leading-none text-chalk hover:bg-night/20"
            >
              −
            </button>
            <span className="w-4 text-center font-display text-grass">{count}</span>
            <button
              onClick={() => onAdjust(p.id, 1)}
              disabled={atCap}
              aria-label={`One more for ${p.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-grass text-base leading-none text-night hover:brightness-110 disabled:opacity-40"
            >
              +
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onAdjust(p.id, 1)}
            disabled={atCap}
            aria-label={`Add ${p.name} as a scorer`}
            className="flex h-7 shrink-0 items-center rounded-full bg-night/10 px-3 text-xs font-semibold text-chalk transition hover:bg-grass hover:text-night disabled:opacity-40"
          >
            + Goal
          </button>
        )}
      </div>
    );
  };

  const remaining = Math.max(0, cap - sum);
  const needsPicks = cap > 0 && sum < cap;
  const over = sum > cap;
  const collapsible = cap > 0;
  const countClass = over ? "text-red-600" : needsPicks ? "text-gold" : cap > 0 ? "text-grass" : "";

  const headerInner = (
    <>
      <span className="flex min-w-0 items-center gap-1 truncate">
        {collapsible && <span className="text-[10px] text-chalk-dim">{collapsed ? "▸" : "▾"}</span>}
        <Ball size={14} /> {label}
        {hasLineup && (
          <span className="rounded bg-grass/15 px-1 text-[9px] font-bold uppercase text-grass">lineup</span>
        )}
      </span>
      <span className={`shrink-0 ${countClass}`}>
        {sum}/{cap} goals
      </span>
    </>
  );
  const headerClass = "mb-1.5 flex w-full items-center justify-between gap-2 text-left text-xs font-medium text-chalk-dim";

  return (
    <div>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          className={`${headerClass} cursor-pointer transition hover:text-chalk`}
        >
          {headerInner}
        </button>
      ) : (
        <p className={headerClass}>{headerInner}</p>
      )}
      {cap === 0 ? (
        <p className="text-[11px] text-chalk-dim">Predict a goal for {label} to assign scorers.</p>
      ) : collapsed ? (
        // Collapsed: hide the chips but make it unmistakable whether scorers are
        // still owed for this team, so a hidden section never reads as "done".
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className={`text-left text-[11px] font-semibold ${needsPicks ? "text-gold" : over ? "text-red-600" : "text-grass"}`}
        >
          {needsPicks
            ? `⚠ Still need ${remaining} scorer${remaining > 1 ? "s" : ""} — tap to choose`
            : over
              ? `⚠ ${sum}/${cap} — too many, tap to fix`
              : `✓ ${cap} scorer${cap > 1 ? "s" : ""} chosen — tap to edit`}
        </button>
      ) : (
        <div className="space-y-2">
          {selected.length > 0 && <div className="space-y-1.5">{selected.map(row)}</div>}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label} players…`}
            aria-label={`Search ${label} players`}
            className="w-full rounded-lg border border-night/10 bg-white px-3 py-2 text-sm text-chalk outline-none focus:border-grass focus:ring-2 focus:ring-grass/30"
          />
          <div className="max-h-80 space-y-1.5 overflow-y-auto">{candidates.map(row)}</div>
          {moreAvailable && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-[11px] font-semibold text-chalk-dim transition hover:text-chalk"
            >
              ⬇ Show full squad ({unpicked.length - candidates.length} more)
            </button>
          )}
          {q.length >= 1 && candidates.length === 0 && (
            <p className="text-[11px] text-chalk-dim">No players match &ldquo;{query}&rdquo;.</p>
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
