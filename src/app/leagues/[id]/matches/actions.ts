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

  // Group matches: the scoreline is owned by the upfront bracket, so the live
  // pick is scorers-only (no scoreline stored) and the scorer cap comes from the
  // bracket. Knockouts: full score + scorers, capped by the predicted score.
  const isGroup = match.stage === "group";
  let home: number | null = null;
  let away: number | null = null;
  let totalCap: number;
  if (isGroup) {
    const { data: bracket } = await supabase
      .from("bracket_predictions")
      .select("group_scores")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle();
    const gs = (bracket?.group_scores as Record<string, { h: number; a: number }> | null)?.[String(matchId)];
    totalCap = gs ? gs.h + gs.a : 0;
  } else {
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
    totalCap = (homeGoals as number) + (awayGoals as number);
  }

  const totalPicked = Object.values(clean).reduce((s, n) => s + n, 0);
  if (totalPicked > totalCap) {
    return {
      ok: false,
      error: isGroup
        ? "Set your bracket score first — you picked more scorers than goals"
        : "You picked more goal scorers than your predicted score",
    };
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

// Set a group match's predicted scoreline straight from the match card — it
// lives in the upfront bracket (group_scores), so this writes there. Lets you
// open a scorer slot without bouncing to the bracket page. Locks at bracket lock.
export async function saveGroupScore(leagueId: string, matchId: number, h: number, a: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 20 || a > 20) {
    return { ok: false, error: "Invalid score" };
  }

  const { data: match } = await supabase.from("matches").select("stage").eq("id", matchId).maybeSingle();
  if (!match) return { ok: false, error: "Match not found" };
  if (match.stage !== "group") return { ok: false, error: "Not a group match" };

  const { data: league } = await supabase
    .from("leagues")
    .select("bracket_lock_at")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) return { ok: false, error: "League not found" };
  if (new Date(league.bracket_lock_at).getTime() <= Date.now()) {
    return { ok: false, error: "Bracket is locked" };
  }

  const { data: bp } = await supabase
    .from("bracket_predictions")
    .select("group_scores")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();
  const gs = { ...((bp?.group_scores as Record<string, { h: number; a: number }> | null) ?? {}) };
  gs[String(matchId)] = { h, a };
  const now = new Date().toISOString();

  // Update only group_scores (preserve knockout/champion/awards); insert with
  // empty defaults if this is the user's first-ever pick in the league.
  if (bp) {
    const { error } = await supabase
      .from("bracket_predictions")
      .update({ group_scores: gs, updated_at: now })
      .eq("league_id", leagueId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("bracket_predictions").insert({
      league_id: leagueId,
      user_id: user.id,
      group_scores: gs,
      knockout: {},
      champion_team_id: null,
      awards: {},
      submitted_at: now,
      updated_at: now,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
