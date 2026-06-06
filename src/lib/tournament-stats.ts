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
