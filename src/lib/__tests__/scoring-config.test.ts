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

  it("keeps existing advancement + champion tiers", () => {
    expect(DEFAULT_SCORING.upfront.group_winner).toBe(3);
    expect(DEFAULT_SCORING.upfront.advance_round_of_16).toBe(2);
    expect(DEFAULT_SCORING.upfront.advance_quarter).toBe(4);
    expect(DEFAULT_SCORING.upfront.advance_semi).toBe(6);
    expect(DEFAULT_SCORING.upfront.advance_final).toBe(8);
    expect(DEFAULT_SCORING.upfront.champion).toBe(25);
  });

  it("scores group-stage live games lighter than knockouts", () => {
    expect(DEFAULT_SCORING.live.group_exact_score).toBe(2);
    expect(DEFAULT_SCORING.live.group_correct_result).toBe(1);
    expect(DEFAULT_SCORING.live.group_goal_scorer).toBe(1);
    expect(DEFAULT_SCORING.live.exact_score).toBe(5); // knockout stays full-weight
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
