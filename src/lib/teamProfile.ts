import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { TOURNAMENT_TAG } from "@/lib/tournamentData";

// One national team's profile + the shape it's expected to line up in, for the
// tap-to-open team card. Cached per id (unstable_cache keys include the call
// arguments) and tagged so the sync route's revalidateTag(TOURNAMENT_TAG)
// refreshes it after a sync. Mirrors playerProfile.ts.
//
// `lineup.xi` is the same [{player_id,name,number,pos,grid}] payload that
// TeamFormation / Pitch consume, so it can be handed straight to <TeamFormation>.
export type TeamLineupData = { formation: string | null; xi: unknown[] };

export type TeamProfile = {
  id: number;
  name: string;
  code: string | null;
  logo_url: string | null;
  group_label: string | null;
  fifa_rank: number | null;
  // The lineup we're showing. `official` is true when it's the real lineup of an
  // upcoming/live match (drops ~1h before kickoff); false when it's the
  // projected XI carried over from the team's last fixture (team_lineups).
  lineup: (TeamLineupData & { official: boolean }) | null;
};

const loadTeam = unstable_cache(
  async (id: number): Promise<TeamProfile | null> => {
    const s = createServiceClient();
    const { data: t } = await s
      .from("teams")
      .select("id, name, code, logo_url, group_label, fifa_rank")
      .eq("id", id)
      .maybeSingle();
    if (!t) return null;

    // Prefer the OFFICIAL lineup of this team's next/live (not-yet-finished)
    // match: find the soonest such fixture this team is in, then its
    // match_lineups row. Fall back to the projected XI in team_lineups.
    let lineup: TeamProfile["lineup"] = null;

    const { data: nextMatch } = await s
      .from("matches")
      .select("id, kickoff_at")
      .neq("status", "finished")
      .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextMatch?.id != null) {
      const { data: ml } = await s
        .from("match_lineups")
        .select("formation, xi")
        .eq("match_id", nextMatch.id)
        .eq("team_id", id)
        .maybeSingle();
      const xi = (ml?.xi as unknown[] | null) ?? null;
      if (xi && xi.length) {
        lineup = { formation: ml?.formation ?? null, xi, official: true };
      }
    }

    if (!lineup) {
      const { data: tl } = await s
        .from("team_lineups")
        .select("formation, xi")
        .eq("team_id", id)
        .maybeSingle();
      const xi = (tl?.xi as unknown[] | null) ?? null;
      if (xi && xi.length) {
        lineup = { formation: tl?.formation ?? null, xi, official: false };
      }
    }

    return {
      id: t.id,
      name: t.name,
      code: t.code,
      logo_url: t.logo_url,
      group_label: t.group_label,
      fifa_rank: t.fifa_rank,
      lineup,
    };
  },
  ["team-profile"],
  { tags: [TOURNAMENT_TAG], revalidate: 300 },
);

export function getCachedTeam(id: number) {
  return loadTeam(id);
}
