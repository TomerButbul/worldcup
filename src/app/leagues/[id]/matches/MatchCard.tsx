"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { Player } from "@/lib/types";
import { savePrediction } from "./actions";
import { useAutosave } from "@/lib/useAutosave";
import SaveStatus from "@/components/SaveStatus";
import Flag from "@/components/Flag";
import { TeamCardButton, openTeamCard } from "@/components/TeamCard";
import { VenueButton } from "@/components/VenueCard";
import { venueImage } from "@/lib/venues";
import PlayerAvatar from "@/components/PlayerAvatar";
import { PlayerCardButton, openPlayerCard } from "@/components/PlayerCard";
import { useLongPress } from "@/lib/useLongPress";
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
  venueId: number | null;
  venueName: string | null;
  venueCity: string | null;
}

export interface Lineup {
  starters: number[]; // player ids in the starting XI
  subs: number[]; // player ids on the bench
  // The starting XI with real grid coords ("row:col"), so the picker draws the
  // true formation (like team details). Falls back to role rows when absent.
  xi?: { player_id: number; name?: string | null; pos?: string | null; grid?: string | null }[];
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
  // Override the autosave target (same signature). Defaults to the normal
  // fan-out savePrediction; the gated /sandbox page passes a single-league save
  // so a test pick can never leak into the user's real leagues.
  saveAction?: typeof savePrediction;
}

export default function MatchCard({
  leagueId,
  match,
  homePlayers,
  awayPlayers,
  initial,
  homeLineup,
  awayLineup,
  saveAction,
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
  // Whether the user has set a scoreline yet. Until then the match shows a clean
  // "– : –" (not a misleading 0-0) and never autosaves an empty prediction.
  const [touched, setTouched] = useState(initial != null);
  // Scorer picker shows ONE team at a time. Default to NONE selected so the card
  // stays compact — tap a team in the score row to expand its scorer picker.
  const [activeTeam, setActiveTeam] = useState<"home" | "away" | null>(null);
  const teamLongPress = useLongPress();

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

  // Change a side's score. Lowering it (or zeroing it) prunes that team's scorer
  // picks so you can never have more scorers than goals.
  function changeScore(side: "home" | "away", delta: number) {
    setTouched(true);
    const cur = side === "home" ? home : away;
    const v = Math.max(0, cur + delta);
    if (side === "home") setHome(v);
    else setAway(v);
    if (delta < 0) {
      const sidePlayers = side === "home" ? homePlayers : awayPlayers;
      setScorerGoals((prev) => prunedToCap(prev, sidePlayers, v));
    }
  }

  // Scorer picking is live only pre-kickoff once squads are loaded.
  const picking = !locked && allPlayers.length > 0;

  // One team "pill" in the score row. While picking it doubles as the squad
  // selector: tap to switch which team's scorers you're editing (active = green),
  // hold for the team card, with the scorer count shown beneath the name. Locked /
  // no-squad / TBD falls back to a plain tap-for-team-card label.
  function teamSide(side: "home" | "away") {
    const isHome = side === "home";
    const tName = isHome ? match.homeName : match.awayName;
    const tId = isHome ? match.homeTeamId : match.awayTeamId;
    const rowAlign = isHome ? "justify-end" : "justify-start";
    const flag = <Flag teamId={tId} name={tName} size={26} className="shrink-0" />;
    const nameEl = <span className="truncate">{tName}</span>;
    const inner = isHome ? (<>{nameEl}{flag}</>) : (<>{flag}{nameEl}</>);

    if (picking && tId != null) {
      const tCap = isHome ? homeCap : awayCap;
      const tSum = isHome ? sumFor(homePlayers) : sumFor(awayPlayers);
      const need = tCap > 0 && tSum < tCap;
      const isActive = activeTeam === side;
      return (
        <button
          type="button"
          onClick={() => setActiveTeam((cur) => (cur === side ? null : side))}
          {...teamLongPress(() => openTeamCard({ teamId: tId, name: tName }))}
          aria-label={`Pick ${tName} scorers — hold for team details`}
          className={`flex min-w-0 flex-1 select-none flex-col gap-0.5 border-b-2 px-1 pb-1 transition ${
            isHome ? "items-end" : "items-start"
          } ${
            isActive
              ? "border-gold/70"
              : activeTeam !== null
                ? "border-transparent opacity-45 hover:opacity-80"
                : "border-transparent"
          }`}
        >
          <span className={`flex w-full items-center gap-1.5 text-sm font-semibold text-chalk sm:text-base ${rowAlign}`}>
            {inner}
          </span>
          {tCap > 0 && (
            <span className={`text-[11px] tabular-nums ${need ? "text-gold" : "text-grass"}`}>
              {tSum}/{tCap}
            </span>
          )}
        </button>
      );
    }

    if (tId != null) {
      return (
        <TeamCardButton
          teamId={tId}
          name={tName}
          className={`flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-chalk transition hover:opacity-80 sm:gap-2 sm:text-base ${rowAlign}`}
        >
          {inner}
        </TeamCardButton>
      );
    }

    return (
      <span className={`flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-chalk sm:gap-2 sm:text-base ${rowAlign}`}>
        {inner}
      </span>
    );
  }

  const saveFn = useCallback(
    () =>
      (saveAction ?? savePrediction)(leagueId, match.id, home, away, scorerGoals, !isGroup && home === away ? penWinner : null),
    [saveAction, leagueId, match.id, isGroup, home, away, scorerGoals, penWinner],
  );
  // Auto-save ~0.8s after the last tap — no Save button.
  const signature = `${home}-${away}-${penWinner ?? ""}|${JSON.stringify(scorerGoals)}`;
  const { state: saveState, error: saveErr } = useAutosave(signature, saveFn, { enabled: !locked && touched });

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
        {teamSide("home")}

        {locked ? (
          <span className="net rounded-xl bg-night/5 px-4 py-2 font-display text-xl text-chalk">
            {match.status === "finished" || live
              ? `${match.homeGoalsActual ?? 0} – ${match.awayGoalsActual ?? 0}`
              : "vs"}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Stepper value={touched ? home : "–"} onDec={() => changeScore("home", -1)} onInc={() => changeScore("home", 1)} />
            <span className="text-chalk-dim">–</span>
            <Stepper value={touched ? away : "–"} onDec={() => changeScore("away", -1)} onInc={() => changeScore("away", 1)} />
          </span>
        )}

        {teamSide("away")}
      </div>

      {match.venueName && (
        <div className="mt-2 flex justify-center">
          <VenueButton
            venue={{ id: match.venueId, name: match.venueName, city: match.venueCity }}
            className="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-night/5 py-0.5 pl-0.5 pr-2.5 text-[11px] text-chalk-dim transition hover:bg-night/10 hover:text-chalk"
          >
            {match.venueId != null && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={venueImage(match.venueId) ?? undefined}
                alt=""
                width={24}
                height={16}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="h-4 w-6 shrink-0 rounded-full object-cover"
              />
            )}
            <span className="truncate">
              {match.venueName}
              {match.venueCity ? ` · ${match.venueCity}` : ""}
            </span>
          </VenueButton>
        </div>
      )}

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
              {activeTeam === null ? (
                homeCap > 0 || awayCap > 0 ? (
                  <p className="text-center text-[11px] text-chalk-dim">Tap a team above to add its goal scorers.</p>
                ) : null
              ) : activeTeam === "home" ? (
                <TeamScorers
                  label={match.homeName}
                  players={homePlayers}
                  cap={homeCap}
                  sum={sumFor(homePlayers)}
                  scorerGoals={scorerGoals}
                  lineup={homeLineup}
                  onAdjust={(pid, d) => adjust(pid, d, homePlayers, homeCap)}
                />
              ) : (
                <TeamScorers
                  label={match.awayName}
                  players={awayPlayers}
                  cap={awayCap}
                  sum={sumFor(awayPlayers)}
                  scorerGoals={scorerGoals}
                  lineup={awayLineup}
                  onAdjust={(pid, d) => adjust(pid, d, awayPlayers, awayCap)}
                />
              )}
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

// Drop a side's scorer picks down to fit a (reduced) score, removing from the end
// of the squad list — so lowering or zeroing a team's goals never leaves more
// scorers than goals.
function prunedToCap(scorerGoals: Record<string, number>, players: Player[], cap: number): Record<string, number> {
  const ids = players.map((p) => String(p.id));
  let sum = ids.reduce((s, id) => s + (scorerGoals[id] ?? 0), 0);
  if (sum <= cap) return scorerGoals;
  const out = { ...scorerGoals };
  for (let i = ids.length - 1; i >= 0 && sum > cap; i--) {
    const id = ids[i];
    while ((out[id] ?? 0) > 0 && sum > cap) {
      out[id] = (out[id] ?? 0) - 1;
      sum--;
      if (out[id] === 0) delete out[id];
    }
  }
  return out;
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
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const longPress = useLongPress();
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

  // Pitch view of the starting XI — the primary picker (tap a player → add a
  // goal, hold → their card), like the team-details lineup. Falls back to the
  // search list when no XI is known yet.
  // Lay the XI out by REAL grid coords ("row:col") when we have them → the true
  // formation, exactly like the team-details pitch (row 1 = keeper at the bottom).
  // Otherwise fall back to broad role rows (GK→FWD).
  const POS_ROW: Record<string, number> = { G: 1, D: 2, M: 3, F: 4, A: 4 };
  const byIdAll = new Map(players.map((p) => [p.id, p]));
  const xiSource = (
    lineup?.xi && lineup.xi.length > 0
      ? lineup.xi.map((x) => ({ p: byIdAll.get(x.player_id), pos: x.pos ?? null, grid: x.grid ?? null }))
      : (lineup?.starters ?? []).map((id) => ({ p: byIdAll.get(id), pos: byIdAll.get(id)?.position ?? null, grid: null as string | null }))
  ).filter((s): s is { p: Player; pos: string | null; grid: string | null } => !!s.p);
  const useGrid = xiSource.some((s) => !!s.grid && s.grid.includes(":"));
  const parsedNodes = xiSource.map((s, i) => {
    if (useGrid && s.grid && s.grid.includes(":")) {
      const [r, c] = s.grid.split(":").map((n) => parseInt(n, 10) || 1);
      return { p: s.p, r, c };
    }
    return { p: s.p, r: POS_ROW[(s.pos ?? "M").charAt(0).toUpperCase()] ?? 3, c: i };
  });
  const maxRow = Math.max(1, ...parsedNodes.map((n) => n.r));
  const rowGroups = new Map<number, typeof parsedNodes>();
  for (const n of parsedNodes) {
    if (!rowGroups.has(n.r)) rowGroups.set(n.r, []);
    rowGroups.get(n.r)!.push(n);
  }
  const pitchNodes: { p: Player; x: number; y: number }[] = [];
  for (const [, items] of rowGroups) {
    const sorted = [...items].sort((a, b) => a.c - b.c);
    const frac = maxRow > 1 ? (sorted[0].r - 1) / (maxRow - 1) : 0;
    sorted.forEach((n, i) =>
      pitchNodes.push({ p: n.p, x: ((i + 0.5) / sorted.length) * 100, y: 88 - frac * 74 }),
    );
  }
  const pitchNode = ({ p, x, y }: { p: Player; x: number; y: number }) => {
    const count = scorerGoals[String(p.id)] ?? 0;
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => onAdjust(p.id, 1)}
        {...longPress(() => openPlayerCard({ playerId: p.id, name: p.name }))}
        style={{ left: `${x}%`, top: `${y}%` }}
        aria-label={`Add a goal for ${p.name} — hold for details`}
        className={`absolute flex w-16 -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center gap-0.5 ${atCap && count === 0 ? "opacity-50" : ""}`}
      >
        <span className="relative">
          <PlayerAvatar
            playerId={p.id}
            name={p.name}
            size={34}
            className={`border-2 shadow ${count > 0 ? "border-grass" : "border-white/80"}`}
          />
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white bg-grass px-0.5 text-[10px] font-bold leading-none text-night">
              {count}
            </span>
          )}
        </span>
        <span className="max-w-[4rem] truncate rounded bg-night/55 px-1 text-[9px] leading-tight text-white">
          {p.name.split(" ").slice(-1)[0] ?? p.name}
        </span>
      </button>
    );
  };

  const searchBlock = (
    <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${label} players…`}
        aria-label={`Search ${label} players`}
        className="w-full rounded-lg border border-night/10 bg-white px-3 py-2 text-sm text-chalk outline-none focus:border-grass focus:ring-2 focus:ring-grass/30"
      />
      <div className="max-h-72 space-y-1.5 overflow-y-auto">{candidates.map(row)}</div>
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
    </>
  );

  return (
    <div>
      {cap === 0 ? (
        <p className="text-[11px] text-chalk-dim">Predict a goal first to pick scorers for this team.</p>
      ) : pitchNodes.length > 0 ? (
        // Desktop: pitch on the left, your scorers + search on the right — so the
        // card fills its width instead of a narrow pitch floating in dead space.
        <div className="space-y-2 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
          <div className="space-y-1.5">
            <p className="text-center text-[11px] text-chalk-dim">Tap a player to add a goal · hold for details</p>
            <div className="relative mx-auto aspect-[5/6] w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-grass/70 to-grass/55">
              <div className="absolute bottom-0 left-1/2 h-12 w-28 -translate-x-1/2 border-x border-t border-white/25" />
              <div className="absolute bottom-0 left-1/2 h-5 w-14 -translate-x-1/2 border-x border-t border-white/25" />
              <div className="absolute -top-9 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border border-white/25" />
              {pitchNodes.map(pitchNode)}
            </div>
          </div>
          <div className="space-y-2">
            {selected.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-chalk-dim">Your scorers</p>
                {selected.map(row)}
              </div>
            )}
            <details>
              <summary className="cursor-pointer list-none text-[11px] font-semibold text-chalk-dim transition hover:text-chalk">
                🔍 Search / other players
              </summary>
              <div className="mt-2 space-y-2">{searchBlock}</div>
            </details>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {selected.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-chalk-dim">Your scorers</p>
              {selected.map(row)}
            </div>
          )}
          {searchBlock}
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onDec, onInc }: { value: number | string; onDec: () => void; onInc: () => void }) {
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
