// Draft side-game scoring (see docs/.../2026-06-02-draft-scoring-design.md).
// Each pot is its own competition; a final total is bragging-rights only.
import { DRAFT_POTS, type Pot } from "@/lib/draft";

// Points a drafted team earns by how far it advances. Champion overrides.
export const DRAFT_STAGE_POINTS: Record<string, number> = {
  round_of_32: 1,
  round_of_16: 2,
  quarter: 4,
  semi: 6,
  final: 8,
};
export const DRAFT_CHAMPION_POINTS = 12;

// The draft pool uses its own team names; map the few that differ from the
// synced `teams.name` (normalized, lower-cased).
export const DRAFT_TEAM_ALIASES: Record<string, string> = {
  "côte d'ivoire": "ivory coast",
  czechia: "czech republic",
  "cape verde": "cape verde islands",
  "dr congo": "congo dr",
};

const norm = (s: string) => s.trim().toLowerCase();

// Resolve each draft-pool team name to a synced team id (exact match + aliases).
export function draftTeamIds(teams: { id: number; name: string }[]): Map<string, number> {
  const byName = new Map<string, number>();
  for (const t of teams) byName.set(norm(t.name), t.id);
  const out = new Map<string, number>(); // draft team name -> synced id
  for (const pot of [1, 2, 3] as Pot[]) {
    for (const team of DRAFT_POTS[pot]) {
      const key = norm(team.name);
      const id = byName.get(key) ?? byName.get(DRAFT_TEAM_ALIASES[key] ?? "");
      if (id != null) out.set(team.name, id);
    }
  }
  return out;
}

// Furthest stage a team reached → points. Group exit = 0, champion = 12.
export function teamProgressPoints(
  teamId: number | null | undefined,
  reachedByStage: Record<string, Set<number>>,
  champion: number | null,
): number {
  if (teamId == null) return 0;
  if (champion != null && teamId === champion) return DRAFT_CHAMPION_POINTS;
  let pts = 0;
  for (const [stage, p] of Object.entries(DRAFT_STAGE_POINTS)) {
    if (reachedByStage[stage]?.has(teamId)) pts = Math.max(pts, p);
  }
  return pts;
}

export interface DraftPick {
  user_id: string;
  pot: number;
  slot: number;
}
export interface StandingRow {
  userId: string;
  points: number;
}

// Per-pot standings (the real competitions) + a bragging-rights total.
// `pointsForPick` resolves a (pot, slot) pick to its team's progress points.
export function draftScores(
  picks: DraftPick[],
  pointsForPick: (pot: number, slot: number) => number,
): { perPot: Record<number, StandingRow[]>; totals: StandingRow[] } {
  const perPot: Record<number, StandingRow[]> = { 1: [], 2: [], 3: [] };
  const totalByUser = new Map<string, number>();
  for (const p of picks) {
    const pts = pointsForPick(p.pot, p.slot);
    perPot[p.pot]?.push({ userId: p.user_id, points: pts });
    totalByUser.set(p.user_id, (totalByUser.get(p.user_id) ?? 0) + pts);
  }
  const byPointsDesc = (a: StandingRow, b: StandingRow) =>
    b.points - a.points || a.userId.localeCompare(b.userId);
  for (const pot of [1, 2, 3]) perPot[pot].sort(byPointsDesc);
  const totals = [...totalByUser.entries()]
    .map(([userId, points]) => ({ userId, points }))
    .sort(byPointsDesc);
  return { perPot, totals };
}
