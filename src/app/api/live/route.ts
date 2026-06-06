import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";

// Edge-cache the public live feed for a short window so a match-day crowd polling
// every 45s collapses to ~one DB read per 15s globally (served from Vercel's CDN)
// instead of one read per viewer. The cookie-free service client makes the response
// identical for everyone, so it's safe to share-cache; data is at most ~15s staler
// than the ~60s sync — fine for an ambient scores pill. Next emits the matching
// `s-maxage=15, stale-while-revalidate` Cache-Control for the CDN from this.
export const revalidate = 15;

type MiniTeam = { id: number; name: string; code: string | null; logo_url: string | null } | null;

// Lightweight live-scores feed for the floating widget — reads our already-synced
// `matches` table (no API-Football call), so it's cheap to poll. Public data.
export async function GET() {
  const supabase = createServiceClient();
  // Live games, PLUS any that finished in the last 30 min so a match's final score
  // lingers in the widget when it ends (instead of the game vanishing on the whistle).
  // Finished fixtures stop being re-synced, so their updated_at ≈ the final whistle.
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, status, home_team_id, away_team_id, home_goals, away_goals, elapsed, kickoff_at, updated_at")
    .or(`status.eq.live,and(status.eq.finished,updated_at.gte.${cutoff})`)
    .order("kickoff_at");

  const teams = await getCachedTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const mini = (id: number | null | undefined): MiniTeam => {
    if (id == null) return null;
    const t = teamById.get(id);
    return t ? { id: t.id, name: t.name, code: t.code, logo_url: t.logo_url } : null;
  };

  // Live first, then just-finished — both ordered by kickoff so the slate reads
  // in the natural order.
  const games = (matches ?? [])
    .map((m) => ({
      id: m.id,
      stage: m.stage as string,
      done: m.status === "finished",
      elapsed: (m as { elapsed?: number | null }).elapsed ?? null,
      home: mini(m.home_team_id),
      away: mini(m.away_team_id),
      homeGoals: m.home_goals ?? 0,
      awayGoals: m.away_goals ?? 0,
    }))
    .sort((a, b) => Number(a.done) - Number(b.done));

  return NextResponse.json({ games });
}
