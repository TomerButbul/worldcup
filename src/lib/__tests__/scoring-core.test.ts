import { describe, it, expect } from "vitest";
import {
  computeGroupStandings,
  computeActuals,
  scoreUpfront,
  scoreLive,
  type MatchRow,
} from "@/lib/scoring-core";
import { DEFAULT_SCORING } from "@/lib/types";

const cfg = DEFAULT_SCORING;

function gm(
  id: number,
  group: string,
  home: number,
  away: number,
  hg: number | null,
  ag: number | null,
  status = "finished",
): MatchRow {
  return {
    id,
    stage: "group",
    group_label: group,
    status,
    home_team_id: home,
    away_team_id: away,
    home_goals: hg,
    away_goals: ag,
  };
}

function ko(
  id: number,
  stage: MatchRow["stage"],
  home: number,
  away: number,
  hg: number | null = null,
  ag: number | null = null,
  status = "scheduled",
): MatchRow {
  return { id, stage, group_label: null, status, home_team_id: home, away_team_id: away, home_goals: hg, away_goals: ag };
}

// Group A: 1 beats everyone (9pts); 3 beats 2 and 4 (6pts); 2 and 4 lower.
const groupA: MatchRow[] = [
  gm(1, "A", 1, 2, 2, 0),
  gm(2, "A", 3, 4, 2, 1),
  gm(3, "A", 1, 3, 1, 0),
  gm(4, "A", 2, 4, 1, 1),
  gm(5, "A", 1, 4, 3, 1),
  gm(6, "A", 2, 3, 0, 1),
];

describe("computeGroupStandings", () => {
  it("ranks a completed group by points then GD/GF", () => {
    const s = computeGroupStandings(groupA);
    expect(s.A[0]).toBe(1);
    expect(s.A[1]).toBe(3);
    expect(s.A).toHaveLength(4);
  });

  it("does not rank a group with unfinished matches", () => {
    const partial = [...groupA.slice(0, 5), gm(6, "A", 2, 3, null, null, "scheduled")];
    expect(computeGroupStandings(partial).A).toBeUndefined();
  });

  it("ignores knockout matches", () => {
    const s = computeGroupStandings([ko(99, "final", 1, 2, 1, 0, "finished")]);
    expect(Object.keys(s)).toHaveLength(0);
  });
});

describe("computeActuals", () => {
  it("collects advancers per knockout stage and the champion", () => {
    const matches: MatchRow[] = [
      ko(10, "round_of_16", 1, 8),
      ko(11, "round_of_16", 2, 7),
      ko(20, "final", 1, 2, 3, 1, "finished"),
    ];
    const a = computeActuals(matches, new Map());
    expect(a.advancers.round_of_16).toEqual(new Set([1, 8, 2, 7]));
    expect(a.advancers.final).toEqual(new Set([1, 2]));
    expect(a.champion).toBe(1);
  });

  it("champion is the away team when they win the final", () => {
    const a = computeActuals([ko(20, "final", 1, 2, 0, 2, "finished")], new Map());
    expect(a.champion).toBe(2);
  });

  it("records finished results with scorers", () => {
    const goals = new Map<number, number[]>([[5, [101, 102]]]);
    const a = computeActuals([gm(5, "A", 1, 4, 3, 1)], goals);
    expect(a.results.get(5)).toEqual({ home: 3, away: 1, scorers: new Set([101, 102]) });
  });
});

describe("scoreUpfront", () => {
  const actual = computeActuals(
    [
      ...groupA,
      ko(10, "round_of_16", 1, 8),
      ko(11, "round_of_16", 3, 7),
      ko(20, "final", 1, 5, 2, 0, "finished"),
    ],
    new Map(),
  );

  it("awards group winner + both qualifiers when fully correct", () => {
    const pts = scoreUpfront(cfg, actual, {
      group_standings: { A: [1, 3, 2, 4] },
      knockout: {},
      champion_team_id: null,
    });
    // winner(3) + 2 qualifiers(1 each) = 5
    expect(pts).toBe(5);
  });

  it("gives qualifier points but not winner when order is swapped", () => {
    const pts = scoreUpfront(cfg, actual, {
      group_standings: { A: [3, 1, 2, 4] },
      knockout: {},
      champion_team_id: null,
    });
    expect(pts).toBe(2); // 2 qualifiers, no winner bonus
  });

  it("awards advancer points per correct team that reached a round", () => {
    const pts = scoreUpfront(cfg, actual, {
      group_standings: {},
      knockout: { round_of_16: [1, 8, 999] }, // 1 and 8 reached, 999 did not
      champion_team_id: null,
    });
    expect(pts).toBe(cfg.upfront.advance_round_of_16 * 2);
  });

  it("awards champion points only for the exact champion", () => {
    expect(
      scoreUpfront(cfg, actual, { group_standings: {}, knockout: {}, champion_team_id: 1 }),
    ).toBe(cfg.upfront.champion);
    expect(
      scoreUpfront(cfg, actual, { group_standings: {}, knockout: {}, champion_team_id: 5 }),
    ).toBe(0);
  });

  it("returns 0 for a null bracket", () => {
    expect(scoreUpfront(cfg, actual, null)).toBe(0);
  });
});

describe("scoreLive", () => {
  const actual = computeActuals(
    [gm(5, "A", 1, 4, 3, 1)],
    new Map([[5, [101, 102]]]),
  );

  it("awards exact-score points (and not double-counts result)", () => {
    const pts = scoreLive(cfg, actual, [{ match_id: 5, home_goals: 3, away_goals: 1, scorer_ids: [] }]);
    expect(pts).toBe(cfg.live.exact_score);
  });

  it("awards correct-result points for right winner, wrong score", () => {
    const pts = scoreLive(cfg, actual, [{ match_id: 5, home_goals: 2, away_goals: 0, scorer_ids: [] }]);
    expect(pts).toBe(cfg.live.correct_result);
  });

  it("awards nothing for the wrong result", () => {
    const pts = scoreLive(cfg, actual, [{ match_id: 5, home_goals: 0, away_goals: 2, scorer_ids: [] }]);
    expect(pts).toBe(0);
  });

  it("adds goal-scorer points for each correct scorer", () => {
    const pts = scoreLive(cfg, actual, [
      { match_id: 5, home_goals: 3, away_goals: 1, scorer_ids: [101, 102, 999] },
    ]);
    expect(pts).toBe(cfg.live.exact_score + cfg.live.goal_scorer * 2);
  });

  it("ignores predictions for matches with no result yet", () => {
    const pts = scoreLive(cfg, actual, [{ match_id: 777, home_goals: 1, away_goals: 0, scorer_ids: [] }]);
    expect(pts).toBe(0);
  });
});
