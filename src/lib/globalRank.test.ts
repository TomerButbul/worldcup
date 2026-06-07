import { describe, it, expect } from "vitest";
import { globalRankOf } from "./globalRank";

// `ranks` arrives already in board order (best score first), exactly as
// getCachedGlobalRankings returns it — so the rank is just the 1-based position.
const ranks = [
  { user_id: "a" },
  { user_id: "b" },
  { user_id: "c" },
  { user_id: "d" },
];

describe("globalRankOf", () => {
  it("returns the 1-based position and the field size", () => {
    expect(globalRankOf(ranks, "c")).toEqual({ rank: 3, total: 4 });
  });

  it("ranks the leader 1st", () => {
    expect(globalRankOf(ranks, "a")).toEqual({ rank: 1, total: 4 });
  });

  it("returns null when the user isn't on the board (e.g. a hidden guest)", () => {
    expect(globalRankOf(ranks, "zzz")).toBeNull();
  });

  it("returns null for an empty board", () => {
    expect(globalRankOf([], "a")).toBeNull();
  });
});
