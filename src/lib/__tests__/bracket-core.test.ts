import { describe, it, expect } from "vitest";
import { ROUND32, BRACKET_TREE, THIRD_MATCHES, stageOf, rankThirdPlaceTeams, pickBestEightThirds, type GroupTables } from "@/lib/bracket-core";
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
