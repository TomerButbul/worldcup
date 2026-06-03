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
    const { data } = await s.from("players").select("id, team_id, name").order("id");
    return data ?? [];
  },
  ["players"],
  { tags: [TOURNAMENT_TAG], revalidate: 300 },
);
