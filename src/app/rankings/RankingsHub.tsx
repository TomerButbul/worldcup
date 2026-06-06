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
  initialLeagueId,
}: {
  meId: string;
  teams: SlimTeam[];
  global: GlobalRank[];
  leagues: LeagueBoard[];
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

          {/* Switcher: Global + your private leagues */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            <button type="button" onClick={() => setSel("global")} className={pill(sel === "global")}>
              🌍 Global
            </button>
            {leagues.map((l) => (
              <button key={l.id} type="button" onClick={() => setSel(l.id)} className={pill(sel === l.id)}>
                {l.name}
              </button>
            ))}
            <Link
              href="/dashboard#leagues"
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-gold transition hover:text-gold-bright"
            >
              + League
            </Link>
          </div>

          {/* Context header for the selected board */}
          {league ? (
            <div className="mt-4 space-y-2">
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
          <Leaderboard leagueId={league.id} initialRows={league.rows} meId={meId} />
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
