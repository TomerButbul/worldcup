"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userPredictionLeagueIds } from "@/lib/predictionSync";
import { bracketLockState } from "@/lib/bracketLock";
import { knockoutLockMs } from "@/lib/clock";

// The knockout lock = first knockout kickoff (Round of 32), or the fallback until
// those fixtures sync. Tournament-global, so any league's row is fine to read from.
async function firstKnockoutKickoffMs(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number | null> {
  const { data } = await supabase
    .from("matches")
    .select("kickoff_at")
    .neq("stage", "group")
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.kickoff_at ? new Date(data.kickoff_at as string).getTime() : null;
}

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

  const { data: league } = await supabase
    .from("leagues")
    .select("bracket_lock_at")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) return { ok: false, error: "League not found" };

  // The viewer's current bracket state in this league (mirrored across leagues, so
  // this row's reset/submitted state is the account's).
  const { data: cur } = await supabase
    .from("bracket_predictions")
    .select("submitted_at, reset_at, group_order")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  const state = bracketLockState({
    now: Date.now(),
    kickoffMs: new Date(league.bracket_lock_at).getTime(),
    knockoutLockMs: knockoutLockMs(await firstKnockoutKickoffMs(supabase)),
    submittedAtMs: cur?.submitted_at ? new Date(cur.submitted_at as string).getTime() : null,
    resetAtMs: cur?.reset_at ? new Date(cur.reset_at as string).getTime() : null,
    hasGroupBracket: !!(cur?.group_order && Object.keys(cur.group_order).length),
  });

  // Two-phase lock: a committed, non-reset player is locked at kickoff (they must
  // reset to touch the knockout). Late joiners + reset players stay open until R32.
  if (!state.knockoutEditable) {
    return { ok: false, error: "Bracket is locked" };
  }

  const now = new Date().toISOString();
  // Account-level picks: mirror to every prediction league the user belongs to.
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

// The "second chance" reset. A committed player permanently forfeits their group-
// table points in exchange for re-opening their knockout bracket (editable until
// R32). Account-level: applies to every league at once, and snapshots their current
// bracket into original_bracket so they can still look back on it. Idempotent +
// guarded — only fires for someone who genuinely CAN reset right now.
export async function resetBracket(leagueId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await supabase
    .from("leagues")
    .select("bracket_lock_at")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) return { ok: false, error: "League not found" };

  const { data: cur } = await supabase
    .from("bracket_predictions")
    .select("group_scores, group_order, third_qualifiers, knockout, champion_team_id, awards, submitted_at, reset_at")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  const state = bracketLockState({
    now: Date.now(),
    kickoffMs: new Date(league.bracket_lock_at).getTime(),
    knockoutLockMs: knockoutLockMs(await firstKnockoutKickoffMs(supabase)),
    submittedAtMs: cur?.submitted_at ? new Date(cur.submitted_at as string).getTime() : null,
    resetAtMs: cur?.reset_at ? new Date(cur.reset_at as string).getTime() : null,
    hasGroupBracket: !!(cur?.group_order && Object.keys(cur.group_order).length),
  });

  if (!state.canReset) {
    return { ok: false, error: "Reset isn't available right now." };
  }

  // Snapshot the bracket they're giving up (mirrored, so this is the account's).
  const snapshot = {
    group_scores: cur?.group_scores ?? {},
    group_order: cur?.group_order ?? {},
    third_qualifiers: cur?.third_qualifiers ?? [],
    knockout: cur?.knockout ?? {},
    champion_team_id: cur?.champion_team_id ?? null,
    awards: cur?.awards ?? {},
  };
  const now = new Date().toISOString();
  // Account-level: every not-yet-reset row of theirs (`.is reset_at null` keeps it
  // idempotent and first-wins).
  const { error } = await supabase
    .from("bracket_predictions")
    .update({ reset_at: now, original_bracket: snapshot })
    .eq("user_id", user.id)
    .is("reset_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath("/bracket");
  return { ok: true };
}
