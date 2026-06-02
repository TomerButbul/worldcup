"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AWARD_KEYS } from "@/lib/scoring-core";

export async function saveAwards(leagueId: string, awards: Record<string, number>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Awards lock with the rest of the upfront bracket.
  const { data: league } = await supabase
    .from("leagues")
    .select("bracket_lock_at")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) return { ok: false, error: "League not found" };
  if (new Date(league.bracket_lock_at).getTime() <= Date.now()) {
    return { ok: false, error: "Awards are locked" };
  }

  // Keep only known award keys → positive integer player ids.
  const clean: Record<string, number> = {};
  for (const key of AWARD_KEYS) {
    const pid = Math.floor(Number(awards?.[key]));
    if (Number.isInteger(pid) && pid > 0) clean[key] = pid;
  }

  const now = new Date().toISOString();
  // Update only `awards` so we never clobber the user's group_scores/knockout.
  const { data: existing } = await supabase
    .from("bracket_predictions")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("bracket_predictions")
        .update({ awards: clean, updated_at: now })
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
    : await supabase.from("bracket_predictions").insert({
        league_id: leagueId,
        user_id: user.id,
        group_scores: {},
        knockout: {},
        champion_team_id: null,
        awards: clean,
        updated_at: now,
      });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}
