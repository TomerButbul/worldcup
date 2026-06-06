import { describe, it, expect } from "vitest";
import { topScorers, topAssists, topCleanSheets } from "@/lib/tournament-stats";
import type { AppearanceRow, MatchResult } from "@/lib/tournament-stats";

describe("topScorers", () => {
  it("sums goals per player across matches and ranks by total", () => {
    const rows = [
      { player_id: 1, goals: 2 },
      { player_id: 2, goals: 1 },
      { player_id: 1, goals: 1 }, // player 1 → 3 total
      { player_id: 3, goals: 3 },
    ];
    expect(topScorers(rows)).toEqual([
      { playerId: 1, count: 3 }, // tie on 3 → lower id first (stable)
      { playerId: 3, count: 3 },
      { playerId: 2, count: 1 },
    ]);
  });

  it("drops players with zero goals and tolerates null counts", () => {
    const rows = [
      { player_id: 1, goals: 0 },
      { player_id: 2, goals: null },
      { player_id: 3, goals: 2 },
    ];
    expect(topScorers(rows)).toEqual([{ playerId: 3, count: 2 }]);
  });

  it("breaks ties by player id (stable order)", () => {
    const rows = [
      { player_id: 9, goals: 1 },
      { player_id: 4, goals: 1 },
    ];
    expect(topScorers(rows).map((r) => r.playerId)).toEqual([4, 9]);
  });
});

describe("topAssists", () => {
  it("sums assists per player across matches and ranks by total", () => {
    const rows = [
      { player_id: 5, assists: 1 },
      { player_id: 6, assists: 2 },
      { player_id: 5, assists: 2 }, // player 5 → 3 total
    ];
    expect(topAssists(rows)).toEqual([
      { playerId: 5, count: 3 },
      { playerId: 6, count: 2 },
    ]);
  });
});

describe("topCleanSheets", () => {
  // GK 1 → team 10, GK 2 → team 20, GK 3 → team 30.
  const teamOf = new Map<number, number | null>([
    [1, 10],
    [2, 20],
    [3, 30],
  ]);
  // m100: 10 beat 20 1-0  → GK1 clean sheet, GK2 conceded.
  // m200: 30 vs 20 0-0    → both GK3 and GK2 clean sheets.
  // m300: 10 vs 30 2-1    → nobody clean.
  // m900: not finished    → ignored even though 10 conceded 0.
  const matchById = new Map<number, MatchResult>([
    [100, { home_team_id: 10, away_team_id: 20, home_goals: 1, away_goals: 0, status: "finished" }],
    [200, { home_team_id: 30, away_team_id: 20, home_goals: 0, away_goals: 0, status: "finished" }],
    [300, { home_team_id: 10, away_team_id: 30, home_goals: 2, away_goals: 1, status: "finished" }],
    [900, { home_team_id: 10, away_team_id: 20, home_goals: 0, away_goals: 0, status: "live" }],
  ]);

  it("counts finished matches where the keeper's team conceded zero", () => {
    const apps: AppearanceRow[] = [
      { player_id: 1, match_id: 100, minutes: 90 }, // CS
      { player_id: 2, match_id: 100, minutes: 90 }, // conceded
      { player_id: 3, match_id: 200, minutes: 90 }, // CS
      { player_id: 2, match_id: 200, minutes: 90 }, // CS (0-0)
      { player_id: 1, match_id: 300, minutes: 90 }, // conceded
      { player_id: 3, match_id: 300, minutes: 90 }, // conceded
    ];
    // GK2 = 1 (the 0-0), GK1 = 1, GK3 = 1 — three-way tie broken by id ascending.
    expect(topCleanSheets(apps, teamOf, matchById)).toEqual([
      { playerId: 1, count: 1 },
      { playerId: 2, count: 1 },
      { playerId: 3, count: 1 },
    ]);
  });

  it("ignores benched keepers (0 minutes) and unfinished matches", () => {
    const apps: AppearanceRow[] = [
      { player_id: 1, match_id: 100, minutes: 0 }, // benched → no CS
      { player_id: 1, match_id: 900, minutes: 90 }, // live → no CS
    ];
    expect(topCleanSheets(apps, teamOf, matchById)).toEqual([]);
  });

  it("excludes players absent from the eligibility (keeper) map", () => {
    const apps: AppearanceRow[] = [
      { player_id: 99, match_id: 100, minutes: 90 }, // not a tracked keeper
    ];
    expect(topCleanSheets(apps, teamOf, matchById)).toEqual([]);
  });
});
