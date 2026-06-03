import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import type { MatchScore, Team } from "@/lib/types";
import BracketEditor, { type GroupMatch } from "./BracketEditor";
import { nowMs } from "@/lib/clock";
import Ball from "@/components/art/Ball";

export default async function BracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, bracket_lock_at, kind")
    .eq("id", id)
    .maybeSingle();
  if (!league) redirect("/dashboard");
  if (league.kind === "draft") redirect(`/leagues/${id}`); // draft leagues don't predict

  const locked = new Date(league.bracket_lock_at).getTime() <= nowMs();

  const [teams, { data: matches }, { data: prediction }] = await Promise.all([
    getCachedTeams(),
    supabase
      .from("matches")
      .select("id, group_label, home_team_id, away_team_id, kickoff_at")
      .eq("stage", "group")
      .order("kickoff_at")
      .order("id"),
    supabase
      .from("bracket_predictions")
      .select("group_scores, knockout, champion_team_id")
      .eq("league_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const teamList = teams as (Team & { fifa_rank: number | null })[];
  const byId = new Map(teamList.map((t) => [t.id, t]));

  // Stitch each fixture to its two team objects; derive the group from the
  // match (backfilled) or fall back to the home team's group.
  const groupMatches: GroupMatch[] = [];
  for (const m of matches ?? []) {
    const home = m.home_team_id != null ? byId.get(m.home_team_id) : undefined;
    const away = m.away_team_id != null ? byId.get(m.away_team_id) : undefined;
    if (!home || !away) continue;
    const group = m.group_label ?? home.group_label;
    if (!group) continue;
    groupMatches.push({
      id: m.id,
      group,
      home: { id: home.id, name: home.name, code: home.code, logo_url: home.logo_url },
      away: { id: away.id, name: away.name, code: away.code, logo_url: away.logo_url },
    });
  }

  const fifaRank: Record<number, number> = {};
  for (const t of teamList) if (t.fifa_rank != null) fifaRank[t.id] = t.fifa_rank;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6">
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Your upfront bracket</h1>
        <p className="text-sm text-chalk-dim">
          {locked
            ? "🔒 Predictions are locked."
            : "Predict every group scoreline — the knockout bracket builds itself from your results. Then call the winners all the way to the trophy."}
        </p>
        <Link
          href={`/leagues/${id}/awards`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold transition hover:bg-gold/20"
        >
          🏅 Predict individual awards →
        </Link>
      </div>

      {groupMatches.length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          <Ball size={14} className="mr-1 inline-block align-[-2px]" />Tournament fixtures haven&apos;t been loaded yet. Run the sync to import the 2026
          groups, then come back to make your picks.
        </p>
      ) : (
        <BracketEditor
          leagueId={id}
          groupMatches={groupMatches}
          fifaRank={fifaRank}
          initialScores={(prediction?.group_scores ?? {}) as Record<string, MatchScore>}
          initialKnockout={(prediction?.knockout ?? {}) as Record<string, number>}
          initialChampion={prediction?.champion_team_id ?? null}
          locked={locked}
        />
      )}
    </main>
  );
}
