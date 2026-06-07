import { describe, it, expect } from "vitest";
import { THIRD_SLOT_ELIGIBILITY, assignThirdsAnnexC } from "@/lib/annex-c";
import { ANNEX_C } from "@/lib/annexCTable";
import type { Group } from "@/lib/types";

const ALL_GROUPS: Group[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const SLOT_MATCHES = [74, 77, 79, 80, 81, 82, 85, 87];

// Enumerate every k-subset of `arr`.
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [head, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map((c) => [head, ...c]),
    ...combinations(rest, k),
  ];
}

describe("Annex C eligibility", () => {
  it("defines eligibility for the eight third-place slots", () => {
    expect(Object.keys(THIRD_SLOT_ELIGIBILITY).map(Number).sort((a, b) => a - b)).toEqual(SLOT_MATCHES);
    expect(THIRD_SLOT_ELIGIBILITY[74]).toEqual(["A", "B", "C", "D", "F"]);
    expect(THIRD_SLOT_ELIGIBILITY[87]).toEqual(["D", "E", "I", "J", "L"]);
  });
});

describe("assignThirdsAnnexC — all 495 combinations", () => {
  const combos = combinations(ALL_GROUPS, 8);

  it("there are exactly 495 combinations", () => {
    expect(combos).toHaveLength(495);
  });

  it("every combination yields a complete, bijective, eligibility-respecting assignment", () => {
    for (const combo of combos) {
      const qualifying = new Set<Group>(combo);
      const assignment = assignThirdsAnnexC(qualifying);

      // all 8 slots filled
      expect(Object.keys(assignment).map(Number).sort((a, b) => a - b)).toEqual(SLOT_MATCHES);
      // bijection: the 8 assigned groups are exactly the qualifying set
      expect(new Set(Object.values(assignment))).toEqual(qualifying);
      // each assignment respects that slot's eligibility list
      for (const m of SLOT_MATCHES) {
        expect(THIRD_SLOT_ELIGIBILITY[m]).toContain(assignment[m]);
      }
    }
  });

  it("is deterministic (same input → same output)", () => {
    const q = new Set<Group>(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(assignThirdsAnnexC(q)).toEqual(assignThirdsAnnexC(q));
  });

  it("throws on a non-8 input", () => {
    expect(() => assignThirdsAnnexC(new Set<Group>(["A", "B"]))).toThrow();
  });
});

describe("assignThirdsAnnexC — matches FIFA's official Annex C table", () => {
  const combos = combinations(ALL_GROUPS, 8);

  it("the official table covers all 495 combinations", () => {
    expect(Object.keys(ANNEX_C)).toHaveLength(495);
  });

  it("returns FIFA's official assignment for every combination (never the fallback)", () => {
    for (const combo of combos) {
      const key = [...combo].sort().join("");
      expect(assignThirdsAnnexC(new Set<Group>(combo))).toEqual(ANNEX_C[key]);
    }
  });

  // Hard-pinned official scenarios (verbatim from FIFA's Annex C) so a bad table
  // regeneration can't silently ship a wrong bracket.
  it("matches specific published scenarios verbatim", () => {
    expect(assignThirdsAnnexC(new Set<Group>(["E", "F", "G", "H", "I", "J", "K", "L"]))).toEqual({
      74: "F", 77: "G", 79: "E", 80: "K", 81: "I", 82: "H", 85: "J", 87: "L",
    });
    expect(assignThirdsAnnexC(new Set<Group>(["A", "B", "C", "D", "E", "F", "G", "H"]))).toEqual({
      74: "C", 77: "F", 79: "H", 80: "E", 81: "B", 82: "A", 85: "G", 87: "D",
    });
  });
});
