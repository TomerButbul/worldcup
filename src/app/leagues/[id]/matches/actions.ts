"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function savePrediction(
  leagueId: string,
  matchId: number,
  homeGoals: number | null,
  awayGoals: number | null,
  scorerGoals: Record<string, number>,
  penWinnerTeamId: number | null = null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lock at kickoff; stage decides whether a scoreline is part of the live pick.
  const { data: match } = await supabase
    .from("matches")
    .select("kickoff_at, stage, home_team_id, away_team_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { ok: false, error: "Match not found" };
  if (new Date(match.kickoff_at).getTime() <= Date.now()) {
    return { ok: false, error: "This match has kicked off — predictions are locked" };
  }

  // Keep only positive integer goal counts, keyed by player id.
  const clean: Record<string, number> = {};
  for (const [pid, n] of Object.entries(scorerGoals ?? {})) {
    const count = Math.floor(Number(n));
    if (Number.isInteger(Number(pid)) && count > 0) clean[String(Number(pid))] = count;
  }

  // Every stage now stores its own scoreline (group scores moved here from the
  // upfront bracket, which is table-order only). A valid score sets the scorer
  // cap; an unset score → cap 0 (scorers-only).
  const isGroup = match.stage === "group";
  const haveScore =
    Number.isInteger(homeGoals) &&
    Number.isInteger(awayGoals) &&
    (homeGoals as number) >= 0 &&
    (awayGoals as number) >= 0;
  const home: number | null = haveScore ? homeGoals : null;
  const away: number | null = haveScore ? awayGoals : null;
  const totalCap = haveScore ? (homeGoals as number) + (awayGoals as number) : 0;

  const totalPicked = Object.values(clean).reduce((s, n) => s + n, 0);
  if (totalPicked > totalCap) {
    return { ok: false, error: "You picked more goal scorers than your predicted score" };
  }

  // Penalty winner: only for a knockout predicted level, and only one of the two
  // teams. Cleared otherwise so a stale value can't linger on a non-draw pick.
  const penWinner =
    !isGroup &&
    home != null &&
    home === away &&
    (penWinnerTeamId === match.home_team_id || penWinnerTeamId === match.away_team_id)
      ? penWinnerTeamId
      : null;

  const { error } = await supabase.from("match_predictions").upsert(
    {
      league_id: leagueId,
      user_id: user.id,
      match_id: matchId,
      home_goals: home,
      away_goals: away,
      scorer_goals: clean,
      scorer_ids: Object.keys(clean).map(Number), // legacy column kept in sync
      pen_winner_team_id: penWinner,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "league_id,user_id,match_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
