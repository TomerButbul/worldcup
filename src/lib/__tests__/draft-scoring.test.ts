import { describe, it, expect } from "vitest";
import {
  teamProgressPoints,
  draftTeamIds,
  draftScores,
  computeGroupPoints,
  DRAFT_CHAMPION_POINTS,
} from "@/lib/draft-scoring";

describe("teamProgressPoints", () => {
  const reached = {
    round_of_32: new Set([1, 2, 3]),
    round_of_16: new Set([1, 2]),
    quarter: new Set([1]),
    semi: new Set<number>(),
    final: new Set<number>(),
  };
  it("group exit = 0", () => expect(teamProgressPoints(9, reached, null)).toBe(0));
  it("reached R32 = 1", () => expect(teamProgressPoints(3, reached, null)).toBe(1));
  it("reached R16 = 2", () => expect(teamProgressPoints(2, reached, null)).toBe(2));
  it("reached QF = 4 (max of all stages reached)", () => expect(teamProgressPoints(1, reached, null)).toBe(4));
  it("champion overrides to 12", () => expect(teamProgressPoints(1, reached, 1)).toBe(DRAFT_CHAMPION_POINTS));
  it("null team = 0", () => expect(teamProgressPoints(null, reached, null)).toBe(0));
});

describe("draftTeamIds", () => {
  it("maps exact names and the four known aliases", () => {
    const teams = [
      { id: 10, name: "Argentina" },
      { id: 11, name: "Ivory Coast" }, // draft pool: Côte d'Ivoire
      { id: 12, name: "Czech Republic" }, // draft pool: Czechia
      { id: 13, name: "Cape Verde Islands" }, // draft pool: Cape Verde
      { id: 14, name: "Congo DR" }, // draft pool: DR Congo
    ];
    const m = draftTeamIds(teams);
    expect(m.get("Argentina")).toBe(10);
    expect(m.get("Côte d'Ivoire")).toBe(11);
    expect(m.get("Czechia")).toBe(12);
    expect(m.get("Cape Verde")).toBe(13);
    expect(m.get("DR Congo")).toBe(14);
  });
});

describe("draftScores", () => {
  it("ranks each pot independently and totals for bragging rights", () => {
    const picks = [
      { user_id: "a", pot: 1, slot: 1 },
      { user_id: "a", pot: 2, slot: 1 },
      { user_id: "a", pot: 3, slot: 1 },
      { user_id: "b", pot: 1, slot: 2 },
      { user_id: "b", pot: 2, slot: 2 },
      { user_id: "b", pot: 3, slot: 2 },
    ];
    const pts: Record<string, number> = { "1-1": 12, "1-2": 4, "2-1": 0, "2-2": 6, "3-1": 2, "3-2": 1 };
    const { perPot, totals } = draftScores(picks, (pot, slot) => pts[`${pot}-${slot}`] ?? 0);
    expect(perPot[1].map((r) => r.userId)).toEqual(["a", "b"]); // 12 > 4
    expect(perPot[2].map((r) => r.userId)).toEqual(["b", "a"]); // 6 > 0
    expect(totals[0]).toEqual({ userId: "a", points: 14 }); // 12+0+2
    expect(totals[1]).toEqual({ userId: "b", points: 11 }); // 4+6+1
  });
});

describe("computeGroupPoints", () => {
  const gm = (stage: string, status: string, h: number, a: number, hg: number | null, ag: number | null) => ({
    stage, status, home_team_id: h, away_team_id: a, home_goals: hg, away_goals: ag,
  });
  it("awards 3 for a win, 1 each for a draw, nothing for losses / unplayed / knockout", () => {
    const pts = computeGroupPoints([
      gm("group", "finished", 1, 2, 2, 0), // 1 beats 2 → 1:+3
      gm("group", "finished", 1, 3, 1, 1), // 1 draws 3 → 1:+1, 3:+1
      gm("group", "scheduled", 1, 4, null, null), // unplayed → ignored
      gm("round_of_32", "finished", 1, 5, 3, 0), // knockout → ignored
    ]);
    expect(pts[1]).toBe(4); // 3 (win) + 1 (draw)
    expect(pts[3]).toBe(1);
    expect(pts[2]).toBeUndefined(); // lost
    expect(pts[4]).toBeUndefined(); // unplayed
    expect(pts[5]).toBeUndefined(); // knockout not counted here
  });
});

describe("teamProgressPoints with group points", () => {
  const reached = {
    round_of_32: new Set([1]),
    round_of_16: new Set<number>(),
    quarter: new Set<number>(),
    semi: new Set<number>(),
    final: new Set<number>(),
  };
  const group = { 1: 9, 7: 6 }; // team 1 won all 3 group games; team 7 banked 6

  it("stacks group points on top of the knockout bonus", () => {
    expect(teamProgressPoints(1, reached, null, group)).toBe(9 + 1); // 9 group + 1 (R32)
  });
  it("a team out in the group still keeps its group points", () => {
    expect(teamProgressPoints(7, reached, null, group)).toBe(6); // 6 group + 0 knockout
  });
  it("champion = 12 + group points", () => {
    expect(teamProgressPoints(1, reached, 1, group)).toBe(DRAFT_CHAMPION_POINTS + 9);
  });
});
