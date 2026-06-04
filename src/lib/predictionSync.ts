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

export type PrimaryLeague = { id: string; name: string; bracket_lock_at: string };

// The user's canonical prediction league. Because picks are account-level
// (mirrored to every prediction league on save), ANY one of them is an equally
// valid source of truth for *reading* the current picks — so the top-level
// /predict, /bracket and /awards pages resolve this one league to prefill from.
// We pick the lexicographically-first league id purely for a stable choice.
// Returns null when the user is in no prediction league yet (draft-only or
// brand new) — callers then show a "join a league first" state.
export async function primaryPredictionLeague(
  supabase: SupabaseClient,
  userId: string,
): Promise<PrimaryLeague | null> {
  const { data } = await supabase
    .from("league_members")
    .select("leagues(id, name, bracket_lock_at, kind)")
    .eq("user_id", userId);

  const leagues: PrimaryLeague[] = [];
  for (const m of (data ?? []) as {
    leagues:
      | { id: string; name: string; bracket_lock_at: string; kind: string | null }
      | { id: string; name: string; bracket_lock_at: string; kind: string | null }[]
      | null;
  }[]) {
    const lg = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
    if (lg && (lg.kind ?? "classic") !== "draft") {
      leagues.push({ id: lg.id, name: lg.name, bracket_lock_at: lg.bracket_lock_at });
    }
  }
  leagues.sort((a, b) => a.id.localeCompare(b.id));
  return leagues[0] ?? null;
}
