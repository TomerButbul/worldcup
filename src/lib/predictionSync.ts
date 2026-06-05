import type { SupabaseClient } from "@supabase/supabase-js";

// The dedicated dress-rehearsal/test league (an exact copy gated to one account).
// It IS a real prediction league so the test game can be predicted in it, but it
// must NEVER be treated as a user's canonical prediction league: its all-zeros id
// otherwise sorts first and hijacks the account-level read + mirror, making real
// picks look empty (and risking a save-over). Excluded from both resolvers below.
export const SANDBOX_LEAGUE_ID = "00000000-0000-4000-8000-000000000001";

// Account-level picks: a user makes their bracket / awards / scorelines once and
// they apply to EVERY prediction league they're in. Implemented by mirroring each
// save to all those leagues (and copying on join). Draft leagues are excluded —
// they're a different game with no predictions — as is the sandbox test league.
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
    if (m.league_id === SANDBOX_LEAGUE_ID) continue;
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
// We prefer the global league (every user is in it; it's the stable shared one),
// then fall back to the lexicographically-first id. The sandbox/test league is
// always excluded so it can never hijack the account-level view.
// Returns null when the user is in no prediction league yet (draft-only or
// brand new) — callers then show a "join a league first" state.
export async function primaryPredictionLeague(
  supabase: SupabaseClient,
  userId: string,
): Promise<PrimaryLeague | null> {
  const { data } = await supabase
    .from("league_members")
    .select("leagues(id, name, bracket_lock_at, kind, is_global)")
    .eq("user_id", userId);

  const leagues: { id: string; name: string; bracket_lock_at: string; is_global: boolean }[] = [];
  for (const m of (data ?? []) as {
    leagues:
      | { id: string; name: string; bracket_lock_at: string; kind: string | null; is_global: boolean | null }
      | { id: string; name: string; bracket_lock_at: string; kind: string | null; is_global: boolean | null }[]
      | null;
  }[]) {
    const lg = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
    if (lg && lg.id !== SANDBOX_LEAGUE_ID && (lg.kind ?? "classic") !== "draft") {
      leagues.push({
        id: lg.id,
        name: lg.name,
        bracket_lock_at: lg.bracket_lock_at,
        is_global: lg.is_global ?? false,
      });
    }
  }
  // Prefer the global league; otherwise the lexicographically-first id (stable).
  leagues.sort((a, b) => Number(b.is_global) - Number(a.is_global) || a.id.localeCompare(b.id));
  const top = leagues[0];
  return top ? { id: top.id, name: top.name, bracket_lock_at: top.bracket_lock_at } : null;
}
