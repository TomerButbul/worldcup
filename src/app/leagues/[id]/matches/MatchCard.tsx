"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
import Ball from "@/components/art/Ball";
import MatchCountdown from "@/components/MatchCountdown";
import { nowMs } from "@/lib/clock";
import { stageLabel } from "@/lib/stages";
import type { LineupRow } from "./[matchId]/Pitch";

// The formation pitch from the match centre, lazy-loaded only when a card's
// lineups are expanded — keeps the matches list lean (Pitch is a big component).
const LazyPitch = dynamic(() => import("./[matchId]/Pitch"), {
  loading: () => <p className="py-6 text-center text-xs text-chalk-dim">Loading lineups…</p>,
});

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
  // Rendered inside the match page (which shows its own lineup) — hide the inline
  // "Lineups ▾" toggle, its panel, and the "Full match centre" link.
  embedded?: boolean;
  // On the matches page the cards sit under a day header, so the per-card date is
  // redundant — show just the kickoff time so the header doesn't go right-heavy on
  // mobile (full weekday + date pushed against the right edge).
  compactWhen?: boolean;
}

// Adapt the matches page's lighter lineup ({ starters, subs, xi }) + the squad
// list into the match-centre <Pitch>'s LineupRow, so the same formation pitch can
// render inline without a second fetch. Returns null when there's no XI to draw.
function toLineupRow(teamId: number | null, lu: Lineup | null | undefined, players: Player[]): LineupRow | null {
  if (teamId == null || !lu) return null;
  const byId = new Map(players.map((p) => [p.id, p]));
  const xi = (lu.xi ?? []).map((x) => ({
    player_id: x.player_id,
    name: x.name ?? byId.get(x.player_id)?.name ?? `#${x.player_id}`,
    number: null,
    pos: x.pos ?? byId.get(x.player_id)?.position ?? null,
    grid: x.grid ?? null,
  }));
  if (xi.length === 0) return null;
  const subs = (lu.subs ?? []).map((id) => {
    const p = byId.get(id);
    return { player_id: id, name: p?.name ?? `#${id}`, number: null, pos: p?.position ?? null, grid: null };
  });
  return { team_id: teamId, formation: null, xi, subs };
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
  embedded = false,
  compactWhen = false,
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [lineupsOpen, setLineupsOpen] = useState(false);

  const kickoff = new Date(match.kickoff_at).toLocaleString(
    undefined,
    compactWhen
      ? { hour: "2-digit", minute: "2-digit" }
      : { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  );

  const live = match.status === "live";
  const allPlayers = [...homePlayers, ...awayPlayers];
  const playerName = (id: number) => allPlayers.find((p) => p.id === id)?.name ?? `#${id}`;

  // Formation data for the inline lineups dropdown — built from props the page
  // already passes (no extra fetch). `has` gates the empty-state copy.
  const lineups = useMemo(() => {
    const homeLR = toLineupRow(match.homeTeamId, homeLineup, homePlayers);
    const awayLR = toLineupRow(match.awayTeamId, awayLineup, awayPlayers);
    const photoById: Record<number, string | null> = {};
    const ovrById: Record<number, number | null> = {};
    for (const p of [...homePlayers, ...awayPlayers]) {
      photoById[p.id] = p.photo_url ?? null;
      ovrById[p.id] = p.ovr ?? null;
    }
    return { homeLR, awayLR, photoById, ovrById, has: !!homeLR || !!awayLR };
  }, [match.homeTeamId, match.awayTeamId, homeLineup, awayLineup, homePlayers, awayPlayers]);

  // The collapsible lineups panel — shared by the locked & predictor views. The
  // pitch is the same one the match centre uses; "Full match centre" still links
  // out for live stats + everyone's predictions (which need the heavier fetch).
  const lineupsPanel = lineupsOpen ? (
    <div className="mt-3 border-t border-night/10 pt-3">
      {lineups.has ? (
        <LazyPitch
          home={lineups.homeLR}
          away={lineups.awayLR}
          homeName={match.homeName}
          awayName={match.awayName}
          events={[]}
          photoById={lineups.photoById}
          ovrById={lineups.ovrById}
        />
      ) : (
        <p className="py-3 text-center text-xs text-chalk-dim">
          <Ball size={13} className="mr-1 inline-block align-[-2px]" />
          Lineups land about an hour before kickoff.
        </p>
      )}
      <div className="mt-3 text-center">
        <Link
          href={`/leagues/${leagueId}/matches/${match.id}`}
          className="text-xs font-semibold text-gold transition hover:text-gold-bright"
        >
          Full match centre — live stats &amp; everyone&apos;s predictions &rarr;
        </Link>
      </div>
    </div>
  ) : null;

  // The toggle that opens the panel (rendered in both card footers).
  const lineupsToggle = (
    <button
      type="button"
      onClick={() => setLineupsOpen((o) => !o)}
      aria-expanded={lineupsOpen}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-chalk-dim transition hover:text-gold"
    >
      Lineups <span className={`text-[10px] transition-transform ${lineupsOpen ? "rotate-180" : ""}`}>▾</span>
    </button>
  );

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

  // One team in the score row, stacked vertically: a big crest over the name, so
  // it reads cleanly in the narrow column. Tapping the crest opens the country
  // card (consistent with crests everywhere in the app). While picking, the name
  // doubles as the scorer-picker selector for that team (active = gold) with its
  // scorer count beneath. Locked / no-squad / TBD: the whole stack opens the card.
  function teamSide(side: "home" | "away") {
    const isHome = side === "home";
    const tName = isHome ? match.homeName : match.awayName;
    const tId = isHome ? match.homeTeamId : match.awayTeamId;
    const crest = <Flag teamId={tId} name={tName} size={44} className="drop-shadow-sm" />;
    const nameText = (
      // Full team names: wrap to a second line rather than truncating (e.g.
      // "Bosnia & Herzegovina"). leading-tight keeps two lines compact; the column
      // already has min-w-0 so wrapping never widens the card.
      <span className="block max-w-full text-center text-[13px] font-semibold leading-tight text-chalk sm:text-base">
        {tName}
      </span>
    );

    if (picking && tId != null) {
      const isActive = activeTeam === side;
      // Tap the crest → the country card; tap the name → pick this team's scorers.
      // The scorer count lives inside the picker (and the locked "your pick" detail),
      // not here — so a predicted card stays the exact same height as an unpicked one.
      return (
        <div
          className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 transition ${
            activeTeam !== null && !isActive ? "opacity-50" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => openTeamCard({ teamId: tId, name: tName })}
            aria-label={`${tName} — team profile & FIFA rank`}
            className="rounded-full transition hover:opacity-80 active:scale-95"
          >
            {crest}
          </button>
          <button
            type="button"
            onClick={() => setActiveTeam((cur) => (cur === side ? null : side))}
            aria-label={`Pick ${tName} scorers`}
            className={`flex max-w-full select-none rounded-lg px-1 py-1 transition ${
              isActive ? "bg-gold/15 ring-1 ring-gold/60" : "hover:bg-night/5"
            }`}
          >
            {nameText}
          </button>
        </div>
      );
    }

    if (tId != null) {
      return (
        <TeamCardButton
          teamId={tId}
          name={tName}
          className="flex min-w-0 flex-1 flex-col items-center gap-1.5 transition hover:opacity-80"
        >
          {crest}
          {nameText}
        </TeamCardButton>
      );
    }

    return (
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        {crest}
        {nameText}
      </div>
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

  const lockedScorerList = Object.entries(initial?.scorer_goals ?? {})
    .map(([pid, n]) => `${playerName(Number(pid))}${n > 1 ? ` ×${n}` : ""}`);
  const lockedScorers = lockedScorerList.join(", ");

  const penName =
    initial?.pen_winner_team_id == null
      ? null
      : initial.pen_winner_team_id === match.homeTeamId
        ? match.homeName
        : initial.pen_winner_team_id === match.awayTeamId
          ? match.awayName
          : null;

  return (
    <motion.div layout className="glass overflow-hidden rounded-2xl p-4">
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
          {pickScore || lockedScorers || penName ? (
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-grass/15 px-3 py-1.5 transition hover:bg-grass/25"
            >
              <span className="font-semibold text-grass">Your pick:</span>
              <span className="font-display text-sm tabular-nums text-chalk">{pickScore ?? "—"}</span>
              {(lockedScorers || penName) && <span className="text-[11px] text-chalk-dim">tap for detail ›</span>}
            </button>
          ) : (
            <span>🔒 Locked — no prediction made</span>
          )}
          {!embedded && lineupsToggle}

          {detailOpen && (
            <div
              className="fixed inset-0 z-[200] grid place-items-center bg-night/60 p-4 backdrop-blur-sm"
              onClick={() => setDetailOpen(false)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="glass-strong w-full max-w-xs rounded-3xl p-5 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-[11px] uppercase tracking-wide text-chalk-dim">Your prediction</p>
                <p className="mt-0.5 text-xs text-chalk-dim">
                  {match.homeName} <span className="text-chalk-dim/60">v</span> {match.awayName}
                </p>
                <p className="mt-2 font-display text-4xl tabular-nums text-gradient-gold">{pickScore ?? "—"}</p>
                {penName && <p className="mt-1 text-xs text-chalk-dim">🥅 Penalties: {penName}</p>}
                {lockedScorerList.length > 0 ? (
                  <div className="mt-4 text-left">
                    <p className="mb-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">
                      Goal scorers
                    </p>
                    <ul className="space-y-1">
                      {lockedScorerList.map((s, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-sm text-chalk">
                          <Ball size={13} className="shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-chalk-dim">No goal scorers picked.</p>
                )}
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  className="mt-5 w-full rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-night transition hover:brightness-110"
                >
                  Close
                </button>
              </div>
            </div>
          )}
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
          ) : activeTeam === null ? (
            <p className="mt-3 text-center text-xs text-chalk-dim">
              <Ball size={12} className="mr-1 inline-block align-[-2px]" />
              Tap a team name above to pick goal scorers
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {activeTeam === "home" ? (
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
          <div className="mt-4 flex items-center justify-end gap-2">
            <SaveStatus state={saveState} error={saveErr} />
          </div>
        </>
      )}
      {!embedded && lineupsPanel}
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
          action={atCap ? undefined : { label: sel ? "⚽ Add another goal" : "⚽ Add a goal", run: () => onAdjust(p.id, 1) }}
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
  // Two clear targets (no flaky long-press): tap the FACE to add a goal, tap the
  // NAME for the player's card/stats. The tile shows position + OVR at a glance.
  const pitchNode = ({ p, x, y }: { p: Player; x: number; y: number }) => {
    const count = scorerGoals[String(p.id)] ?? 0;
    const pos = posShort(p.position);
    const disabled = atCap && count === 0;
    return (
      <div
        key={p.id}
        style={{ left: `${x}%`, top: `${y}%` }}
        className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center gap-0.5"
      >
        <button
          type="button"
          onClick={() => onAdjust(p.id, 1)}
          disabled={disabled}
          aria-label={`Add a goal for ${p.name}`}
          className={`relative block rounded-full ${disabled ? "opacity-50" : "transition active:scale-95"}`}
        >
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
        </button>
        <button
          type="button"
          onClick={() =>
            openPlayerCard({
              playerId: p.id,
              name: p.name,
              action: atCap
                ? undefined
                : { label: count > 0 ? "⚽ Add another goal" : "⚽ Add a goal", run: () => onAdjust(p.id, 1) },
            })
          }
          aria-label={`${p.name} — stats & details`}
          className="flex max-w-[4.25rem] flex-col items-center gap-0.5"
        >
          <span className="max-w-[4.25rem] truncate rounded bg-night/55 px-1 text-[9px] leading-tight text-white underline-offset-2 hover:underline">
            {p.name.split(" ").slice(-1)[0] ?? p.name}
          </span>
          {(pos || p.ovr != null) && (
            <span className="flex items-center gap-0.5 rounded bg-night/45 px-1 text-[7px] font-bold uppercase leading-none">
              {pos && <span className="text-white/90">{pos}</span>}
              {pos && p.ovr != null && <span className="text-white/40">·</span>}
              {p.ovr != null && <span className="text-gold">{p.ovr}</span>}
            </span>
          )}
        </button>
      </div>
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
            <p className="text-center text-[11px] text-chalk-dim">Tap a <span className="font-semibold text-chalk">face</span> to add a goal · tap a <span className="font-semibold text-chalk">name</span> for stats</p>
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
