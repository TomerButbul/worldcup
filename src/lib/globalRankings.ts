import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

// Worldwide leaderboard across every league. Predictions are per-league, so a
// player can hold different totals in different leagues; we rank each player by
// their single best `total_points` (their top performance — not a sum, which
// would just reward joining many leagues). Same caching model as
// tournamentData.ts: a service client (cookie-free, bypasses RLS — REQUIRED to
// read every league server-side) inside unstable_cache, so hundreds of
// concurrent viewers cost one DB read per 5-minute window instead of each
// hitting Postgres.
export type GlobalRank = {
  user_id: string;
  name: string;
  avatarUrl: string | null;
  favTeamId: number | null;
  best: number;
};

export const getCachedGlobalRankings = unstable_cache(
  async (): Promise<GlobalRank[]> => {
    const s = createServiceClient();

    const { data: rows } = await s.from("scores").select("user_id, total_points");
    if (!rows || rows.length === 0) return [];

    // Best (max) total per player.
    const bestByUser = new Map<string, number>();
    for (const r of rows) {
      const total = r.total_points ?? 0;
      const prev = bestByUser.get(r.user_id);
      if (prev === undefined || total > prev) bestByUser.set(r.user_id, total);
    }

    const ids = [...bestByUser.keys()];
    if (ids.length === 0) return [];

    const { data: profiles } = await s
      .from("profiles")
      .select("id, display_name, team_name, avatar_url, favorite_team_id, is_guest")
      .in("id", ids);

    const profById = new Map(
      (profiles ?? []).map((p) => [p.id as string, p]),
    );

    const ranks: GlobalRank[] = ids
      .map((id) => {
        const p = profById.get(id);
        // Guests are hidden from the worldwide board until they create an account.
        if (p?.is_guest) return null;
        return {
          user_id: id,
          name: p?.team_name || p?.display_name || "Player",
          // Generic avatars only on the worldwide board — never surface a
          // user-uploaded image to a global/stranger audience (kid-safe). The
          // curated favourite-team crest still shows.
          avatarUrl: null as string | null,
          favTeamId: p?.favorite_team_id ?? null,
          best: bestByUser.get(id) ?? 0,
        };
      })
      .filter((r): r is GlobalRank => r !== null);

    ranks.sort((a, b) => b.best - a.best);
    return ranks;
  },
  ["global-rankings"],
  { revalidate: 300 },
);
