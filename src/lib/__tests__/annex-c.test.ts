import { describe, it, expect } from "vitest";
import { THIRD_SLOT_ELIGIBILITY, assignThirdsAnnexC } from "@/lib/annex-c";
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
