"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MatchScore } from "@/lib/types";

export async function saveBracket(
  leagueId: string,
  payload: {
    group_scores: Record<string, MatchScore>;
    knockout: Record<string, number>;
    champion_team_id: number | null;
  },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Enforce the lock server-side.
  const { data: league } = await supabase
    .from("leagues")
    .select("bracket_lock_at")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) return { ok: false, error: "League not found" };
  if (new Date(league.bracket_lock_at).getTime() <= Date.now()) {
    return { ok: false, error: "Bracket is locked" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("bracket_predictions").upsert(
    {
      league_id: leagueId,
      user_id: user.id,
      group_scores: payload.group_scores,
      knockout: payload.knockout,
      champion_team_id: payload.champion_team_id,
      submitted_at: now,
      updated_at: now,
    },
    { onConflict: "league_id,user_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}
