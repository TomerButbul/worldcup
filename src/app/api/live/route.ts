import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";

// No CDN cache — stale-while-revalidate caused the widget to serve an old
// empty response for 60-90s after kickoff when the DB first flipped to live.
// The route only reads our own matches table (no external API call) so each
// DB hit is cheap; the 45s client poll provides its own natural throttle.
export const dynamic = "force-dynamic";

// How long a finished match lingers in the widget after the final whistle. A result
// is only useful as a brief "catch the score I just missed" glance; after this it's
// stale news (still on the match/tournament pages) and just clutter during a busy
// slate. 12 min comfortably spans the ~15s edge cache + 45s client poll, so a result
// is guaranteed to land and persist for several poll cycles before it clears.
const FINISHED_LINGER_MS = 12 * 60 * 1000;

// At most this many finished games are surfaced (most-recently-finished first). On a
// heavy day several can end close together; capping keeps live games from being pushed
// out and stops the panel from dominating a phone screen. Live games are never capped.
const MAX_FINISHED = 3;

type MiniTeam = { id: number; name: string; code: string | null; logo_url: string | null } | null;

// Lightweight live-scores feed for the floating widget — reads our already-synced
// `matches` table (no API-Football call), so it's cheap to poll. Public data.
export async function GET() {
  const supabase = createServiceClient();
  // Live games, PLUS any that finished within FINISHED_LINGER_MS so a match's final
  // score lingers briefly when it ends (instead of vanishing on the whistle).
  // Finished fixtures stop being re-synced, so their updated_at ≈ the final whistle.
  const cutoff = new Date(Date.now() - FINISHED_LINGER_MS).toISOString();
  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, status, home_team_id, away_team_id, home_goals, away_goals, elapsed, kickoff_at, updated_at")
    .or(`status.eq.live,and(status.eq.finished,updated_at.gte.${cutoff})`)
    .lt("id", 9_000_000) // exclude sentinel/sim matches (id >= 9_000_000)
    .order("kickoff_at");

  const teams = await getCachedTeams();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const mini = (id: number | null | undefined): MiniTeam => {
    if (id == null) return null;
    const t = teamById.get(id);
    return t ? { id: t.id, name: t.name, code: t.code, logo_url: t.logo_url } : null;
  };

  const rows = (matches ?? []).map((m) => {
    const done = m.status === "finished";
    return {
      game: {
        id: m.id,
        stage: m.stage as string,
        done,
        elapsed: (m as { elapsed?: number | null }).elapsed ?? null,
        home: mini(m.home_team_id),
        away: mini(m.away_team_id),
        homeGoals: m.home_goals ?? 0,
        awayGoals: m.away_goals ?? 0,
      },
      // Sort key only — how recently it ended. updated_at ≈ the final whistle for
      // finished fixtures (they stop being re-synced once over).
      finishedAt: done ? Date.parse((m as { updated_at?: string | null }).updated_at ?? "") || 0 : 0,
    };
  });

  // Live games first — by elapsed desc so the match nearest full-time leads (kickoff
  // already broke ties in the query; this also keeps half-time games, where elapsed
  // stalls or goes null, grouped sensibly). Then finished, most-recently-ended first,
  // capped to MAX_FINISHED so a busy slate never pushes the live games out of view.
  const live = rows
    .filter((r) => !r.game.done)
    .sort((a, b) => (b.game.elapsed ?? -1) - (a.game.elapsed ?? -1))
    .map((r) => r.game);
  const finished = rows
    .filter((r) => r.game.done)
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, MAX_FINISHED)
    .map((r) => r.game);

  const games = [...live, ...finished];

  // `games[]` keeps the exact shape the widget consumes (id, stage, done, elapsed,
  // home, away, homeGoals, awayGoals). The extra counts are additive and let the
  // widget label "N LIVE" and note when finished results were capped.
  return NextResponse.json({ games, liveCount: live.length, finishedShown: finished.length });
}
