import { describe, it, expect } from "vitest";
import {
  computeGroupStandings,
  computeActuals,
  scoreUpfront,
  scoreLive,
  type MatchRow,
} from "@/lib/scoring-core";
import { DEFAULT_SCORING } from "@/lib/types";
import type { ScoringConfig } from "@/lib/types";

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
  winnerTeamId: number | null = null,
): MatchRow {
  return {
    id, stage, group_label: null, status,
    home_team_id: home, away_team_id: away, home_goals: hg, away_goals: ag,
    winner_team_id: winnerTeamId,
  };
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
    const goals = new Map<number, Map<number, number>>([[5, new Map([[101, 1], [102, 1]])]]);
    const a = computeActuals([gm(5, "A", 1, 4, 3, 1)], goals);
    expect(a.results.get(5)).toEqual({ home: 3, away: 1, scorers: new Map([[101, 1], [102, 1]]), stage: "group", winner: 1 });
  });

  it("champion comes from the shootout winner when the final is level", () => {
    // 1-1 final; team 2 won on penalties → champion must be 2, not the away
    // side a naive goal-diff comparison would crown.
    const a = computeActuals([ko(20, "final", 1, 2, 1, 1, "finished", 2)], new Map());
    expect(a.champion).toBe(2);
    expect(a.results.get(20)?.winner).toBe(2);
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
    // Predicting every match exactly also yields the exact finishing order, so on
    // top of the 6 exact scorelines + group-winner bonus this earns all four
    // group-position points and the perfect-order bonus.
    expect(pts).toBe(
      6 * cfg.upfront.group_exact_score +
        cfg.upfront.group_winner +
        4 * cfg.upfront.group_position +
        cfg.upfront.group_order_bonus,
    );
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

describe("scoreUpfront — individual awards", () => {
  const ctx = () => ({ groupFixtures: [] as MatchRow[], fifaRank: new Map<number, number>() });

  it("derives Golden Boot as the tournament top scorer", () => {
    const a = computeActuals(
      [ko(73, "round_of_32", 1, 4, 2, 1, "finished"), ko(74, "round_of_16", 5, 6, 1, 0, "finished")],
      new Map([
        [73, new Map([[101, 2], [102, 1]])],
        [74, new Map([[101, 1]])],
      ]),
    );
    expect(a.awards.golden_boot).toBe(101); // 3 goals total beats 102's 1
  });

  it("scores correct award picks, ignores wrong and unresolved ones", () => {
    const a = computeActuals([], new Map());
    a.awards = { golden_boot: 101, golden_ball: 202, golden_glove: null, young_player: 404 };
    const bracket = {
      group_scores: {},
      knockout: {},
      champion_team_id: null,
      awards: { golden_boot: 101, golden_ball: 999, golden_glove: 303, young_player: 404 },
    };
    // boot ✓, ball ✗, glove (no winner) ✗, young player ✓
    expect(scoreUpfront(cfg, a, bracket, ctx())).toBe(cfg.upfront.golden_boot + cfg.upfront.young_player);
  });
});

describe("scoreLive", () => {
  // Knockout → scoreline + scorers; players 101 and 102 each scored once.
  const koActual = computeActuals(
    [ko(73, "round_of_32", 1, 4, 3, 1, "finished")],
    new Map([[73, new Map([[101, 1], [102, 1]])]]),
  );
  // Group → scorers only; player 101 scored twice.
  const groupActual = computeActuals(
    [gm(5, "A", 1, 4, 3, 1)],
    new Map([[5, new Map([[101, 2]])]]),
  );

  it("knockout: awards exact-score points (and not double-counts result)", () => {
    expect(scoreLive(cfg, koActual, [{ match_id: 73, home_goals: 3, away_goals: 1, scorer_goals: {} }]))
      .toBe(cfg.live.exact_score);
  });

  it("knockout: awards correct-result points for right winner, wrong score", () => {
    expect(scoreLive(cfg, koActual, [{ match_id: 73, home_goals: 2, away_goals: 0, scorer_goals: {} }]))
      .toBe(cfg.live.correct_result);
  });

  it("knockout: awards nothing for the wrong result", () => {
    expect(scoreLive(cfg, koActual, [{ match_id: 73, home_goals: 0, away_goals: 2, scorer_goals: {} }]))
      .toBe(0);
  });

  it("knockout: adds goal-scorer points, one per correctly attributed goal", () => {
    // 101 and 102 each scored once; 999 didn't.
    expect(scoreLive(cfg, koActual, [{ match_id: 73, home_goals: 3, away_goals: 1, scorer_goals: { 101: 1, 102: 1, 999: 1 } }]))
      .toBe(cfg.live.exact_score + cfg.live.goal_scorer * 2);
  });

  it("caps scorer credit at the player's actual goal count", () => {
    // Predict 101 to score 3, but 101 only scored once → credit just 1.
    expect(scoreLive(cfg, koActual, [{ match_id: 73, home_goals: 3, away_goals: 1, scorer_goals: { 101: 3 } }]))
      .toBe(cfg.live.exact_score + cfg.live.goal_scorer * 1);
  });

  it("group: scores the (lighter) group scoreline + count-aware scorers at group rates", () => {
    // groupActual match 5 finished 3-1. A perfect 3-1 line earns the GROUP exact rate.
    expect(scoreLive(cfg, groupActual, [{ match_id: 5, home_goals: 3, away_goals: 1, scorer_goals: {} }]))
      .toBe(cfg.live.group_exact_score);
    // Scorers count at the group rate, capped at the player's actual goals (101 scored 2).
    expect(scoreLive(cfg, groupActual, [{ match_id: 5, home_goals: 3, away_goals: 1, scorer_goals: { 101: 3 } }]))
      .toBe(cfg.live.group_exact_score + cfg.live.group_goal_scorer * 2);
    // A scorers-only pick (no score entered) still scores just the scorers.
    expect(scoreLive(cfg, groupActual, [{ match_id: 5, home_goals: null, away_goals: null, scorer_goals: { 101: 2 } }]))
      .toBe(cfg.live.group_goal_scorer * 2);
  });

  it("ignores predictions for matches with no result yet", () => {
    expect(scoreLive(cfg, koActual, [{ match_id: 777, home_goals: 1, away_goals: 0, scorer_goals: {} }]))
      .toBe(0);
  });
});

describe("scoreLive — knockout shootouts", () => {
  // Semi-final 0-0; team 4 wins the shootout (the actual advancer).
  const penActual = computeActuals([ko(80, "semi", 1, 4, 0, 0, "finished", 4)], new Map());
  // Semi-final 2-1; team 1 wins in normal time (no shootout).
  const decisiveActual = computeActuals([ko(81, "semi", 1, 4, 2, 1, "finished")], new Map());

  it("exact level score + correct shootout pick stacks: 5 + 2 = 7", () => {
    expect(
      scoreLive(cfg, penActual, [{ match_id: 80, home_goals: 0, away_goals: 0, scorer_goals: {}, pen_winner_team_id: 4 }]),
    ).toBe(cfg.live.exact_score + cfg.live.pen_winner);
  });

  it("level (not exact) score + correct shootout pick: correct_result + pen", () => {
    expect(
      scoreLive(cfg, penActual, [{ match_id: 80, home_goals: 1, away_goals: 1, scorer_goals: {}, pen_winner_team_id: 4 }]),
    ).toBe(cfg.live.correct_result + cfg.live.pen_winner);
  });

  it("correct exact score but wrong shootout pick: just the 5", () => {
    expect(
      scoreLive(cfg, penActual, [{ match_id: 80, home_goals: 0, away_goals: 0, scorer_goals: {}, pen_winner_team_id: 1 }]),
    ).toBe(cfg.live.exact_score);
  });

  it("no shootout pick made: just the scoreline points", () => {
    expect(
      scoreLive(cfg, penActual, [{ match_id: 80, home_goals: 0, away_goals: 0, scorer_goals: {} }]),
    ).toBe(cfg.live.exact_score);
  });

  it("no pen bonus when the match was decisive (no shootout)", () => {
    expect(
      scoreLive(cfg, decisiveActual, [{ match_id: 81, home_goals: 0, away_goals: 0, scorer_goals: {}, pen_winner_team_id: 4 }]),
    ).toBe(0);
  });

  it("no pen bonus when the user predicted a winner, not a draw", () => {
    expect(
      scoreLive(cfg, penActual, [{ match_id: 80, home_goals: 2, away_goals: 1, scorer_goals: {}, pen_winner_team_id: 4 }]),
    ).toBe(0);
  });
});

describe("scoreUpfront — group-order points", () => {
  const ctx = (groupFixtures: MatchRow[] = []) => ({
    groupFixtures,
    fifaRank: new Map<number, number>(),
  });

  // Actual Group A finishing order is [1, 3, 4, 2].
  it("awards group_position per correct finishing slot, no bonus when not all four match", () => {
    const actual = computeActuals(groupA, new Map());
    // Predict 5 matches exactly but flip match 4 (2 v 4) to a 2-0 team-2 win.
    // That lifts team 2 above team 4 → predicted order [1, 3, 2, 4]: slots 0 and
    // 1 (teams 1, 3) match actual; slots 2, 3 are swapped. So 2 positions right.
    const group_scores: Record<string, { h: number; a: number }> = {
      "1": { h: 2, a: 0 }, // exact
      "2": { h: 2, a: 1 }, // exact
      "3": { h: 1, a: 0 }, // exact
      "4": { h: 2, a: 0 }, // actual 1-1 (draw) → predicted home win → wrong sign
      "5": { h: 3, a: 1 }, // exact
      "6": { h: 0, a: 1 }, // exact
    };
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores, knockout: {}, champion_team_id: null },
      ctx(groupA),
    );
    expect(pts).toBe(
      5 * cfg.upfront.group_exact_score + // matches 1,2,3,5,6 exact
        cfg.upfront.group_winner + // predicted winner team 1 == actual
        2 * cfg.upfront.group_position, // slots 0 and 1 correct, no perfect-order bonus
    );
  });

  it("adds the perfect-order bonus when all four finishing slots match", () => {
    const actual = computeActuals(groupA, new Map());
    // Predict every match exactly → predicted order == actual [1, 3, 4, 2].
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
    expect(pts).toBe(
      6 * cfg.upfront.group_exact_score +
        cfg.upfront.group_winner +
        4 * cfg.upfront.group_position +
        cfg.upfront.group_order_bonus,
    );
  });
});

describe("scoreUpfront — table-pick (group order) model", () => {
  const ctx = (groupFixtures: MatchRow[] = []) => ({ groupFixtures, fifaRank: new Map<number, number>() });

  it("scores group-order points from a predicted order, no scorelines needed", () => {
    const actual = computeActuals(groupA, new Map()); // actual Group A order [1, 3, 4, 2]
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores: {}, group_order: { A: [1, 3, 4, 2] }, third_qualifiers: [], knockout: {}, champion_team_id: null },
      ctx(groupA),
    );
    expect(pts).toBe(cfg.upfront.group_winner + 4 * cfg.upfront.group_position + cfg.upfront.group_order_bonus);
  });

  it("partial order: counts correct slots + winner, no perfect-order bonus", () => {
    const actual = computeActuals(groupA, new Map()); // [1, 3, 4, 2]
    // [1, 3, 2, 4] → slots 0,1 (teams 1,3) right; 2,3 swapped.
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores: {}, group_order: { A: [1, 3, 2, 4] }, third_qualifiers: [], knockout: {}, champion_team_id: null },
      ctx(),
    );
    expect(pts).toBe(cfg.upfront.group_winner + 2 * cfg.upfront.group_position);
  });

  it("still scores champion in the order model", () => {
    const actual = computeActuals([ko(20, "final", 7, 9, 2, 0, "finished")], new Map());
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores: {}, group_order: { A: [1, 2, 3, 4] }, third_qualifiers: [], knockout: { "104": 7 }, champion_team_id: null },
      ctx(),
    );
    expect(pts).toBe(cfg.upfront.champion);
  });
});

describe("scoreUpfront — stage-sweep bonuses", () => {
  const ctx = () => ({ groupFixtures: [] as MatchRow[], fifaRank: new Map<number, number>() });

  it("awards the round_of_16 sweep when the predicted set equals the actual set", () => {
    // Actual: teams 1 and 2 reached the Round of 16 (match 89).
    const actual = computeActuals([ko(89, "round_of_16", 1, 2)], new Map());
    // Predict R32 winners 73→1 and 74→2 → predicted R16 reachers {1, 2} == actual.
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores: {}, knockout: { "73": 1, "74": 2 }, champion_team_id: null },
      ctx(),
    );
    // Both predicted teams actually advanced (advancement points) + the sweep bonus.
    expect(pts).toBe(2 * cfg.upfront.advance_round_of_16 + cfg.upfront.sweep_round_of_16);
  });

  it("awards no sweep when one team in the round is wrong", () => {
    const actual = computeActuals([ko(89, "round_of_16", 1, 2)], new Map());
    // Predict 73→1 (correct) and 74→3 → predicted R16 reachers {1, 3} != {1, 2}.
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores: {}, knockout: { "73": 1, "74": 3 }, champion_team_id: null },
      ctx(),
    );
    // Only team 1 advanced → one advancement award; no sweep bonus.
    expect(pts).toBe(cfg.upfront.advance_round_of_16);
  });
});

describe("scoreUpfront — legacy config falls back to defaults (no NaN)", () => {
  const ctx = (groupFixtures: MatchRow[] = []) => ({
    groupFixtures,
    fifaRank: new Map<number, number>(),
  });

  // A league saved before these fields existed: clone DEFAULT_SCORING and strip
  // the new upfront keys. Reading them must fall back to defaults, never NaN.
  function legacyCfg(): ScoringConfig {
    const clone: ScoringConfig = JSON.parse(JSON.stringify(DEFAULT_SCORING));
    const up = clone.upfront as Record<string, number>;
    for (const k of [
      "group_position",
      "group_order_bonus",
      "sweep_round_of_32",
      "sweep_round_of_16",
      "sweep_quarter",
      "sweep_semi",
    ]) {
      delete up[k];
    }
    return clone;
  }

  it("group-order points fall back to defaults when the fields are missing", () => {
    const actual = computeActuals(groupA, new Map());
    const group_scores: Record<string, { h: number; a: number }> = {
      "1": { h: 2, a: 0 },
      "2": { h: 2, a: 1 },
      "3": { h: 1, a: 0 },
      "4": { h: 1, a: 1 },
      "5": { h: 3, a: 1 },
      "6": { h: 0, a: 1 },
    };
    const pts = scoreUpfront(
      legacyCfg(),
      actual,
      { group_scores, knockout: {}, champion_team_id: null },
      ctx(groupA),
    );
    expect(Number.isNaN(pts)).toBe(false);
    // Perfect order → 4 × default group_position (1) + default group_order_bonus (3).
    expect(pts).toBe(
      6 * cfg.upfront.group_exact_score +
        cfg.upfront.group_winner +
        4 * DEFAULT_SCORING.upfront.group_position +
        DEFAULT_SCORING.upfront.group_order_bonus,
    );
  });

  it("stage-sweep bonus falls back to the default when the field is missing", () => {
    const actual = computeActuals([ko(89, "round_of_16", 1, 2)], new Map());
    const pts = scoreUpfront(
      legacyCfg(),
      actual,
      { group_scores: {}, knockout: { "73": 1, "74": 2 }, champion_team_id: null },
      ctx(),
    );
    expect(Number.isNaN(pts)).toBe(false);
    expect(pts).toBe(
      2 * cfg.upfront.advance_round_of_16 + DEFAULT_SCORING.upfront.sweep_round_of_16,
    );
  });
});
