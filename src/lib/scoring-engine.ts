import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoringConfig } from "@/lib/types";
import { DEFAULT_SCORING } from "@/lib/types";
import { computeActuals, scoreUpfront, scoreLive, type MatchRow } from "@/lib/scoring-core";

// Recompute and upsert scores for every league. Call with a service-role client.
export async function recomputeAllScores(supabase: SupabaseClient) {
  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, group_label, status, home_team_id, away_team_id, home_goals, away_goals, winner_team_id");
  const { data: goals } = await supabase.from("match_goals").select("match_id, player_id, goals");
  const { data: teams } = await supabase.from("teams").select("id, fifa_rank");
  const { data: awardRows } = await supabase.from("tournament_awards").select("key, player_id");

  const goalsByMatch = new Map<number, Map<number, number>>();
  for (const g of goals ?? []) {
    if (!goalsByMatch.has(g.match_id)) goalsByMatch.set(g.match_id, new Map());
    goalsByMatch.get(g.match_id)!.set(g.player_id, g.goals ?? 1);
  }

  const matchRows = (matches ?? []) as MatchRow[];
  const actual = computeActuals(matchRows, goalsByMatch);
  // Overlay admin-entered award winners (overrides the derived Golden Boot too).
  for (const a of awardRows ?? []) actual.awards[a.key] = a.player_id;
  const groupFixtures = matchRows.filter((m) => m.stage === "group");

  const fifaRank = new Map<number, number>();
  for (const t of teams ?? []) {
    if (t.fifa_rank != null) fifaRank.set(t.id, t.fifa_rank);
  }

  const { data: leagues } = await supabase.from("leagues").select("id, scoring");

  for (const league of leagues ?? []) {
    const cfg = (league.scoring as ScoringConfig) ?? DEFAULT_SCORING;

    const { data: brackets } = await supabase
      .from("bracket_predictions")
      .select("user_id, group_scores, group_order, third_qualifiers, knockout, champion_team_id, awards")
      .eq("league_id", league.id);

    const { data: matchPreds } = await supabase
      .from("match_predictions")
      .select("user_id, match_id, home_goals, away_goals, scorer_goals, pen_winner_team_id")
      .eq("league_id", league.id);

    const predsByUser = new Map<string, typeof matchPreds>();
    for (const p of matchPreds ?? []) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, []);
      predsByUser.get(p.user_id)!.push(p);
    }

    const updates = (brackets ?? []).map((b) => ({
      league_id: league.id,
      user_id: b.user_id,
      upfront_points: scoreUpfront(cfg, actual, b, { groupFixtures, fifaRank }),
      live_points: scoreLive(cfg, actual, predsByUser.get(b.user_id) ?? []),
      updated_at: new Date().toISOString(),
    }));

    if (updates.length) {
      await supabase.from("scores").upsert(updates, { onConflict: "league_id,user_id" });
    }
  }
}
