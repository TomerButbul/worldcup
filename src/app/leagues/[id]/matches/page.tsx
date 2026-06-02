import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";
import MatchCard, { type MatchCardData } from "./MatchCard";
import { nowMs } from "@/lib/clock";

export default async function MatchesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!league) notFound();

  const [{ data: matches }, { data: teams }, { data: players }, { data: preds }, { data: bracket }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id, stage, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals")
        .order("kickoff_at"),
      supabase.from("teams").select("id, name"),
      supabase.from("players").select("id, team_id, name"),
      supabase
        .from("match_predictions")
        .select("match_id, home_goals, away_goals, scorer_ids")
        .eq("league_id", id)
        .eq("user_id", user.id),
      supabase
        .from("bracket_predictions")
        .select("group_scores")
        .eq("league_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const playersByTeam = new Map<number, Player[]>();
  for (const p of (players ?? []) as Player[]) {
    if (p.team_id == null) continue;
    if (!playersByTeam.has(p.team_id)) playersByTeam.set(p.team_id, []);
    playersByTeam.get(p.team_id)!.push(p);
  }
  const predByMatch = new Map((preds ?? []).map((p) => [p.match_id, p]));
  // The user's upfront bracket scorelines (keyed by DB match id) — shown
  // read-only on group cards, where the live game scores scorers only.
  const groupScores = (bracket?.group_scores ?? {}) as Record<string, { h: number; a: number }>;

  const now = nowMs();
  const upcoming: typeof matches = [];
  const past: typeof matches = [];
  for (const m of matches ?? []) {
    (new Date(m.kickoff_at).getTime() > now ? upcoming : past).push(m);
  }
  past.reverse(); // most recent first

  function toCard(m: NonNullable<typeof matches>[number]): MatchCardData {
    return {
      id: m.id,
      stage: m.stage,
      kickoff_at: m.kickoff_at,
      status: m.status,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeName: m.home_team_id ? (teamName.get(m.home_team_id) ?? "TBD") : "TBD",
      awayName: m.away_team_id ? (teamName.get(m.away_team_id) ?? "TBD") : "TBD",
      homeGoalsActual: m.home_goals,
      awayGoalsActual: m.away_goals,
    };
  }

  function renderCard(m: NonNullable<typeof matches>[number]) {
    return (
      <MatchCard
        key={m.id}
        leagueId={id}
        match={toCard(m)}
        homePlayers={m.home_team_id ? (playersByTeam.get(m.home_team_id) ?? []) : []}
        awayPlayers={m.away_team_id ? (playersByTeam.get(m.away_team_id) ?? []) : []}
        initial={predByMatch.get(m.id) ?? null}
        bracketScore={groupScores[String(m.id)] ?? null}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Match predictions</h1>
        <p className="text-sm text-chalk-dim">
          Predict the score and goal scorers. Each match locks at kickoff. ⚡
        </p>
      </div>

      {(matches ?? []).length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          ⚽ No fixtures loaded yet. Run the sync to import the schedule.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-xl text-chalk">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-chalk-dim">No upcoming matches.</p>
            ) : (
              upcoming.map(renderCard)
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-xl text-chalk">Played</h2>
              {past.map(renderCard)}
            </section>
          )}
        </>
      )}
    </main>
  );
}
