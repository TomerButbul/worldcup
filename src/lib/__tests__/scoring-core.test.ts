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

  it("head-to-head beats overall GD for two level teams", () => {
    // 1 and 2 both finish on 6 pts. 2 has the better overall GD (+6 vs +3),
    // but 1 won their head-to-head, so 1 must rank above 2.
    const g: MatchRow[] = [
      gm(1, "A", 1, 2, 1, 0), // 1 beats 2 (head-to-head)
      gm(2, "A", 3, 1, 1, 0), // 3 beats 1
      gm(3, "A", 1, 4, 3, 0), // 1 beats 4
      gm(4, "A", 2, 3, 2, 0), // 2 beats 3
      gm(5, "A", 2, 4, 5, 0), // 2 beats 4 (pads 2's overall GD)
      gm(6, "A", 3, 4, 1, 1), // 3 draws 4
    ];
    const s = computeGroupStandings(g);
    expect(s.A[0]).toBe(1);
    expect(s.A[1]).toBe(2);
  });

  it("breaks a 3-way points tie by head-to-head goal difference", () => {
    const g: MatchRow[] = [
      gm(1, "B", 1, 2, 2, 0), // 1 beats 2 by 2
      gm(2, "B", 2, 3, 2, 0), // 2 beats 3 by 2
      gm(3, "B", 3, 1, 1, 0), // 3 beats 1 by 1
      gm(4, "B", 1, 4, 1, 0),
      gm(5, "B", 2, 4, 1, 0),
      gm(6, "B", 3, 4, 1, 0),
    ];
    // H2H among {1,2,3}: each 3 pts. GD: 1 = +2-1=+1, 2 = -2+2=0, 3 = -2+1=-1.
    const s = computeGroupStandings(g);
    expect(s.B.slice(0, 3)).toEqual([1, 2, 3]);
    expect(s.B[3]).toBe(4);
  });

  it("falls through to FIFA ranking when teams are dead level on all score criteria", () => {
    // Perfect 1-0 cycle among 1,2,3; all beat 4 by 3-0 → identical pts/GD/GF
    // and an equal head-to-head cycle. FIFA ranking decides: 2 < 3 < 1.
    const g: MatchRow[] = [
      gm(1, "C", 1, 2, 1, 0),
      gm(2, "C", 2, 3, 1, 0),
      gm(3, "C", 3, 1, 1, 0),
      gm(4, "C", 1, 4, 3, 0),
      gm(5, "C", 2, 4, 3, 0),
      gm(6, "C", 3, 4, 3, 0),
    ];
    const fifaRank = new Map<number, number>([[2, 1], [3, 2], [1, 3]]);
    const s = computeGroupStandings(g, fifaRank);
    expect(s.C.slice(0, 3)).toEqual([2, 3, 1]);
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
  const ctx = (groupFixtures: MatchRow[] = []) => ({
    groupFixtures,
    fifaRank: new Map<number, number>(),
  });

  it("scores group results: exact beats correct-result, wrong earns nothing", () => {
    const actual = computeActuals(groupA, new Map());
    const pts = scoreUpfront(
      cfg,
      actual,
      {
        group_scores: {
          "1": { h: 2, a: 0 }, // actual 2-0 → exact
          "2": { h: 3, a: 1 }, // actual 2-1 → home win → correct result
          "3": { h: 0, a: 1 }, // actual 1-0 → wrong sign
        },
        knockout: {},
        champion_team_id: null,
      },
      ctx(groupA),
    );
    expect(pts).toBe(cfg.upfront.group_exact_score + cfg.upfront.group_correct_result);
  });

  it("awards the group-winner bonus when predicted scores yield the real winner", () => {
    const actual = computeActuals(groupA, new Map());
    // Predict every Group A match exactly → predicted standings == actual → winner = team 1.
    const group_scores: Record<string, { h: number; a: number }> = {
      "1": { h: 2, a: 0 },
      "2": { h: 2, a: 1 },
      "3": { h: 1, a: 0 },
      "4": { h: 1, a: 1 },
      "5": { h: 3, a: 1 },
      "6": { h: 0, a: 1 },
    };
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores, knockout: {}, champion_team_id: null },
      ctx(groupA),
    );
    expect(pts).toBe(6 * cfg.upfront.group_exact_score + cfg.upfront.group_winner);
  });

  it("awards advancement points for a knockout pick that reaches its stage", () => {
    // Team 5 actually reached the Round of 16; we predicted it to win R32 match 73.
    const actual = computeActuals([ko(10, "round_of_16", 5, 8)], new Map());
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores: {}, knockout: { "73": 5 }, champion_team_id: null },
      ctx(),
    );
    expect(pts).toBe(cfg.upfront.advance_round_of_16);
  });

  it("awards champion points only for the exact champion (from the final pick)", () => {
    const actual = computeActuals([ko(20, "final", 7, 9, 2, 0, "finished")], new Map());
    expect(
      scoreUpfront(cfg, actual, { group_scores: {}, knockout: { "104": 7 }, champion_team_id: null }, ctx()),
    ).toBe(cfg.upfront.champion);
    expect(
      scoreUpfront(cfg, actual, { group_scores: {}, knockout: { "104": 8 }, champion_team_id: null }, ctx()),
    ).toBe(0);
  });

  it("returns 0 for a null bracket", () => {
    const actual = computeActuals(groupA, new Map());
    expect(scoreUpfront(cfg, actual, null, ctx(groupA))).toBe(0);
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
