import { describe, it, expect } from "vitest";
import { ROUND32, BRACKET_TREE, THIRD_MATCHES, stageOf } from "@/lib/bracket-core";

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
