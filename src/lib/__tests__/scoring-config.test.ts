import { describe, it, expect } from "vitest";
import { DEFAULT_SCORING } from "@/lib/types";

describe("DEFAULT_SCORING", () => {
  it("has the new group-accuracy and R32 tiers", () => {
    expect(DEFAULT_SCORING.upfront.group_exact_score).toBe(3);
    expect(DEFAULT_SCORING.upfront.group_correct_result).toBe(1);
    expect(DEFAULT_SCORING.upfront.advance_round_of_32).toBe(1);
  });

  it("drops the redundant group_qualifier tier", () => {
    expect("group_qualifier" in DEFAULT_SCORING.upfront).toBe(false);
  });

  it("uses March Madness advancement values (1-2-4-8-16-32)", () => {
    expect(DEFAULT_SCORING.upfront.group_winner).toBe(3);
    expect(DEFAULT_SCORING.upfront.advance_round_of_32).toBe(1);
    expect(DEFAULT_SCORING.upfront.advance_round_of_16).toBe(2);
    expect(DEFAULT_SCORING.upfront.advance_quarter).toBe(4);
    expect(DEFAULT_SCORING.upfront.advance_semi).toBe(8);
    expect(DEFAULT_SCORING.upfront.advance_final).toBe(16);
    expect(DEFAULT_SCORING.upfront.champion).toBe(32);
    expect(DEFAULT_SCORING.upfront.third_place).toBe(8);
  });

  it("doubles every knockout tier (equal aggregate weight per round)", () => {
    const u = DEFAULT_SCORING.upfront;
    const tiers = [
      u.advance_round_of_32,
      u.advance_round_of_16,
      u.advance_quarter,
      u.advance_semi,
      u.advance_final,
      u.champion,
    ];
    for (let i = 1; i < tiers.length; i++) expect(tiers[i]).toBe(tiers[i - 1] * 2);
  });

  it("scales live points up but keeps group games lighter than knockouts", () => {
    expect(DEFAULT_SCORING.live.exact_score).toBe(8); // knockout exact
    expect(DEFAULT_SCORING.live.correct_result).toBe(3);
    expect(DEFAULT_SCORING.live.goal_scorer).toBe(3);
    expect(DEFAULT_SCORING.live.pen_winner).toBe(3);
    expect(DEFAULT_SCORING.live.group_exact_score).toBe(3);
    expect(DEFAULT_SCORING.live.group_correct_result).toBe(1);
    expect(DEFAULT_SCORING.live.group_goal_scorer).toBe(1);
    expect(DEFAULT_SCORING.live.group_exact_score).toBeLessThan(DEFAULT_SCORING.live.exact_score);
  });

  it("defines group-order point defaults", () => {
    expect(DEFAULT_SCORING.upfront.group_position).toBe(1);
    expect(DEFAULT_SCORING.upfront.group_order_bonus).toBe(3);
  });

  it("defines stage-sweep bonus defaults", () => {
    expect(DEFAULT_SCORING.upfront.sweep_round_of_32).toBe(5);
    expect(DEFAULT_SCORING.upfront.sweep_round_of_16).toBe(8);
    expect(DEFAULT_SCORING.upfront.sweep_quarter).toBe(12);
    expect(DEFAULT_SCORING.upfront.sweep_semi).toBe(15);
  });
});
