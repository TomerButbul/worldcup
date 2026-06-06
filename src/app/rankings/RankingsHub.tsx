"use client";

import { useState, type JSX } from "react";
import Link from "next/link";
import RankingsBoard from "./RankingsBoard";
import Leaderboard, { type LeaderboardRow } from "@/app/leagues/[id]/Leaderboard";
import LeagueNameEditor from "@/app/leagues/[id]/LeagueNameEditor";
import ShareInvite from "@/components/ShareInvite";
import Reveal from "@/components/Reveal";
import type { GlobalRank } from "@/lib/globalRankings";

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
  initialLeagueId,
}: {
  meId: string;
  teams: SlimTeam[];
  global: GlobalRank[];
  leagues: LeagueBoard[];
  drafts: { id: string; name: string }[];
  initialLeagueId: string | null;
}): JSX.Element {
  const [sel, setSel] = useState<string>(() =>
    initialLeagueId && leagues.some((l) => l.id === initialLeagueId) ? initialLeagueId : "global",
  );
  const league = sel === "global" ? null : leagues.find((l) => l.id === sel) ?? null;

  const pill = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
      active ? "bg-gold text-night glow-gold" : "glass text-chalk-dim hover:text-chalk"
    }`;

  return (
    <>
      <Reveal>
        <div className="glass-strong rounded-3xl p-5 sm:p-6">
          <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
            &larr; Home
          </Link>

          {/* Switcher: Global + your prediction leagues flip the board inline; draft
              leagues are a different game (their own room + 3-pot standings), so
              their pills link out to that room instead of swapping the board. */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
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
                🎲 {d.name} <span aria-hidden className="text-xs opacity-70">↗</span>
              </Link>
            ))}
            <Link
              href="/dashboard#leagues"
              className="flex shrink-0 items-center rounded-full border border-dashed border-gold/50 px-3.5 py-1.5 text-sm font-semibold text-gold transition hover:bg-gold/10"
            >
              + League
            </Link>
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
                <ShareInvite code={league.joinCode} />
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <h1 className="font-display text-3xl text-gradient-gold">Global rankings</h1>
              <p className="text-sm text-chalk-dim">Every player, ranked by their best score.</p>
            </div>
          )}
        </div>
      </Reveal>

      <Reveal index={1}>
        {league ? (
          // key forces a fresh mount per league — Leaderboard seeds its rows from
          // initialRows once, so without this, switching league A→B kept A's board.
          <Leaderboard key={league.id} leagueId={league.id} initialRows={league.rows} meId={meId} />
        ) : (
          <RankingsBoard ranks={global} teams={teams} meId={meId} />
        )}
      </Reveal>

      {leagues.length === 0 && (
        <p className="px-1 text-center text-xs text-chalk-dim">
          Playing with friends? {" "}
          <Link href="/dashboard#leagues" className="font-semibold text-gold hover:text-gold-bright">
            Create or join a private league
          </Link>{" "}
          to get your own board here.
        </p>
      )}
    </>
  );
}
