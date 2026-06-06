import { describe, it, expect } from "vitest";
import { topScorers, topAssists } from "@/lib/tournament-stats";

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
