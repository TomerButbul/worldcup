import { describe, it, expect } from "vitest";
import {
  teamProgressPoints,
  draftTeamIds,
  draftScores,
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
