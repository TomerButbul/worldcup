"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function savePrediction(
  leagueId: string,
  matchId: number,
  homeGoals: number,
  awayGoals: number,
  scorerIds: number[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (
    !Number.isInteger(homeGoals) ||
    !Number.isInteger(awayGoals) ||
    homeGoals < 0 ||
    awayGoals < 0
  ) {
    return { ok: false, error: "Invalid score" };
  }

  // Lock at kickoff.
  const { data: match } = await supabase
    .from("matches")
    .select("kickoff_at")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { ok: false, error: "Match not found" };
  if (new Date(match.kickoff_at).getTime() <= Date.now()) {
    return { ok: false, error: "This match has kicked off — predictions are locked" };
  }

  const { error } = await supabase.from("match_predictions").upsert(
    {
      league_id: leagueId,
      user_id: user.id,
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      scorer_ids: scorerIds,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "league_id,user_id,match_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
