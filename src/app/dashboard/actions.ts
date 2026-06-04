"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userPredictionLeagueIds } from "@/lib/predictionSync";

export async function saveProfile(fields: {
  display_name?: string;
  team_name?: string | null;
  avatar_url?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const update: Record<string, string | null> = {};
  if (fields.display_name !== undefined) {
    const name = fields.display_name.trim();
    if (!name) return { ok: false, error: "Name can't be empty" };
    update.display_name = name;
  }
  if (fields.team_name !== undefined) {
    update.team_name = fields.team_name?.trim() || null;
  }
  if (fields.avatar_url !== undefined) {
    update.avatar_url = fields.avatar_url;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveFavoriteTeam(teamId: number | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ favorite_team_id: teamId })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/dashboard?error=Name+required");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_league", { p_name: name });
  if (error) redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);

  redirect(`/leagues/${data}`);
}

// Join a league by its share/join code, then copy the user's account-level picks
// into it. Returns the joined league id (or an error) WITHOUT redirecting, so it
// can be reused from the dashboard join form, the /join/[code] link, and the
// post-auth callback. Already-a-member is treated as success when the RPC still
// resolves the league id; a hard duplicate error falls through as an error and
// callers can decide what to do.
export async function joinByCode(
  code: string,
): Promise<{ leagueId?: string; error?: string }> {
  const trimmed = code.trim();
  if (!trimmed) return { error: "Join code required" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_league_by_code", {
    p_code: trimmed,
  });
  if (error) return { error: error.message };

  // Account-level picks: copy the user's existing bracket + match predictions into
  // the freshly-joined league so they're scored there too (predict once, count
  // everywhere). Best-effort — never blocks the join.
  const newLeagueId = data as string;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const src = (await userPredictionLeagueIds(supabase, user.id)).find((id) => id !== newLeagueId);
      if (src) {
        const now = new Date().toISOString();
        const { data: br } = await supabase
          .from("bracket_predictions")
          .select("group_order, third_qualifiers, knockout, champion_team_id, awards, group_scores")
          .eq("league_id", src)
          .eq("user_id", user.id)
          .maybeSingle();
        if (br) {
          await supabase
            .from("bracket_predictions")
            .upsert(
              { league_id: newLeagueId, user_id: user.id, ...br, submitted_at: now, updated_at: now },
              { onConflict: "league_id,user_id" },
            );
        }
        const { data: mps } = await supabase
          .from("match_predictions")
          .select("match_id, home_goals, away_goals, scorer_goals, scorer_ids, pen_winner_team_id")
          .eq("league_id", src)
          .eq("user_id", user.id);
        if (mps?.length) {
          const rows = mps.map((m) => ({ ...m, league_id: newLeagueId, user_id: user.id, submitted_at: now }));
          await supabase.from("match_predictions").upsert(rows, { onConflict: "league_id,user_id,match_id" });
        }
      }
    }
  } catch {
    // best-effort; a copy failure should never block joining
  }

  return { leagueId: newLeagueId };
}

export async function joinLeague(formData: FormData) {
  const code = String(formData.get("join_code") ?? "").trim();
  if (!code) redirect("/dashboard?error=Join+code+required");

  const { leagueId, error } = await joinByCode(code);
  if (error) redirect(`/dashboard?error=${encodeURIComponent(error)}`);

  redirect(`/leagues/${leagueId}`);
}
