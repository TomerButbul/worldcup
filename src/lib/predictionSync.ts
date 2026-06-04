import type { SupabaseClient } from "@supabase/supabase-js";

// Account-level picks: a user makes their bracket / awards / scorelines once and
// they apply to EVERY prediction league they're in. Implemented by mirroring each
// save to all those leagues (and copying on join). Draft leagues are excluded —
// they're a different game with no predictions.
export async function userPredictionLeagueIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("league_members")
    .select("league_id, leagues(kind)")
    .eq("user_id", userId);

  const out: string[] = [];
  for (const m of (data ?? []) as {
    league_id: string;
    leagues: { kind: string | null } | { kind: string | null }[] | null;
  }[]) {
    const lg = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
    if ((lg?.kind ?? "classic") !== "draft") out.push(m.league_id);
  }
  return out;
}
