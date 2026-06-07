import { describe, it, expect } from "vitest";
import { detectGoals, type GoalGame } from "@/lib/liveGoals";

// A small helper to build a live game row matching the /api/live feed shape.
function game(
  id: number,
  homeGoals: number,
  awayGoals: number,
  opts: { done?: boolean; home?: GoalGame["home"]; away?: GoalGame["away"] } = {},
): GoalGame {
  // Note: distinguish an omitted team (→ default) from an explicit `null` (unknown
  // team). `??` would collapse both, so test `=== undefined` (omitted) only.
  return {
    id,
    done: opts.done ?? false,
    home: opts.home === undefined ? { name: "Home", code: "HOM" } : opts.home,
    away: opts.away === undefined ? { name: "Away", code: "AWY" } : opts.away,
    homeGoals,
    awayGoals,
  };
}

describe("detectGoals", () => {
  it("returns nothing on the first load (no prior baseline)", () => {
    expect(detectGoals([], [game(1, 0, 0), game(2, 1, 1)])).toEqual([]);
  });

  it("returns nothing when scores are unchanged", () => {
    const prev = [game(1, 1, 0), game(2, 2, 2)];
    const next = [game(1, 1, 0), game(2, 2, 2)];
    expect(detectGoals(prev, next)).toEqual([]);
  });

  it("flags a home goal with the scoring team's name and code", () => {
    const prev = [game(1, 0, 0, { home: { name: "United States", code: "USA" } })];
    const next = [game(1, 1, 0, { home: { name: "United States", code: "USA" } })];
    expect(detectGoals(prev, next)).toEqual([
      { gameId: 1, side: "home", teamName: "United States", teamCode: "USA" },
    ]);
  });

  it("flags an away goal", () => {
    const prev = [game(1, 1, 0, { away: { name: "Brazil", code: "BRA" } })];
    const next = [game(1, 1, 1, { away: { name: "Brazil", code: "BRA" } })];
    expect(detectGoals(prev, next)).toEqual([
      { gameId: 1, side: "away", teamName: "Brazil", teamCode: "BRA" },
    ]);
  });

  it("ignores a match it has never seen before (no baseline to diff)", () => {
    const prev = [game(1, 0, 0)];
    const next = [game(1, 0, 0), game(2, 3, 1)]; // game 2 is brand new at 3-1
    expect(detectGoals(prev, next)).toEqual([]);
  });

  it("does NOT celebrate corrections to an already-finished match", () => {
    const prev = [game(1, 1, 0, { done: true })];
    const next = [game(1, 2, 0, { done: true })];
    expect(detectGoals(prev, next)).toEqual([]);
  });

  it("celebrates a winning goal that also ends the match (live → done in one poll)", () => {
    const prev = [game(1, 1, 1, { done: false, home: { name: "Spain", code: "ESP" } })];
    const next = [game(1, 2, 1, { done: true, home: { name: "Spain", code: "ESP" } })];
    expect(detectGoals(prev, next)).toEqual([
      { gameId: 1, side: "home", teamName: "Spain", teamCode: "ESP" },
    ]);
  });

  it("ignores a score going down (data correction)", () => {
    const prev = [game(1, 2, 0)];
    const next = [game(1, 1, 0)];
    expect(detectGoals(prev, next)).toEqual([]);
  });

  it("returns one event per scoring side across multiple games, in feed order", () => {
    const prev = [game(1, 0, 0), game(2, 0, 0)];
    const next = [game(1, 1, 0), game(2, 0, 1)];
    expect(detectGoals(prev, next)).toEqual([
      { gameId: 1, side: "home", teamName: "Home", teamCode: "HOM" },
      { gameId: 2, side: "away", teamName: "Away", teamCode: "AWY" },
    ]);
  });

  it("falls back gracefully when the scoring team is unknown", () => {
    const prev = [game(1, 0, 0, { home: null })];
    const next = [game(1, 1, 0, { home: null })];
    expect(detectGoals(prev, next)).toEqual([
      { gameId: 1, side: "home", teamName: "Goal", teamCode: null },
    ]);
  });
});
