import { describe, it, expect } from "vitest";
import { computeActuals, scoreUpfront, type MatchRow } from "@/lib/scoring-core";
import { DEFAULT_SCORING } from "@/lib/types";

// When a player has RESET (second chance), their group-table points are forfeited —
// but their knockout/champion picks still score in full. We assert the DIFFERENCE
// between not-reset and reset equals exactly the group-table points, so the test is
// robust to whatever knockout points the fixture happens to produce.

const cfg = DEFAULT_SCORING;

const gm = (id: number, g: string, h: number, a: number, hg: number, ag: number): MatchRow => ({
  id, stage: "group", group_label: g, status: "finished",
  home_team_id: h, away_team_id: a, home_goals: hg, away_goals: ag,
});

// Group A: team 1 wins it, team 3 second.
const groupA: MatchRow[] = [
  gm(1, "A", 1, 2, 2, 0), gm(2, "A", 3, 4, 2, 1), gm(3, "A", 1, 3, 1, 0),
  gm(4, "A", 2, 4, 1, 1), gm(5, "A", 1, 4, 3, 1), gm(6, "A", 2, 3, 0, 1),
];
const finalMatch: MatchRow = {
  id: 104, stage: "final", group_label: null, status: "finished",
  home_team_id: 1, away_team_id: 2, home_goals: 2, away_goals: 1, winner_team_id: 1,
};

describe("scoreUpfront — reset forfeits group-table points only", () => {
  const matches = [...groupA, finalMatch];
  const actual = computeActuals(matches, new Map());
  const bracket = {
    group_scores: {},
    group_order: { A: actual.groupStandings.A }, // a perfect group A → earns the group-winner point
    third_qualifiers: [],
    knockout: {},
    champion_team_id: 1, // correct champion → a knockout point that must survive reset
    awards: {},
  };
  const ctx = { groupFixtures: groupA, fifaRank: new Map<number, number>() };

  it("reset drops exactly the group-table points and keeps everything else", () => {
    const notReset = scoreUpfront(cfg, actual, bracket, ctx, false);
    const reset = scoreUpfront(cfg, actual, bracket, ctx, true);
    // group_position + group_order_bonus are 0 in the rebalanced config, so a perfect
    // group A is worth exactly one group_winner point.
    expect(notReset - reset).toBe(cfg.upfront.group_winner);
  });

  it("reset still scores the champion (knockout points unaffected)", () => {
    const reset = scoreUpfront(cfg, actual, bracket, ctx, true);
    expect(reset).toBeGreaterThanOrEqual(cfg.upfront.champion);
  });

  it("reset never scores more than not-reset", () => {
    expect(scoreUpfront(cfg, actual, bracket, ctx, true)).toBeLessThanOrEqual(
      scoreUpfront(cfg, actual, bracket, ctx, false),
    );
  });
});
