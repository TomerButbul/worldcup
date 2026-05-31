import { describe, it, expect } from "vitest";
import { mapStage, mapStatus } from "@/lib/apiFootball";

describe("mapStage", () => {
  it.each([
    ["Group Stage - 1", "group"],
    ["Group A - 2", "group"],
    ["Round of 32", "round_of_32"],
    ["Round of 16", "round_of_16"],
    ["Quarter-finals", "quarter"],
    ["Semi-finals", "semi"],
    ["3rd Place Final", "third_place"],
    ["Final", "final"],
  ])("maps %s -> %s", (round, expected) => {
    expect(mapStage(round)).toBe(expected);
  });

  it("falls back to group for unknown rounds", () => {
    expect(mapStage("Mystery Round")).toBe("group");
  });
});

describe("mapStatus", () => {
  it.each([
    ["FT", "finished"],
    ["AET", "finished"],
    ["PEN", "finished"],
    ["1H", "live"],
    ["HT", "live"],
    ["2H", "live"],
    ["ET", "live"],
    ["NS", "scheduled"],
    ["TBD", "scheduled"],
  ])("maps %s -> %s", (short, expected) => {
    expect(mapStatus(short)).toBe(expected);
  });
});
