// Live group-stage standings — a DISPLAY table that updates as games play, unlike
// `computeGroupTables` (scoring-core) which only emits a group once every match in
// it is finished. This one tallies whatever has been played so far and always
// lists all four teams (a team with 0 games shows zeros), so the Tournament hub
// can render the 12 group tables from kickoff through to the final whistle.
//
// Ranking follows the FIFA 2026 primary criteria — points → goal difference →
// goals for — then FIFA ranking → team id as deterministic fallbacks. (The full
// head-to-head cascade only changes order in exact GD+GF ties and is reserved for
// the authoritative bracket order in scoring-core.)

export interface StandingMatch {
  stage: string;
  group_label: string | null;
  status: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_goals: number | null;
  away_goals: number | null;
}

export interface StandingTeam {
  id: number;
  group_label: string | null;
  fifa_rank?: number | null;
}

export interface StandingRow {
  teamId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export interface GroupStandings {
  group: string;
  rows: StandingRow[]; // ranked 1st → 4th
  complete: boolean; // every group match finished → top 2 are decided
}

const blank = (teamId: number): StandingRow => ({
  teamId,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  gd: 0,
  pts: 0,
});

// Build the 12 (or fewer) group tables from teams + their finished group matches.
// Teams are grouped by `group_label`; only group-stage, finished matches with both
// scores present are counted. Groups are returned in label order (A, B, … L).
export function liveGroupStandings(
  matches: StandingMatch[],
  teams: StandingTeam[],
  fifaRank: Map<number, number> = new Map(),
): GroupStandings[] {
  // Seed each group's rows from the team list so every team appears, even before
  // they've kicked a ball.
  const rowsByGroup = new Map<string, Map<number, StandingRow>>();
  for (const t of teams) {
    if (!t.group_label) continue;
    if (!rowsByGroup.has(t.group_label)) rowsByGroup.set(t.group_label, new Map());
    rowsByGroup.get(t.group_label)!.set(t.id, blank(t.id));
    if (t.fifa_rank != null && !fifaRank.has(t.id)) fifaRank.set(t.id, t.fifa_rank);
  }

  // Track per-group match completeness (all group fixtures finished → table final).
  const total = new Map<string, number>();
  const done = new Map<string, number>();

  for (const m of matches) {
    if (m.stage !== "group" || !m.group_label) continue;
    total.set(m.group_label, (total.get(m.group_label) ?? 0) + 1);
    if (m.status === "finished") done.set(m.group_label, (done.get(m.group_label) ?? 0) + 1);

    if (m.status !== "finished" || m.home_goals == null || m.away_goals == null) continue;
    if (m.home_team_id == null || m.away_team_id == null) continue;

    // A finished match might reference a team the seed list missed (e.g. group
    // labels not yet synced) — create the group/rows on demand so nothing is lost.
    if (!rowsByGroup.has(m.group_label)) rowsByGroup.set(m.group_label, new Map());
    const g = rowsByGroup.get(m.group_label)!;
    const h = g.get(m.home_team_id) ?? (g.set(m.home_team_id, blank(m.home_team_id)), g.get(m.home_team_id)!);
    const a = g.get(m.away_team_id) ?? (g.set(m.away_team_id, blank(m.away_team_id)), g.get(m.away_team_id)!);

    const hg = m.home_goals;
    const ag = m.away_goals;
    h.played++;
    a.played++;
    h.gf += hg;
    h.ga += ag;
    a.gf += ag;
    a.ga += hg;
    if (hg > ag) {
      h.won++;
      a.lost++;
      h.pts += 3;
    } else if (hg < ag) {
      a.won++;
      h.lost++;
      a.pts += 3;
    } else {
      h.drawn++;
      a.drawn++;
      h.pts += 1;
      a.pts += 1;
    }
  }

  const rank = (id: number) => fifaRank.get(id) ?? Number.MAX_SAFE_INTEGER;

  const out: GroupStandings[] = [];
  for (const [group, rowMap] of rowsByGroup) {
    for (const row of rowMap.values()) row.gd = row.gf - row.ga;
    const rows = [...rowMap.values()].sort(
      (x, y) =>
        y.pts - x.pts ||
        y.gd - x.gd ||
        y.gf - x.gf ||
        rank(x.teamId) - rank(y.teamId) ||
        x.teamId - y.teamId,
    );
    const complete = (total.get(group) ?? 0) > 0 && (done.get(group) ?? 0) === total.get(group);
    out.push({ group, rows, complete });
  }
  out.sort((a, b) => a.group.localeCompare(b.group));
  return out;
}
