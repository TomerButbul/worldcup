"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import RankingsBoard from "./RankingsBoard";
import Leaderboard, { type LeaderboardRow } from "@/app/leagues/[id]/Leaderboard";
import LeagueNameEditor from "@/app/leagues/[id]/LeagueNameEditor";
import ShareInvite from "@/components/ShareInvite";
import ReferralLink from "@/components/ReferralLink";
import LocalTime from "@/components/LocalTime";
import Reveal from "@/components/Reveal";
import GameButton from "@/components/GameButton";
import { createLeague, joinLeague } from "@/app/dashboard/actions";
import type { GlobalRank } from "@/lib/globalRankings";

// The Invitational bracket lock = the World Cup opener (Jun 11, 19:00 UTC).
const PRIZE_LOCK_ISO = "2026-06-11T19:00:00Z";

type SlimTeam = { id: number; name: string; code: string | null; logo_url: string | null };
export type LeagueBoard = {
  id: string;
  name: string;
  joinCode: string;
  isOwner: boolean;
  locked: boolean;
  rows: LeaderboardRow[];
};

// The single home for ALL leaderboards. A switcher flips between the worldwide
// "Global" board and each of your private leagues — because a prediction league
// is now just a filtered ranking (same account-level picks, same scoring; only
// the member list differs), so there's no separate "league page" to get lost in.
// Each board reuses the existing components: RankingsBoard (Global) and the
// realtime Leaderboard (per league, with tap-a-member → their picks).
export default function RankingsHub({
  meId,
  teams,
  global,
  leagues,
  drafts,
  referralLink,
  prizeExists,
  lockRel,
  initialLeagueId,
  error,
}: {
  meId: string;
  teams: SlimTeam[];
  global: GlobalRank[];
  leagues: LeagueBoard[];
  drafts: { id: string; name: string }[];
  referralLink: string | null;
  prizeExists: boolean;
  lockRel: string | null;
  initialLeagueId: string | null;
  error: string | null;
}): JSX.Element {
  const [sel, setSel] = useState<string>(() =>
    initialLeagueId && leagues.some((l) => l.id === initialLeagueId) ? initialLeagueId : "global",
  );
  const league = sel === "global" ? null : leagues.find((l) => l.id === sel) ?? null;

  // Create/join a private league lives here now — the Leagues hub owns leagues.
  // Auto-open for newcomers (no private league yet) or when a create/join bounced
  // back here with an error to show.
  const [showNew, setShowNew] = useState(leagues.length === 0 || !!error);
  const inputClass =
    "w-full rounded-xl border border-night/10 bg-white px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30";

  const pill = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
      active ? "bg-gold text-night glow-gold" : "glass text-chalk-dim hover:text-chalk"
    }`;

  return (
    <>
      <Reveal>
        <div className="glass-strong rounded-3xl p-5 sm:p-6">
          {/* Switcher: Global + your prediction leagues flip the board inline; draft
              leagues are a different game (their own room + 3-pot standings), so
              their pills link out to that room instead of swapping the board. Wraps
              to new lines (no horizontal scroll) so no league pill ever gets clipped. */}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setSel("global")} className={pill(sel === "global")}>
              🌍 Global
            </button>
            {leagues.map((l) => (
              <button key={l.id} type="button" onClick={() => setSel(l.id)} className={pill(sel === l.id)}>
                {l.name}
              </button>
            ))}
            {drafts.map((d) => (
              <Link
                key={d.id}
                href={`/leagues/${d.id}`}
                className="flex shrink-0 items-center gap-1 rounded-full bg-electric/15 px-3.5 py-1.5 text-sm font-semibold text-electric ring-1 ring-inset ring-electric/30 transition hover:bg-electric/25"
              >
                ⚽ {d.name} <span aria-hidden className="text-xs opacity-70">↗</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              aria-expanded={showNew}
              className="flex shrink-0 items-center rounded-full border border-dashed border-gold/50 px-3.5 py-1.5 text-sm font-semibold text-gold transition hover:bg-gold/10"
            >
              + League
            </button>
          </div>

          {/* Context header for the selected board */}
          {league ? (
            // key per league so LeagueNameEditor + ShareInvite (both seed from props
            // via useState) remount with the right name/code on switch — same stale-
            // state trap the board had.
            <div key={league.id} className="mt-4 space-y-2">
              <LeagueNameEditor leagueId={league.id} initialName={league.name} isOwner={league.isOwner} />
              <p className="text-sm text-chalk-dim">
                Private league · {league.rows.length} {league.rows.length === 1 ? "manager" : "managers"}
                {" · "}
                <span className={league.locked ? "text-chalk-dim" : "text-grass"}>
                  {league.locked ? "🔒 picks locked" : "picks open"}
                </span>
              </p>
              <div className="pt-1">
                <ShareInvite code={league.joinCode} name={league.name} />
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <h1 className="font-display text-3xl text-gradient-gold">Global rankings</h1>
              <p className="text-sm text-chalk-dim">Every player, ranked by their best score.</p>
              {prizeExists && (
                <div className="mt-3 rounded-2xl border border-gold/40 bg-gold/[0.06] p-4">
                  <p className="text-sm leading-relaxed text-chalk">
                    <span className="font-semibold text-gold">🏆 Cash prize</span> — finish #1 on
                    this board to win. The pool grows with every player who joins.{" "}
                    <Link href="/rules" className="font-semibold text-gold hover:underline">
                      Rules
                    </Link>
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-night/[0.06] px-3 py-1 text-xs font-semibold text-chalk-dim">
                    🔒 Picks lock <LocalTime iso={PRIZE_LOCK_ISO} mode="date" />
                    {lockRel ? ` · ${lockRel}` : ""}
                  </div>
                  {referralLink && (
                    <div className="mt-3">
                      <ReferralLink link={referralLink} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Reveal>

      {showNew && (
        <Reveal>
          <div className="glass-strong space-y-3 rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-chalk">Play with friends</h2>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="text-xs font-semibold text-chalk-dim transition hover:text-chalk"
              >
                Close
              </button>
            </div>
            <p className="text-sm text-chalk-dim">
              Start a private league or join one with a code — your picks count in every league you&apos;re in.
            </p>
            {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <form action={createLeague} className="space-y-2 rounded-2xl bg-night/5 p-4">
                <h3 className="font-display text-chalk">Create a league</h3>
                <input name="name" required placeholder="League name" aria-label="League name" className={inputClass} />
                <GameButton type="submit" variant="primary" className="w-full">
                  Create
                </GameButton>
              </form>
              <form action={joinLeague} className="space-y-2 rounded-2xl bg-night/5 p-4">
                <h3 className="font-display text-chalk">Join a league</h3>
                <input
                  name="join_code"
                  required
                  placeholder="JOIN CODE"
                  aria-label="Join code"
                  className={`${inputClass} font-mono uppercase tracking-widest`}
                />
                <GameButton type="submit" variant="gold" className="w-full">
                  Join
                </GameButton>
              </form>
            </div>
          </div>
        </Reveal>
      )}

      <Reveal index={1}>
        {league ? (
          // key forces a fresh mount per league — Leaderboard seeds its rows from
          // initialRows once, so without this, switching league A→B kept A's board.
          <Leaderboard key={league.id} leagueId={league.id} initialRows={league.rows} meId={meId} />
        ) : (
          <RankingsBoard ranks={global} teams={teams} meId={meId} />
        )}
      </Reveal>

    </>
  );
}
