// Tournament goal/assist leaderboards. Pure aggregation: sum each player's goals
// (match_goals.goals) or assists (match_player_stats.assists) across every real
// fixture, drop the zeros, and rank by count (ties broken by player id so the
// order is stable). The page joins the player id back to name/team/photo.

export interface GoalRow {
  player_id: number;
  goals: number | null;
}

export interface AssistRow {
  player_id: number;
  assists: number | null;
}

// A keeper's appearance in one match (match_player_stats). minutes gates whether
// the clean sheet "counts" — a keeper who didn't play doesn't earn one.
export interface AppearanceRow {
  player_id: number;
  match_id: number | null;
  minutes: number | null;
}

// Just enough of a match to decide a clean sheet: who played whom, the score,
// and whether it's actually finished (live/scheduled games never count).
export interface MatchResult {
  home_team_id: number | null;
  away_team_id: number | null;
  home_goals: number | null;
  away_goals: number | null;
  status: string | null;
}

export interface LeaderRow {
  playerId: number;
  count: number;
}

function rank(totals: Map<number, number>): LeaderRow[] {
  return [...totals.entries()]
    .filter(([, count]) => count > 0)
    .map(([playerId, count]) => ({ playerId, count }))
    .sort((a, b) => b.count - a.count || a.playerId - b.playerId);
}

export function topScorers(rows: GoalRow[]): LeaderRow[] {
  const totals = new Map<number, number>();
  for (const r of rows) {
    if (r.player_id == null) continue;
    totals.set(r.player_id, (totals.get(r.player_id) ?? 0) + (r.goals ?? 0));
  }
  return rank(totals);
}

export function topAssists(rows: AssistRow[]): LeaderRow[] {
  const totals = new Map<number, number>();
  for (const r of rows) {
    if (r.player_id == null) continue;
    totals.set(r.player_id, (totals.get(r.player_id) ?? 0) + (r.assists ?? 0));
  }
  return rank(totals);
}

// Golden Glove leaderboard: per keeper, how many FINISHED matches they actually
// played in (minutes > 0) where their team conceded nothing. `teamOf` doubles as
// the eligibility set — only players present in it are counted (the page passes
// goalkeepers only), so this never tallies an outfield player's clean sheets.
// Mirrors the per-player rule in playerProfile.ts so the card and the board agree.
export function topCleanSheets(
  apps: AppearanceRow[],
  teamOf: Map<number, number | null>,
  matchById: Map<number, MatchResult>,
): LeaderRow[] {
  const totals = new Map<number, number>();
  for (const a of apps) {
    if (a.player_id == null || a.match_id == null) continue;
    if ((a.minutes ?? 0) <= 0) continue; // didn't play → no clean sheet
    if (!teamOf.has(a.player_id)) continue; // not an eligible keeper
    const teamId = teamOf.get(a.player_id) ?? null;
    if (teamId == null) continue;
    const m = matchById.get(a.match_id);
    if (!m || m.status !== "finished") continue;
    // The keeper must be one of the two sides; conceded = the OTHER side's goals.
    const conceded =
      teamId === m.home_team_id ? m.away_goals : teamId === m.away_team_id ? m.home_goals : null;
    if (conceded === 0) totals.set(a.player_id, (totals.get(a.player_id) ?? 0) + 1);
  }
  return rank(totals);
}
