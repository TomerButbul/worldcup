import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { TOURNAMENT_TAG } from "@/lib/tournamentData";
import { fetchPlayerStats } from "@/lib/apiFootball";

// One football player's profile + tournament tallies, for the tap-to-open card.
// Cached per id (unstable_cache keys include the call arguments) and tagged so
// the sync route's revalidateTag(TOURNAMENT_TAG) refreshes stats after a sync.
export type PlayerProfile = {
  id: number;
  name: string;
  position: string | null;
  number: number | null;
  age: number | null;
  nationality: string | null;
  birth_date: string | null;
  photo_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  team: { id: number; name: string; logo_url: string | null; code: string | null } | null;
  stats: {
    apps: number;
    minutes: number;
    goals: number;
    assists: number;
    yellow: number;
    red: number;
    saves: number;
    cleanSheets: number;
  };
};

const loadPlayer = unstable_cache(
  async (id: number): Promise<PlayerProfile | null> => {
    const s = createServiceClient();
    const { data: p } = await s
      .from("players")
      .select("id, team_id, name, position, number, age, photo_url, height_cm, weight_kg, nationality, birth_date")
      .eq("id", id)
      .maybeSingle();
    if (!p) return null;

    const [goalsRes, cardsRes, teamRes, statsRes] = await Promise.all([
      s.from("match_goals").select("goals").eq("player_id", id),
      s.from("match_cards").select("type").eq("player_id", id),
      p.team_id != null
        ? s.from("teams").select("id, name, logo_url, code").eq("id", p.team_id).maybeSingle()
        : Promise.resolve({ data: null as PlayerProfile["team"] }),
      s.from("match_player_stats").select("match_id, minutes, assists, saves").eq("player_id", id),
    ]);

    const goals = (goalsRes.data ?? []).reduce((n, r) => n + (r.goals ?? 0), 0);
    const cards = cardsRes.data ?? [];
    const yellow = cards.filter((c) => c.type === "yellow").length;
    const red = cards.filter((c) => c.type === "red").length;
    const appRows = statsRes.data ?? [];
    const apps = appRows.length; // one row per match the player appeared in
    const minutes = appRows.reduce((n, r) => n + (r.minutes ?? 0), 0);
    const assists = appRows.reduce((n, r) => n + (r.assists ?? 0), 0);
    const saves = appRows.reduce((n, r) => n + (r.saves ?? 0), 0);

    // Clean sheets: of the finished matches the player actually played in
    // (minutes > 0), how many did THEIR team finish conceding 0 goals. The
    // player's team is p.team_id; conceded = the OTHER side's goals. Unplayed or
    // still-ongoing matches (and null scores) don't count.
    let cleanSheets = 0;
    const matchIds = appRows.map((r) => r.match_id).filter((mid): mid is number => mid != null);
    if (p.team_id != null && matchIds.length) {
      const { data: matchRows } = await s
        .from("matches")
        .select("id, home_team_id, away_team_id, home_goals, away_goals, status")
        .in("id", matchIds);
      const byId = new Map((matchRows ?? []).map((m) => [m.id, m]));
      for (const r of appRows) {
        if ((r.minutes ?? 0) <= 0 || r.match_id == null) continue;
        const m = byId.get(r.match_id);
        if (!m || m.status !== "finished") continue;
        const conceded = p.team_id === m.home_team_id ? m.away_goals : m.home_goals;
        if (conceded === 0) cleanSheets += 1;
      }
    }

    return {
      id: p.id,
      name: p.name,
      position: p.position,
      number: p.number,
      age: p.age,
      nationality: p.nationality,
      birth_date: p.birth_date,
      photo_url: p.photo_url,
      height_cm: p.height_cm,
      weight_kg: p.weight_kg,
      team: (teamRes.data as PlayerProfile["team"]) ?? null,
      stats: { apps, minutes, goals, assists, yellow, red, saves, cleanSheets },
    };
  },
  ["player-profile"],
  { tags: [TOURNAMENT_TAG], revalidate: 300 },
);

export function getCachedPlayer(id: number) {
  return loadPlayer(id);
}

// Club form for the season — lazy, per player, cached 24h (fires only when a
// card opens, so near-zero quota cost). National-team entries are excluded so
// the numbers are club apps/goals/assists + an appearance-weighted rating.
// Best-effort: returns nulls if the feed has nothing or errors.
export type ClubForm = {
  name: string | null;
  league: string | null;
  apps: number;
  goals: number;
  assists: number;
  rating: number | null;
};

const CLUB_SEASON = 2025; // the 2025-26 club season

const loadClub = unstable_cache(
  async (
    id: number,
    nationalTeamId: number | null,
  ): Promise<{ injured: boolean | null; club: ClubForm | null }> => {
    try {
      const resp = (await fetchPlayerStats(id, CLUB_SEASON))[0];
      if (!resp) return { injured: null, club: null };
      let apps = 0;
      let goals = 0;
      let assists = 0;
      let ratingSum = 0;
      let ratingApps = 0;
      let topApps = -1;
      let name: string | null = null;
      let league: string | null = null;
      for (const st of resp.statistics ?? []) {
        if (st.team?.id == null || st.team.id === nationalTeamId) continue; // skip country
        const a = st.games?.appearences ?? 0;
        apps += a;
        goals += st.goals?.total ?? 0;
        assists += st.goals?.assists ?? 0;
        const r = parseFloat(st.games?.rating ?? "");
        if (Number.isFinite(r) && a > 0) {
          ratingSum += r * a;
          ratingApps += a;
        }
        // The competition with the most apps = the primary club + its league.
        if (a > topApps) {
          topApps = a;
          name = st.team?.name ?? null;
          league = st.league?.name ?? null;
        }
      }
      const rating = ratingApps > 0 ? Math.round((ratingSum / ratingApps) * 10) / 10 : null;
      return {
        injured: resp.player?.injured ?? null,
        club: apps > 0 ? { name, league, apps, goals, assists, rating } : null,
      };
    } catch {
      return { injured: null, club: null };
    }
  },
  ["club-form"],
  { revalidate: 86400 },
);

export function getCachedClubStats(id: number, nationalTeamId: number | null) {
  return loadClub(id, nationalTeamId);
}
