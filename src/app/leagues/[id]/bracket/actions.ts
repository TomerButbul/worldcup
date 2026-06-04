"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userPredictionLeagueIds } from "@/lib/predictionSync";

export async function saveBracket(
  leagueId: string,
  payload: {
    group_order: Record<string, number[]>; // group label → predicted [1st,2nd,3rd,4th] team ids
    third_qualifiers: string[]; // the 8 groups whose 3rd-placed team advances
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
  // Account-level picks: mirror to every prediction league the user belongs to.
  // (group_scores/awards are managed elsewhere and left untouched: omitted columns
  // keep their existing value on conflict-update.)
  const leagueIds = await userPredictionLeagueIds(supabase, user.id);
  const targets = leagueIds.length ? leagueIds : [leagueId];
  const rows = targets.map((lid) => ({
    league_id: lid,
    user_id: user.id,
    group_order: payload.group_order,
    third_qualifiers: payload.third_qualifiers,
    knockout: payload.knockout,
    champion_team_id: payload.champion_team_id,
    submitted_at: now,
    updated_at: now,
  }));
  const { error } = await supabase
    .from("bracket_predictions")
    .upsert(rows, { onConflict: "league_id,user_id" });

  if (error) return { ok: false, error: error.message };

  for (const lid of targets) revalidatePath(`/leagues/${lid}`);
  return { ok: true };
}
