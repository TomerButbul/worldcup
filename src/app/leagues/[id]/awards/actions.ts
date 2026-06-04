"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AWARD_KEYS } from "@/lib/scoring-core";
import { userPredictionLeagueIds } from "@/lib/predictionSync";

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
  // Account-level picks: mirror awards to every prediction league the user is in.
  // Upserting ONLY `awards` (+ updated_at) never clobbers each league's existing
  // group_order/knockout on conflict; on a fresh insert the rest take DB defaults.
  const leagueIds = await userPredictionLeagueIds(supabase, user.id);
  const targets = leagueIds.length ? leagueIds : [leagueId];
  const rows = targets.map((lid) => ({
    league_id: lid,
    user_id: user.id,
    awards: clean,
    updated_at: now,
  }));
  const { error } = await supabase
    .from("bracket_predictions")
    .upsert(rows, { onConflict: "league_id,user_id" });

  if (error) return { ok: false, error: error.message };

  for (const lid of targets) revalidatePath(`/leagues/${lid}`);
  return { ok: true };
}
