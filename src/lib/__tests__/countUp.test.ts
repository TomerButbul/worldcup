import { describe, it, expect } from "vitest";
import { easeOutCubic, countUpValue } from "@/lib/countUp";

describe("easeOutCubic", () => {
  it("is pinned at the endpoints", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it("eases out — past the halfway value at the midpoint", () => {
    // 1 - (1-0.5)^3 = 1 - 0.125 = 0.875
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 6);
  });

  it("clamps inputs outside [0,1]", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe("countUpValue", () => {
  it("returns the start value at progress 0", () => {
    expect(countUpValue(12, 17, 0)).toBe(12);
  });

  it("returns the target value at progress 1", () => {
    expect(countUpValue(12, 17, 1)).toBe(17);
  });

  it("rounds to an integer mid-flight", () => {
    const v = countUpValue(0, 10, 0.5); // 10 * 0.875 = 8.75 → 9
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBe(9);
  });

  it("is monotonic non-decreasing as progress grows (counting up)", () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1.0001; p += 0.1) {
      const v = countUpValue(0, 50, p);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("counts down when the target is lower", () => {
    expect(countUpValue(20, 10, 0)).toBe(20);
    expect(countUpValue(20, 10, 1)).toBe(10);
    expect(countUpValue(20, 10, 0.5)).toBe(11); // 20 + (-10)*0.875 = 11.25 → 11
  });

  it("clamps progress past the endpoints", () => {
    expect(countUpValue(5, 9, -0.5)).toBe(5);
    expect(countUpValue(5, 9, 1.5)).toBe(9);
  });
});
