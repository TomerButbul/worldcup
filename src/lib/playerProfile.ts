import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { TOURNAMENT_TAG } from "@/lib/tournamentData";

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
  photo_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  team: { id: number; name: string; logo_url: string | null; code: string | null } | null;
  stats: { goals: number; yellow: number; red: number };
};

const loadPlayer = unstable_cache(
  async (id: number): Promise<PlayerProfile | null> => {
    const s = createServiceClient();
    const { data: p } = await s
      .from("players")
      .select("id, team_id, name, position, number, age, photo_url, height_cm, weight_kg, nationality")
      .eq("id", id)
      .maybeSingle();
    if (!p) return null;

    const [goalsRes, cardsRes, teamRes] = await Promise.all([
      s.from("match_goals").select("goals").eq("player_id", id),
      s.from("match_cards").select("type").eq("player_id", id),
      p.team_id != null
        ? s.from("teams").select("id, name, logo_url, code").eq("id", p.team_id).maybeSingle()
        : Promise.resolve({ data: null as PlayerProfile["team"] }),
    ]);

    const goals = (goalsRes.data ?? []).reduce((n, r) => n + (r.goals ?? 0), 0);
    const cards = cardsRes.data ?? [];
    const yellow = cards.filter((c) => c.type === "yellow").length;
    const red = cards.filter((c) => c.type === "red").length;

    return {
      id: p.id,
      name: p.name,
      position: p.position,
      number: p.number,
      age: p.age,
      nationality: p.nationality,
      photo_url: p.photo_url,
      height_cm: p.height_cm,
      weight_kg: p.weight_kg,
      team: (teamRes.data as PlayerProfile["team"]) ?? null,
      stats: { goals, yellow, red },
    };
  },
  ["player-profile"],
  { tags: [TOURNAMENT_TAG], revalidate: 300 },
);

export function getCachedPlayer(id: number) {
  return loadPlayer(id);
}
