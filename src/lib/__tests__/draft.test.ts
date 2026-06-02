import { describe, it, expect } from "vitest";
import { turnFor, teamAt, DRAFT_POTS, SEATS, TOTAL_PICKS } from "@/lib/draft";

describe("turnFor", () => {
  it("maps the snake-draft boundaries (matches draft_seat_for_index in SQL)", () => {
    expect(turnFor(0)).toEqual({ pot: 1, seat: 1 });
    expect(turnFor(15)).toEqual({ pot: 1, seat: 16 });
    expect(turnFor(16)).toEqual({ pot: 2, seat: 16 });
    expect(turnFor(31)).toEqual({ pot: 2, seat: 1 });
    expect(turnFor(32)).toEqual({ pot: 3, seat: 16 });
    expect(turnFor(47)).toEqual({ pot: 3, seat: 1 });
  });

  it("pot 1 ascends seats 1->16", () => {
    for (let i = 0; i < SEATS; i++) {
      expect(turnFor(i)).toEqual({ pot: 1, seat: i + 1 });
    }
  });

  it("pots 2 and 3 descend seats 16->1", () => {
    for (let i = 0; i < SEATS; i++) {
      expect(turnFor(SEATS + i)).toEqual({ pot: 2, seat: SEATS - i });
      expect(turnFor(2 * SEATS + i)).toEqual({ pot: 3, seat: SEATS - i });
    }
  });

  it("covers every (pot, seat) exactly once across all 48 picks", () => {
    const seen = new Set<string>();
    for (let i = 0; i < TOTAL_PICKS; i++) {
      const { pot, seat } = turnFor(i);
      seen.add(`${pot}-${seat}`);
    }
    expect(seen.size).toBe(TOTAL_PICKS);
  });
});

describe("teamAt", () => {
  it("resolves 1-based slots into the pot list", () => {
    expect(teamAt(1, 1)).toEqual(DRAFT_POTS[1][0]);
    expect(teamAt(2, 16)).toEqual(DRAFT_POTS[2][15]);
    expect(teamAt(3, 8)).toEqual(DRAFT_POTS[3][7]);
  });

  it("returns undefined for out-of-range slots or pots", () => {
    expect(teamAt(1, 0)).toBeUndefined();
    expect(teamAt(1, 17)).toBeUndefined();
    expect(teamAt(4, 1)).toBeUndefined();
  });
});

describe("DRAFT_POTS", () => {
  it("has 16 teams in each pot", () => {
    expect(DRAFT_POTS[1]).toHaveLength(SEATS);
    expect(DRAFT_POTS[2]).toHaveLength(SEATS);
    expect(DRAFT_POTS[3]).toHaveLength(SEATS);
  });
});
