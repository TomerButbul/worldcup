import { describe, it, expect } from "vitest";
import { predictionProgress, type BracketPredictionRow } from "@/lib/predictionProgress";

const TOTAL = 4;

describe("predictionProgress", () => {
  it("treats a missing row as nothing done", () => {
    const p = predictionProgress(null, TOTAL);
    expect(p).toEqual({
      bracketStarted: false,
      bracketDone: false,
      awardsPicked: 0,
      awardsTotal: TOTAL,
      awardsDone: false,
      allDone: false,
    });
  });

  it("treats empty objects the same as missing", () => {
    const row: BracketPredictionRow = { champion_team_id: null, knockout: {}, group_order: {}, awards: {} };
    const p = predictionProgress(row, TOTAL);
    expect(p.bracketStarted).toBe(false);
    expect(p.bracketDone).toBe(false);
    expect(p.awardsPicked).toBe(0);
    expect(p.allDone).toBe(false);
  });

  it("counts group ordering as started (but not done)", () => {
    const row: BracketPredictionRow = { champion_team_id: null, knockout: {}, group_order: { A: [1, 2, 3, 4] }, awards: {} };
    const p = predictionProgress(row, TOTAL);
    expect(p.bracketStarted).toBe(true);
    expect(p.bracketDone).toBe(false);
  });

  it("counts knockout picks as started (but not done) without a champion", () => {
    const row: BracketPredictionRow = { champion_team_id: null, knockout: { "89": 5 }, group_order: {}, awards: {} };
    const p = predictionProgress(row, TOTAL);
    expect(p.bracketStarted).toBe(true);
    expect(p.bracketDone).toBe(false);
  });

  it("marks the bracket done once a champion is picked", () => {
    const row: BracketPredictionRow = { champion_team_id: 42, knockout: { "104": 42 }, group_order: {}, awards: {} };
    const p = predictionProgress(row, TOTAL);
    expect(p.bracketDone).toBe(true);
    expect(p.bracketStarted).toBe(true);
  });

  it("counts partial awards", () => {
    const row: BracketPredictionRow = { champion_team_id: null, knockout: {}, group_order: {}, awards: { golden_boot: 7, golden_ball: 9 } };
    const p = predictionProgress(row, TOTAL);
    expect(p.awardsPicked).toBe(2);
    expect(p.awardsDone).toBe(false);
  });

  it("marks awards done when all categories are picked", () => {
    const row: BracketPredictionRow = {
      champion_team_id: null,
      knockout: {},
      group_order: {},
      awards: { golden_boot: 1, golden_ball: 2, golden_glove: 3, young_player: 4 },
    };
    const p = predictionProgress(row, TOTAL);
    expect(p.awardsPicked).toBe(4);
    expect(p.awardsDone).toBe(true);
  });

  it("is allDone only when the bracket has a champion AND all awards are picked", () => {
    const row: BracketPredictionRow = {
      champion_team_id: 42,
      knockout: { "104": 42 },
      group_order: { A: [1, 2, 3, 4] },
      awards: { golden_boot: 1, golden_ball: 2, golden_glove: 3, young_player: 4 },
    };
    expect(predictionProgress(row, TOTAL).allDone).toBe(true);
  });
});
