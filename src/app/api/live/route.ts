import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";

export const dynamic = "force-dynamic";

type MiniTeam = { id: number; name: string; code: string | null; logo_url: string | null } | null;

// Lightweight live-scores feed for the floating widget — reads our already-synced
// `matches` table (no API-Football call), so it's cheap to poll. Public data.
export async function GET() {
  const supabase = createServiceClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, home_team_id, away_team_id, home_goals, away_goals, elapsed, kickoff_at")
    .eq("status", "live")
    .order("kickoff_at");

  const teams = await getCachedTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const mini = (id: number | null | undefined): MiniTeam => {
    if (id == null) return null;
    const t = teamById.get(id);
    return t ? { id: t.id, name: t.name, code: t.code, logo_url: t.logo_url } : null;
  };

  const games = (matches ?? []).map((m) => ({
    id: m.id,
    stage: m.stage as string,
    elapsed: (m as { elapsed?: number | null }).elapsed ?? null,
    home: mini(m.home_team_id),
    away: mini(m.away_team_id),
    homeGoals: m.home_goals ?? 0,
    awayGoals: m.away_goals ?? 0,
  }));

  return NextResponse.json({ games }, { headers: { "Cache-Control": "no-store" } });
}
