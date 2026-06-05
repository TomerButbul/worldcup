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
        .select("id, team_id, name, position, number, in_squad, ovr")
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

// api-sports team id → ISO 3166-1 alpha-2 (flagcdn) for the bunting. Mapped by
// id (stable) not code, because api-sports codes collide (AUS = Australia AND
// Austria) and some are blank (Curaçao). flagcdn serves clean, edge-to-edge,
// uniformly 4:3 flags — so every pennant is the same size and undistorted,
// unlike the padded/variable team badge images.
const TEAM_ISO: Record<number, string> = {
  1532: "dz", 26: "ar", 20: "au", 775: "at", 1: "be", 1113: "ba", 6: "br",
  5529: "ca", 1533: "cv", 8: "co", 1508: "cd", 3: "hr", 5530: "cw", 770: "cz",
  2382: "ec", 32: "eg", 10: "gb-eng", 2: "fr", 25: "de", 1504: "gh", 2386: "ht",
  22: "ir", 1567: "iq", 1501: "ci", 12: "jp", 1548: "jo", 16: "mx", 31: "ma",
  1118: "nl", 4673: "nz", 1090: "no", 11: "pa", 2380: "py", 27: "pt", 1569: "qa",
  23: "sa", 1108: "gb-sct", 13: "sn", 1531: "za", 17: "kr", 9: "es", 5: "se",
  15: "ch", 28: "tn", 777: "tr", 7: "uy", 2384: "us", 1568: "uz",
};

// The teams playing in the upcoming matchday — for the decorative top flag
// bunting. A small, meaningful set (no need to cycle the whole field). Cached
// (service client, cookie-free) and refreshed every 30 min as fixtures pass.
export const getCachedMatchdayFlags = unstable_cache(
  async (): Promise<{ id: number; name: string; iso: string | null }[]> => {
    const s = createServiceClient();
    const { data: up } = await s
      .from("matches")
      .select("home_team_id, away_team_id, kickoff_at")
      .gt("kickoff_at", new Date().toISOString())
      .lt("id", 9_000_000) // hide sentinel test fixtures
      .order("kickoff_at")
      .limit(10);
    const ids: number[] = [];
    for (const m of up ?? []) {
      for (const id of [m.home_team_id, m.away_team_id]) {
        if (id != null && !ids.includes(id)) ids.push(id);
      }
    }
    const top = ids.slice(0, 12);
    if (!top.length) return [];
    const { data: teams } = await s.from("teams").select("id, name").in("id", top);
    const nameById = new Map((teams ?? []).map((t) => [t.id, t.name as string]));
    return top.map((id) => ({ id, name: nameById.get(id) ?? "", iso: TEAM_ISO[id] ?? null }));
  },
  ["matchday-flags-v2"],
  { tags: [TOURNAMENT_TAG], revalidate: 1800 },
);
