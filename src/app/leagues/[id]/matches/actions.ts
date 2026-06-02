"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function savePrediction(
  leagueId: string,
  matchId: number,
  homeGoals: number | null,
  awayGoals: number | null,
  scorerIds: number[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lock at kickoff; stage decides whether a scoreline is part of the live pick.
  const { data: match } = await supabase
    .from("matches")
    .select("kickoff_at, stage")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { ok: false, error: "Match not found" };
  if (new Date(match.kickoff_at).getTime() <= Date.now()) {
    return { ok: false, error: "This match has kicked off — predictions are locked" };
  }

  // Group matches: the scoreline is owned by the upfront bracket, so the live
  // pick is scorers-only (no scoreline stored). Knockouts: full score + scorers.
  const isGroup = match.stage === "group";
  let home: number | null = null;
  let away: number | null = null;
  if (!isGroup) {
    if (
      !Number.isInteger(homeGoals) ||
      !Number.isInteger(awayGoals) ||
      (homeGoals as number) < 0 ||
      (awayGoals as number) < 0
    ) {
      return { ok: false, error: "Invalid score" };
    }
    home = homeGoals;
    away = awayGoals;
  }

  const { error } = await supabase.from("match_predictions").upsert(
    {
      league_id: leagueId,
      user_id: user.id,
      match_id: matchId,
      home_goals: home,
      away_goals: away,
      scorer_ids: scorerIds,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "league_id,user_id,match_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
