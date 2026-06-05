"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const SANDBOX = "00000000-0000-4000-8000-000000000001";
const OWNER_EMAIL = "tomerbutbuleast@gmail.com";

// Sandbox-only prediction save. Same signature as the real savePrediction, but
// writes to the single private Sandbox league (no fan-out), so a test pick can
// never reach the user's real leagues or the global board. Owner-gated.
export async function saveSandboxPrediction(
  _leagueId: string,
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
  if (!user || user.email !== OWNER_EMAIL) return { ok: false, error: "Not allowed" };

  const { data: match } = await supabase
    .from("matches")
    .select("kickoff_at")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { ok: false, error: "Match not found" };
  if (new Date(match.kickoff_at).getTime() <= Date.now()) {
    return { ok: false, error: "This match has kicked off — predictions are locked" };
  }

  const clean: Record<string, number> = {};
  for (const [pid, n] of Object.entries(scorerGoals ?? {})) {
    const c = Math.floor(Number(n));
    if (Number.isInteger(Number(pid)) && c > 0) clean[pid] = c;
  }

  const { error } = await supabase.from("match_predictions").upsert(
    {
      league_id: SANDBOX,
      user_id: user.id,
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      scorer_goals: clean,
      pen_winner_team_id: penWinnerTeamId,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "league_id,user_id,match_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sandbox");
  return { ok: true };
}
