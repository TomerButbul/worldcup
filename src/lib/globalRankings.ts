import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

// Worldwide leaderboard across every league. Predictions are per-league, so a
// player can hold different totals in different leagues; we rank each player by
// their single best score (their top performance — not a sum, which would just
// reward joining many leagues). We keep all three crowns — Total, Upfront and
// Live — so the board can switch between them. Same caching model as
// tournamentData.ts: a service client (cookie-free, bypasses RLS — REQUIRED to
// read every league server-side) inside unstable_cache, so hundreds of
// concurrent viewers cost one DB read per 5-minute window.
export type GlobalRank = {
  user_id: string;
  name: string;
  avatarUrl: string | null;
  favTeamId: number | null;
  total: number;
  upfront: number;
  live: number;
};

// Curated, server-authored avatars (fixed /public assets, e.g. the AI-mascot art)
// are safe to show to a global/stranger audience. User-UPLOADED images never are,
// so they stay hidden on the worldwide board (kid-safe) — only this allow-list passes.
const isCuratedAvatar = (u: string | null | undefined): u is string =>
  !!u && u.startsWith("/mascots/");

export const getCachedGlobalRankings = unstable_cache(
  async (): Promise<GlobalRank[]> => {
    const s = createServiceClient();

    const { data: rows } = await s
      .from("scores")
      .select("user_id, upfront_points, live_points, total_points");
    if (!rows || rows.length === 0) return [];

    // Best (max) of each crown per player, taken independently across their leagues.
    const best = new Map<string, { total: number; upfront: number; live: number }>();
    for (const r of rows) {
      const cur = best.get(r.user_id) ?? { total: 0, upfront: 0, live: 0 };
      cur.total = Math.max(cur.total, r.total_points ?? 0);
      cur.upfront = Math.max(cur.upfront, r.upfront_points ?? 0);
      cur.live = Math.max(cur.live, r.live_points ?? 0);
      best.set(r.user_id, cur);
    }

    const ids = [...best.keys()];
    if (ids.length === 0) return [];

    const { data: profiles } = await s
      .from("profiles")
      .select("id, display_name, team_name, avatar_url, favorite_team_id, is_guest")
      .in("id", ids);

    const profById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

    const ranks: GlobalRank[] = ids
      .map((id) => {
        const p = profById.get(id);
        // Guests are hidden from the worldwide board until they create an account.
        if (p?.is_guest) return null;
        const b = best.get(id)!;
        const av = p?.avatar_url;
        return {
          user_id: id,
          name: p?.team_name || p?.display_name || "Player",
          // Never surface a user-uploaded image to a global/stranger audience
          // (kid-safe) — but curated mascot art (a fixed /public asset) is fine.
          avatarUrl: isCuratedAvatar(av) ? av : null,
          favTeamId: p?.favorite_team_id ?? null,
          total: b.total,
          upfront: b.upfront,
          live: b.live,
        };
      })
      .filter((r): r is GlobalRank => r !== null);

    // Default order is by Total; the board re-sorts client-side per the chosen crown.
    ranks.sort((a, b) => b.total - a.total);
    return ranks;
  },
  ["global-rankings"],
  { revalidate: 300 },
);
