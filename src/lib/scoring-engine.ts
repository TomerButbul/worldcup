import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoringConfig } from "@/lib/types";
import { DEFAULT_SCORING } from "@/lib/types";
import { computeActuals, scoreUpfront, scoreLive, type MatchRow } from "@/lib/scoring-core";

// Recompute and upsert scores for every league. Call with a service-role client.
export async function recomputeAllScores(supabase: SupabaseClient) {
  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, group_label, status, home_team_id, away_team_id, home_goals, away_goals");
  const { data: goals } = await supabase.from("match_goals").select("match_id, player_id");

  const goalsByMatch = new Map<number, number[]>();
  for (const g of goals ?? []) {
    if (!goalsByMatch.has(g.match_id)) goalsByMatch.set(g.match_id, []);
    goalsByMatch.get(g.match_id)!.push(g.player_id);
  }

  const actual = computeActuals((matches ?? []) as MatchRow[], goalsByMatch);

  const { data: leagues } = await supabase.from("leagues").select("id, scoring");

  for (const league of leagues ?? []) {
    const cfg = (league.scoring as ScoringConfig) ?? DEFAULT_SCORING;

    const { data: brackets } = await supabase
      .from("bracket_predictions")
      .select("user_id, group_standings, knockout, champion_team_id")
      .eq("league_id", league.id);

    const { data: matchPreds } = await supabase
      .from("match_predictions")
      .select("user_id, match_id, home_goals, away_goals, scorer_ids")
      .eq("league_id", league.id);

    const predsByUser = new Map<string, typeof matchPreds>();
    for (const p of matchPreds ?? []) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, []);
      predsByUser.get(p.user_id)!.push(p);
    }

    const updates = (brackets ?? []).map((b) => ({
      league_id: league.id,
      user_id: b.user_id,
      upfront_points: scoreUpfront(cfg, actual, b),
      live_points: scoreLive(cfg, actual, predsByUser.get(b.user_id) ?? []),
      updated_at: new Date().toISOString(),
    }));

    if (updates.length) {
      await supabase.from("scores").upsert(updates, { onConflict: "league_id,user_id" });
    }
  }
}
