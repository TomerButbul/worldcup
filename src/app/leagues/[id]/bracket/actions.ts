"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveBracket(
  leagueId: string,
  payload: {
    group_standings: Record<string, number[]>;
    knockout: {
      round_of_16?: number[];
      quarter?: number[];
      semi?: number[];
      final?: number[];
    };
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

  const { error } = await supabase
    .from("bracket_predictions")
    .update({
      group_standings: payload.group_standings,
      knockout: payload.knockout,
      champion_team_id: payload.champion_team_id,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}
