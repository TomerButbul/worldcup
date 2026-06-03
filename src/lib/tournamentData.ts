import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

// Shared, identical-for-every-user tournament data. Using the previous caching
// model (unstable_cache + revalidateTag) — NOT the Cache Components model, which
// would force the whole app onto PPR/Suspense. Hundreds of concurrent viewers
// now read these once per window instead of each hitting Postgres; the sync
// route calls revalidateTag(TOURNAMENT_TAG) whenever it changes teams/players.
// A service client keeps the cache entry user-independent (no cookies in scope).
export const TOURNAMENT_TAG = "tournament";

export const getCachedTeams = unstable_cache(
  async () => {
    const s = createServiceClient();
    const { data } = await s
      .from("teams")
      .select("id, name, code, logo_url, group_label, fifa_rank")
      .order("name");
    return data ?? [];
  },
  ["teams"],
  { tags: [TOURNAMENT_TAG], revalidate: 300 },
);

export const getCachedPlayers = unstable_cache(
  async () => {
    const s = createServiceClient();
    // Paginate: PostgREST caps each response at 1000 rows and there are >1000 WC
    // squad players — without paging, whole teams' higher-id players vanish from
    // the scorer picker. We only need squad members (in_squad), with position.
    type Row = {
      id: number;
      team_id: number | null;
      name: string;
      position: string | null;
      number: number | null;
      in_squad: boolean;
    };
    const out: Row[] = [];
    for (let from = 0; from < 10000; from += 1000) {
      const { data } = await s
        .from("players")
        .select("id, team_id, name, position, number, in_squad")
        .eq("in_squad", true)
        .order("id")
        .range(from, from + 999);
      if (!data?.length) break;
      out.push(...(data as Row[]));
      if (data.length < 1000) break;
    }
    return out;
  },
  ["players-v3"], // bump: paginated, in_squad-only, + position/number
  { tags: [TOURNAMENT_TAG], revalidate: 300 },
);
