import { describe, it, expect } from "vitest";
import { ROUND32, BRACKET_TREE, THIRD_MATCHES, stageOf, rankThirdPlaceTeams, pickBestEightThirds, buildRound32, buildBracket, buildBracketFromOrder, predictedAdvancers, resolvePredictedBracket, predictedBracketRounds, type GroupTables, type Round32 } from "@/lib/bracket-core";
import type { GroupStat } from "@/lib/scoring-core";

// Minimal table: only the 3rd-placed team's stats are needed for ranking.
function tbl(order: number[], thirdStat: GroupStat): GroupTables[string] {
  const stats = new Map<number, GroupStat>([[order[2], thirdStat]]);
  return { order, stats };
}

describe("canonical template", () => {
  it("has 16 Round-of-32 matches (73–88)", () => {
    const nums = Object.keys(ROUND32).map(Number).sort((a, b) => a - b);
    expect(nums).toEqual([73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88]);
  });

  it("the eight third-place matches pair a group winner with a third", () => {
    expect(THIRD_MATCHES).toEqual([74, 77, 79, 80, 81, 82, 85, 87]);
    for (const m of THIRD_MATCHES) {
      expect(ROUND32[m].home.kind).toBe("winner");
      expect(ROUND32[m].away).toEqual({ kind: "third", match: m });
    }
  });

  it("the eight fixed matches use only group winners/runners", () => {
    for (const m of [73, 75, 76, 78, 83, 84, 86, 88]) {
      for (const side of [ROUND32[m].home, ROUND32[m].away]) {
        expect(["winner", "runner"]).toContain(side.kind);
      }
    }
  });

  it("wires the tree exactly per FIFA (e.g. 89 = W74 v W77, 104 = W101 v W102)", () => {
    expect(BRACKET_TREE[89]).toEqual({
      home: { kind: "matchWinner", match: 74 },
      away: { kind: "matchWinner", match: 77 },
    });
    expect(BRACKET_TREE[104]).toEqual({
      home: { kind: "matchWinner", match: 101 },
      away: { kind: "matchWinner", match: 102 },
    });
  });

  it("maps canonical numbers to stages", () => {
    expect(stageOf(73)).toBe("round_of_32");
    expect(stageOf(88)).toBe("round_of_32");
    expect(stageOf(89)).toBe("round_of_16");
    expect(stageOf(96)).toBe("round_of_16");
    expect(stageOf(97)).toBe("quarter");
    expect(stageOf(100)).toBe("quarter");
    expect(stageOf(101)).toBe("semi");
    expect(stageOf(102)).toBe("semi");
    expect(stageOf(104)).toBe("final");
  });
});

describe("third-place ranking", () => {
  it("ranks thirds by points then GD then GF", () => {
    const tables: GroupTables = {
      A: tbl([10, 11, 12, 13], { pts: 4, gd: 1, gf: 3 }), // third = 12
      B: tbl([20, 21, 22, 23], { pts: 6, gd: 2, gf: 4 }), // third = 22 (best, most pts)
      C: tbl([30, 31, 32, 33], { pts: 4, gd: 2, gf: 5 }), // third = 32 (beats A on GD)
    };
    const ranked = rankThirdPlaceTeams(tables);
    expect(ranked.map((t) => t.teamId)).toEqual([22, 32, 12]);
  });

  it("picks the best 8 of 12 and reports their groups", () => {
    const tables: GroupTables = {};
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    groups.forEach((g, i) => {
      // pts descending A..L so A's third is best, L's worst.
      tables[g] = tbl([i * 10, i * 10 + 1, i * 10 + 2, i * 10 + 3], { pts: 24 - i, gd: 0, gf: 0 });
    });
    const best = pickBestEightThirds(tables);
    expect(best.teams).toHaveLength(8);
    expect([...best.groups].sort()).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
  });
});

describe("buildRound32", () => {
  it("resolves fixed and third-place slots from the group order + Annex C", () => {
    const tables: GroupTables = {
      A: tbl([1, 2, 3, 4], { pts: 0, gd: 0, gf: 0 }),
      B: tbl([11, 12, 13, 14], { pts: 0, gd: 0, gf: 0 }),
      C: tbl([21, 22, 23, 24], { pts: 0, gd: 0, gf: 0 }),
    };
    const annex = { 79: "C" } as Record<number, import("@/lib/types").Group>;
    const r32 = buildRound32(tables, annex);
    expect(r32[73]).toEqual({ home: 2, away: 12 }); // 2A v 2B (runners)
    expect(r32[79]).toEqual({ home: 1, away: 23 }); // 1A v 3C (winner A, third of C)
  });
});

describe("buildBracket (12 synthetic groups)", () => {
  it("fully populates all 16 Round-of-32 matches", () => {
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    const tables: GroupTables = {};
    groups.forEach((g, i) => {
      tables[g] = tbl([i * 10, i * 10 + 1, i * 10 + 2, i * 10 + 3], { pts: 24 - i, gd: 0, gf: 0 });
    });
    const { round32, bestThirds } = buildBracket(tables);
    expect(bestThirds).toHaveLength(8);
    for (const m of Object.values(round32)) {
      expect(m.home).not.toBeNull();
      expect(m.away).not.toBeNull();
    }
    expect(round32[73]).toEqual({ home: 1, away: 11 }); // 2A v 2B
  });
});

describe("predictedAdvancers", () => {
  it("derives per-stage survival sets and the champion from winner picks", () => {
    const round32: Round32 = {
      73: { home: 1, away: 2 },
      74: { home: 3, away: 4 },
    };
    const picks = { "73": 1, "74": 3, "89": 1, "97": 1, "101": 1, "104": 1 };
    const a = predictedAdvancers(round32, picks);
    expect(a.byStage.round_of_32).toEqual(new Set([1, 2, 3, 4]));
    expect(a.byStage.round_of_16).toEqual(new Set([1, 3]));
    expect(a.byStage.quarter).toEqual(new Set([1]));
    expect(a.byStage.semi).toEqual(new Set([1]));
    expect(a.byStage.final).toEqual(new Set([1]));
    expect(a.champion).toBe(1);
  });
});

describe("buildBracketFromOrder (table-pick model)", () => {
  it("builds the full Round of 32 from a predicted order + 8 chosen thirds", () => {
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    const groupOrder: Record<string, number[]> = {};
    groups.forEach((g, i) => {
      groupOrder[g] = [i * 10, i * 10 + 1, i * 10 + 2, i * 10 + 3];
    });
    const { round32, annex } = buildBracketFromOrder(groupOrder, ["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(Object.keys(annex)).toHaveLength(8);
    for (const m of Object.values(round32)) {
      expect(m.home).not.toBeNull();
      expect(m.away).not.toBeNull();
    }
    expect(round32[73]).toEqual({ home: 1, away: 11 }); // 2A v 2B (runners-up = order[1])
  });

  it("leaves the third-place slots null when fewer than 8 thirds are chosen", () => {
    const { round32, annex } = buildBracketFromOrder({ A: [1, 2, 3, 4], B: [11, 12, 13, 14] }, ["A"]);
    expect(annex).toEqual({});
    expect(round32[73]).toEqual({ home: 2, away: 12 }); // runners still resolve
    expect(round32[79]).toEqual({ home: 1, away: null }); // 1A set, third slot unresolved
  });
});

describe("resolvePredictedBracket (shared editor/recap resolution)", () => {
  const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const groupOrder: Record<string, number[]> = {};
  GROUPS.forEach((g, i) => {
    groupOrder[g] = [i * 10, i * 10 + 1, i * 10 + 2, i * 10 + 3];
  });
  const thirds = ["A", "B", "C", "D", "E", "F", "G", "H"];

  it("resolves all 16 Round-of-32 ties from order + 8 thirds", () => {
    const { participants } = resolvePredictedBracket(groupOrder, thirds, {});
    for (const no of [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88]) {
      expect(participants[no].home).not.toBeNull();
      expect(participants[no].away).not.toBeNull();
    }
    expect(participants[73]).toEqual({ home: 1, away: 11 }); // 2A v 2B (runners)
  });

  it("propagates a winner pick into the next round (73 & 75 feed R16 match 90)", () => {
    const { participants } = resolvePredictedBracket(groupOrder, thirds, { 73: 1, 75: 50 });
    // 90 = W(73) v W(75) per BRACKET_TREE
    expect(participants[90]).toEqual({ home: 1, away: 50 });
  });

  it("drops a pick that isn't one of the tie's two teams", () => {
    const { winners } = resolvePredictedBracket(groupOrder, thirds, { 73: 999 });
    expect(winners[73]).toBeUndefined();
  });

  it("crowns the champion once a full home-advancing path is supplied", () => {
    // Iterate to a fixpoint, always advancing the home team, until 104 resolves.
    let picks: Record<number, number> = {};
    for (let pass = 0; pass < 7; pass++) {
      const { participants } = resolvePredictedBracket(groupOrder, thirds, picks);
      picks = {};
      for (const [no, m] of Object.entries(participants)) {
        if (m.home != null) picks[Number(no)] = m.home;
      }
    }
    const { champion } = resolvePredictedBracket(groupOrder, thirds, picks);
    expect(champion).not.toBeNull();
    expect(champion).toBe(picks[104]);
  });

  it("predictedBracketRounds shapes 5 ordered rounds (16…1 matches)", () => {
    const { rounds } = predictedBracketRounds(groupOrder, thirds, {});
    expect(rounds.map((r) => r.stage)).toEqual([
      "round_of_32",
      "round_of_16",
      "quarter",
      "semi",
      "final",
    ]);
    expect(rounds[0].matches).toHaveLength(16);
    expect(rounds[4].matches).toHaveLength(1);
    expect(rounds[4].matches[0].no).toBe(104);
    // matches ascending by canonical no within a round
    const r32 = rounds[0].matches.map((m) => m.no);
    expect(r32).toEqual([...r32].sort((a, b) => a - b));
  });
});
