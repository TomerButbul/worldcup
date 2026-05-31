import type { ScoringConfig, MatchStage } from "@/lib/types";

// Pure scoring logic — no Supabase, fully unit-testable.

export interface MatchRow {
  id: number;
  stage: MatchStage;
  group_label: string | null;
  status: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_goals: number | null;
  away_goals: number | null;
}

export interface ActualOutcomes {
  groupStandings: Record<string, number[]>;
  advancers: Record<string, Set<number>>;
  champion: number | null;
  results: Map<number, { home: number; away: number; scorers: Set<number> }>;
}

export interface BracketPick {
  group_standings: Record<string, number[]>;
  knockout: Record<string, number[]>;
  champion_team_id: number | null;
}

export interface MatchPick {
  match_id: number;
  home_goals: number;
  away_goals: number;
  scorer_ids: number[];
}

export const ADVANCE_KEYS: Record<string, keyof ScoringConfig["upfront"]> = {
  round_of_16: "advance_round_of_16",
  quarter: "advance_quarter",
  semi: "advance_semi",
  final: "advance_final",
};

export function computeGroupStandings(matches: MatchRow[]): Record<string, number[]> {
  const byGroup = new Map<string, MatchRow[]>();
  for (const m of matches) {
    if (m.stage !== "group" || !m.group_label) continue;
    if (!byGroup.has(m.group_label)) byGroup.set(m.group_label, []);
    byGroup.get(m.group_label)!.push(m);
  }

  const standings: Record<string, number[]> = {};
  for (const [label, groupMatches] of byGroup) {
    if (!groupMatches.every((m) => m.status === "finished")) continue;

    const stats = new Map<number, { pts: number; gd: number; gf: number }>();
    const ensure = (id: number) => {
      if (!stats.has(id)) stats.set(id, { pts: 0, gd: 0, gf: 0 });
      return stats.get(id)!;
    };
    for (const m of groupMatches) {
      if (m.home_team_id == null || m.away_team_id == null) continue;
      const h = ensure(m.home_team_id);
      const a = ensure(m.away_team_id);
      const hg = m.home_goals ?? 0;
      const ag = m.away_goals ?? 0;
      h.gf += hg;
      a.gf += ag;
      h.gd += hg - ag;
      a.gd += ag - hg;
      if (hg > ag) h.pts += 3;
      else if (hg < ag) a.pts += 3;
      else {
        h.pts += 1;
        a.pts += 1;
      }
    }
    standings[label] = [...stats.entries()]
      .sort((x, y) => y[1].pts - x[1].pts || y[1].gd - x[1].gd || y[1].gf - x[1].gf)
      .map(([id]) => id);
  }
  return standings;
}

export function computeActuals(
  matches: MatchRow[],
  goalsByMatch: Map<number, number[]>,
): ActualOutcomes {
  const advancers: Record<string, Set<number>> = {};
  let champion: number | null = null;
  const results = new Map<number, { home: number; away: number; scorers: Set<number> }>();

  for (const m of matches) {
    if (m.stage !== "group") {
      (advancers[m.stage] ??= new Set());
      if (m.home_team_id) advancers[m.stage].add(m.home_team_id);
      if (m.away_team_id) advancers[m.stage].add(m.away_team_id);
    }
    if (m.status === "finished" && m.home_goals != null && m.away_goals != null) {
      results.set(m.id, {
        home: m.home_goals,
        away: m.away_goals,
        scorers: new Set(goalsByMatch.get(m.id) ?? []),
      });
      if (m.stage === "final") {
        champion = m.home_goals > m.away_goals ? m.home_team_id : m.away_team_id;
      }
    }
  }

  return { groupStandings: computeGroupStandings(matches), advancers, champion, results };
}

export function scoreUpfront(
  cfg: ScoringConfig,
  actual: ActualOutcomes,
  bracket: BracketPick | null,
): number {
  if (!bracket) return 0;
  let pts = 0;

  for (const [label, actualOrder] of Object.entries(actual.groupStandings)) {
    const predicted = bracket.group_standings?.[label];
    if (!predicted?.length) continue;
    const actualTop2 = new Set(actualOrder.slice(0, 2));
    for (const teamId of predicted.slice(0, 2)) {
      if (actualTop2.has(teamId)) pts += cfg.upfront.group_qualifier;
    }
    if (predicted[0] === actualOrder[0]) pts += cfg.upfront.group_winner;
  }

  for (const [stage, key] of Object.entries(ADVANCE_KEYS)) {
    const reached = actual.advancers[stage];
    const predicted = bracket.knockout?.[stage];
    if (!reached || !predicted?.length) continue;
    for (const teamId of predicted) {
      if (reached.has(teamId)) pts += cfg.upfront[key];
    }
  }

  if (actual.champion != null && bracket.champion_team_id === actual.champion) {
    pts += cfg.upfront.champion;
  }

  return pts;
}

export function scoreLive(
  cfg: ScoringConfig,
  actual: ActualOutcomes,
  preds: MatchPick[],
): number {
  let pts = 0;
  for (const p of preds) {
    const r = actual.results.get(p.match_id);
    if (!r) continue;
    if (p.home_goals === r.home && p.away_goals === r.away) {
      pts += cfg.live.exact_score;
    } else {
      const predSign = Math.sign(p.home_goals - p.away_goals);
      const actualSign = Math.sign(r.home - r.away);
      if (predSign === actualSign) pts += cfg.live.correct_result;
    }
    for (const scorerId of p.scorer_ids) {
      if (r.scorers.has(scorerId)) pts += cfg.live.goal_scorer;
    }
  }
  return pts;
}
