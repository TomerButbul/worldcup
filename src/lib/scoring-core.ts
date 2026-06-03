import type { ScoringConfig, MatchStage, MatchScore } from "@/lib/types";
import { DEFAULT_SCORING } from "@/lib/types";
import { buildBracket, predictedAdvancers } from "@/lib/bracket-core";

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
  winner_team_id?: number | null; // knockout advancer (incl. shootouts)
}

export interface ActualOutcomes {
  groupStandings: Record<string, number[]>;
  advancers: Record<string, Set<number>>;
  champion: number | null;
  results: Map<number, { home: number; away: number; scorers: Map<number, number>; stage: MatchStage; winner: number | null }>;
  // Individual-award winners (award key -> player id). Golden Boot is derived
  // from goal data; the rest are filled from admin-entered results.
  awards: Record<string, number | null>;
}

export interface BracketPick {
  group_scores: Record<string, MatchScore>; // DB match id (string) → predicted score
  knockout: Record<string, number>;          // canonical match no (string) → winner team id
  champion_team_id: number | null;
  awards?: Record<string, number>;           // award key → predicted player id
}

export interface MatchPick {
  match_id: number;
  home_goals: number | null; // null for group matches (live game scores scorers only there)
  away_goals: number | null;
  scorer_goals: Record<string, number>; // player_id -> predicted goal count
  pen_winner_team_id?: number | null;   // knockout: predicted shootout winner (when level)
}

// Individual award keys (also the matching scoring-config keys).
export const AWARD_KEYS = ["golden_boot", "golden_ball", "golden_glove", "young_player"] as const;

export const ADVANCE_KEYS: Record<string, keyof ScoringConfig["upfront"]> = {
  round_of_32: "advance_round_of_32",
  round_of_16: "advance_round_of_16",
  quarter: "advance_quarter",
  semi: "advance_semi",
  final: "advance_final",
};

export interface GroupStat {
  pts: number;
  gd: number;
  gf: number;
}

export interface GroupTable {
  order: number[];
  stats: Map<number, GroupStat>;
}

// Tally points/GD/GF for `teamIds` using only matches *among those teams*.
// Passing the full group → the overall table; passing a tied subset → that
// subset's head-to-head mini-table (matches touching an outside team are skipped).
function tally(teamIds: Iterable<number>, matches: MatchRow[]): Map<number, GroupStat> {
  const stat = new Map<number, GroupStat>();
  for (const id of teamIds) stat.set(id, { pts: 0, gd: 0, gf: 0 });
  for (const m of matches) {
    if (m.home_team_id == null || m.away_team_id == null) continue;
    const h = stat.get(m.home_team_id);
    const a = stat.get(m.away_team_id);
    if (!h || !a) continue; // skip matches involving a team outside the set
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
  return stat;
}

// Split an already-sorted list into maximal runs where `equal(prev, next)` holds.
function runs<T>(sorted: T[], equal: (x: T, y: T) => boolean): T[][] {
  const out: T[][] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && equal(sorted[i], sorted[j])) j++;
    out.push(sorted.slice(i, j));
    i = j;
  }
  return out;
}

// Final, non-head-to-head criteria: overall GD → overall GF → FIFA ranking → id.
function byOverall(tied: number[], overall: Map<number, GroupStat>, fifaRank: Map<number, number>): number[] {
  const rank = (id: number) => fifaRank.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...tied].sort(
    (x, y) =>
      overall.get(y)!.gd - overall.get(x)!.gd ||
      overall.get(y)!.gf - overall.get(x)!.gf ||
      rank(x) - rank(y) ||
      x - y,
  );
}

// Resolve a set of teams already level on overall points (spec §5 criteria 2–8).
function resolveTied(
  tied: number[],
  groupMatches: MatchRow[],
  overall: Map<number, GroupStat>,
  fifaRank: Map<number, number>,
): number[] {
  if (tied.length === 1) return tied;

  const h2h = tally(tied, groupMatches);
  const sorted = [...tied].sort(
    (x, y) =>
      h2h.get(y)!.pts - h2h.get(x)!.pts ||
      h2h.get(y)!.gd - h2h.get(x)!.gd ||
      h2h.get(y)!.gf - h2h.get(x)!.gf,
  );
  const equalH2h = (x: number, y: number) =>
    h2h.get(x)!.pts === h2h.get(y)!.pts &&
    h2h.get(x)!.gd === h2h.get(y)!.gd &&
    h2h.get(x)!.gf === h2h.get(y)!.gf;

  const out: number[] = [];
  for (const run of runs(sorted, equalH2h)) {
    if (run.length === 1) {
      out.push(run[0]);
    } else if (run.length < tied.length) {
      // Head-to-head separated some teams; re-apply it to the still-tied subset.
      out.push(...resolveTied(run, groupMatches, overall, fifaRank));
    } else {
      // Head-to-head did not separate anyone → overall criteria + ranking.
      out.push(...byOverall(run, overall, fifaRank));
    }
  }
  return out;
}

export function computeGroupTables(
  matches: MatchRow[],
  fifaRank: Map<number, number> = new Map(),
): Record<string, GroupTable> {
  const byGroup = new Map<string, MatchRow[]>();
  for (const m of matches) {
    if (m.stage !== "group" || !m.group_label) continue;
    if (!byGroup.has(m.group_label)) byGroup.set(m.group_label, []);
    byGroup.get(m.group_label)!.push(m);
  }

  const tables: Record<string, GroupTable> = {};
  for (const [label, groupMatches] of byGroup) {
    if (!groupMatches.every((m) => m.status === "finished")) continue;

    const teamIds = new Set<number>();
    for (const m of groupMatches) {
      if (m.home_team_id != null) teamIds.add(m.home_team_id);
      if (m.away_team_id != null) teamIds.add(m.away_team_id);
    }

    const overall = tally(teamIds, groupMatches);
    const byPoints = [...teamIds].sort((x, y) => overall.get(y)!.pts - overall.get(x)!.pts);
    const samePoints = (x: number, y: number) => overall.get(x)!.pts === overall.get(y)!.pts;

    const order: number[] = [];
    for (const run of runs(byPoints, samePoints)) {
      order.push(...resolveTied(run, groupMatches, overall, fifaRank));
    }
    tables[label] = { order, stats: overall };
  }
  return tables;
}

export function computeGroupStandings(
  matches: MatchRow[],
  fifaRank: Map<number, number> = new Map(),
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [label, table] of Object.entries(computeGroupTables(matches, fifaRank))) {
    out[label] = table.order;
  }
  return out;
}

export function computeActuals(
  matches: MatchRow[],
  goalsByMatch: Map<number, Map<number, number>>,
): ActualOutcomes {
  const advancers: Record<string, Set<number>> = {};
  let champion: number | null = null;
  const results = new Map<number, { home: number; away: number; scorers: Map<number, number>; stage: MatchStage; winner: number | null }>();

  for (const m of matches) {
    if (m.stage !== "group") {
      (advancers[m.stage] ??= new Set());
      if (m.home_team_id) advancers[m.stage].add(m.home_team_id);
      if (m.away_team_id) advancers[m.stage].add(m.away_team_id);
    }
    if (m.status === "finished" && m.home_goals != null && m.away_goals != null) {
      // Advancer: API-provided winner (correct for shootouts), else the higher
      // scorer. Null only for a genuine group-stage draw.
      const decisive =
        m.home_goals > m.away_goals
          ? m.home_team_id
          : m.home_goals < m.away_goals
            ? m.away_team_id
            : null;
      const winner = m.winner_team_id ?? decisive;
      results.set(m.id, {
        home: m.home_goals,
        away: m.away_goals,
        scorers: goalsByMatch.get(m.id) ?? new Map(),
        stage: m.stage,
        winner,
      });
      if (m.stage === "final") champion = winner;
    }
  }

  // Golden Boot: most goals across the tournament (a downstream admin result
  // can override this — e.g. official tiebreakers).
  const goalTotals = new Map<number, number>();
  for (const r of results.values())
    for (const [pid, c] of r.scorers) goalTotals.set(pid, (goalTotals.get(pid) ?? 0) + c);
  let topScorer: number | null = null;
  let topGoals = 0;
  for (const [pid, g] of goalTotals) {
    if (g > topGoals || (g === topGoals && topScorer !== null && pid < topScorer)) {
      topScorer = pid;
      topGoals = g;
    }
  }

  return {
    groupStandings: computeGroupStandings(matches),
    advancers,
    champion,
    results,
    awards: { golden_boot: topScorer },
  };
}

export function scoreUpfront(
  cfg: ScoringConfig,
  actual: ActualOutcomes,
  bracket: BracketPick | null,
  ctx: { groupFixtures: MatchRow[]; fifaRank: Map<number, number> },
): number {
  if (!bracket) return 0;
  let pts = 0;

  // Overlay the user's predicted scorelines onto the real group fixtures, then
  // derive predicted standings and the full knockout bracket from them.
  const predictedRows: MatchRow[] = ctx.groupFixtures.map((fx) => {
    const s = bracket.group_scores?.[String(fx.id)];
    return s ? { ...fx, home_goals: s.h, away_goals: s.a, status: "finished" } : fx;
  });
  const tables = computeGroupTables(predictedRows, ctx.fifaRank);
  const { round32 } = buildBracket(tables, ctx.fifaRank);
  const adv = predictedAdvancers(round32, bracket.knockout ?? {});

  // Group-stage scoreline accuracy: an exact score beats a merely correct result.
  for (const [idStr, guess] of Object.entries(bracket.group_scores ?? {})) {
    const r = actual.results.get(Number(idStr));
    if (!r) continue;
    if (guess.h === r.home && guess.a === r.away) {
      pts += cfg.upfront.group_exact_score;
    } else if (Math.sign(guess.h - guess.a) === Math.sign(r.home - r.away)) {
      pts += cfg.upfront.group_correct_result;
    }
  }

  // Group-winner bonus: predicted 1st place matches the real 1st place.
  for (const [label, actualOrder] of Object.entries(actual.groupStandings)) {
    const predictedWinner = tables[label]?.order[0];
    if (predictedWinner != null && predictedWinner === actualOrder[0]) {
      pts += cfg.upfront.group_winner;
    }
  }

  // Group-order points: per finishing position the user called correctly, plus a
  // bonus for nailing all four. Scored only when both the actual table (keys of
  // groupStandings are already complete-only) and the user's predicted table are
  // full 4-team orders.
  const groupPosition = cfg.upfront.group_position ?? DEFAULT_SCORING.upfront.group_position;
  const groupOrderBonus = cfg.upfront.group_order_bonus ?? DEFAULT_SCORING.upfront.group_order_bonus;
  for (const [label, actualOrder] of Object.entries(actual.groupStandings)) {
    const predictedOrder = tables[label]?.order;
    if (!predictedOrder || predictedOrder.length !== 4 || actualOrder.length !== 4) continue;
    let matched = 0;
    for (let i = 0; i < 4; i++) {
      if (predictedOrder[i] === actualOrder[i]) matched++;
    }
    pts += matched * groupPosition;
    if (matched === 4) pts += groupOrderBonus;
  }

  // Survival/advancement: per stage, award for each predicted team that the real
  // tournament also pushed into that stage.
  for (const [stage, key] of Object.entries(ADVANCE_KEYS)) {
    const reached = actual.advancers[stage];
    const predicted = adv.byStage[stage];
    if (!reached || !predicted) continue;
    for (const teamId of predicted) {
      if (reached.has(teamId)) pts += cfg.upfront[key];
    }
  }

  // Stage-sweep bonuses: all-or-nothing per round. If the set of teams the user
  // predicted to reach a stage is exactly the set that actually reached it
  // (same size, same members), award that round's bonus. Reuses the advancer
  // sets built above. Only the four pre-final knockout rounds qualify.
  const SWEEP_KEYS: Record<string, keyof ScoringConfig["upfront"]> = {
    round_of_32: "sweep_round_of_32",
    round_of_16: "sweep_round_of_16",
    quarter: "sweep_quarter",
    semi: "sweep_semi",
  };
  for (const [stage, key] of Object.entries(SWEEP_KEYS)) {
    const reached = actual.advancers[stage];
    const predicted = adv.byStage[stage];
    // Require the round to have actually happened (non-empty) and a prediction to
    // exist; two empty sets must not count as a sweep.
    if (!reached || reached.size === 0 || !predicted) continue;
    if (predicted.size !== reached.size) continue;
    let identical = true;
    for (const teamId of reached) {
      if (!predicted.has(teamId)) {
        identical = false;
        break;
      }
    }
    if (identical) pts += cfg.upfront[key] ?? DEFAULT_SCORING.upfront[key];
  }

  // Champion: the winner the user picked in the final (match 104).
  const predictedChampion = adv.champion ?? bracket.champion_team_id;
  if (actual.champion != null && predictedChampion === actual.champion) {
    pts += cfg.upfront.champion;
  }

  // Individual awards: a correct player pick scores its configured points.
  for (const key of AWARD_KEYS) {
    const pick = bracket.awards?.[key];
    const winner = actual.awards[key];
    if (pick != null && winner != null && pick === winner) {
      pts += cfg.upfront[key];
    }
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
    // Scoreline points apply to knockout matches only — group scorelines are
    // scored by the upfront bracket, so the live game scores scorers there.
    if (r.stage !== "group" && p.home_goals != null && p.away_goals != null) {
      if (p.home_goals === r.home && p.away_goals === r.away) {
        pts += cfg.live.exact_score;
      } else {
        const predSign = Math.sign(p.home_goals - p.away_goals);
        const actualSign = Math.sign(r.home - r.away);
        if (predSign === actualSign) pts += cfg.live.correct_result;
      }
      // Shootout bonus: the tie went to pens (level result), the user predicted
      // a level score, and called the advancing team correctly. Stacks on top of
      // the scoreline points above.
      if (
        p.home_goals === p.away_goals &&
        r.home === r.away &&
        r.winner != null &&
        p.pen_winner_team_id === r.winner
      ) {
        pts += cfg.live.pen_winner;
      }
    }
    // Goal scorers: credit each correctly attributed goal, capped at how many
    // that player actually scored (so over-predicting a brace earns no extra).
    for (const [pid, predCount] of Object.entries(p.scorer_goals ?? {})) {
      const actualCount = r.scorers.get(Number(pid)) ?? 0;
      pts += cfg.live.goal_scorer * Math.min(predCount, actualCount);
    }
  }
  return pts;
}
