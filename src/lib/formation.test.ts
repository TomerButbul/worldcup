import { describe, expect, test } from "vitest";
import {
  positionXI,
  deriveFormation,
  aggregatePlayerStats,
  applySubs,
  toScorerLineup,
  type FormationPlayer,
  type MatchEvent,
  type TeamLineup,
} from "./formation";

// Build an XI from rows of broad positions, assigning API-Football-style
// "row:col" grids (row 1 = the goalkeeper line, last row = the forwards).
function buildXI(rows: { pos: string; count: number }[]): FormationPlayer[] {
  const xi: FormationPlayer[] = [];
  let id = 1;
  rows.forEach((row, r) => {
    for (let c = 0; c < row.count; c++) {
      xi.push({ player_id: id, name: `P${id}`, number: id, pos: row.pos, grid: `${r + 1}:${c + 1}` });
      id++;
    }
  });
  return xi;
}

const fourThreeThree = () =>
  buildXI([{ pos: "G", count: 1 }, { pos: "D", count: 4 }, { pos: "M", count: 3 }, { pos: "F", count: 3 }]);
const fourFourTwo = () =>
  buildXI([{ pos: "G", count: 1 }, { pos: "D", count: 4 }, { pos: "M", count: 4 }, { pos: "F", count: 2 }]);

describe("positionXI", () => {
  test("places all 11 players within the pitch bounds", () => {
    const pos = positionXI(fourThreeThree(), "single");
    expect(pos).toHaveLength(11);
    for (const p of pos) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });

  test("single team: keeper sits near the bottom, forwards near the top", () => {
    const pos = positionXI(fourThreeThree(), "single");
    const gk = pos.find((p) => p.player.pos === "G")!;
    const fwd = pos.filter((p) => p.player.pos === "F");
    expect(gk.y).toBeGreaterThan(80);
    for (const f of fwd) expect(f.y).toBeLessThan(25);
  });

  // The headline bug fix: on a two-team pitch the most advanced players from each
  // side must NOT collide at the halfway line.
  test("two-team halves never overlap at the centre line", () => {
    const home = positionXI(fourThreeThree(), "home");
    const away = positionXI(fourFourTwo(), "away");
    const closestHome = Math.min(...home.map((p) => p.y)); // home's most advanced player (lowest y)
    const closestAway = Math.max(...away.map((p) => p.y)); // away's most advanced player (highest y)
    expect(closestHome - closestAway).toBeGreaterThanOrEqual(12);
  });

  test("home stays in the bottom half, away in the top half", () => {
    for (const p of positionXI(fourFourTwo(), "home")) expect(p.y).toBeGreaterThan(50);
    for (const p of positionXI(fourFourTwo(), "away")) expect(p.y).toBeLessThan(50);
  });

  test("spreads a back four evenly across the width", () => {
    const defs = positionXI(fourThreeThree(), "single")
      .filter((p) => p.player.pos === "D")
      .map((p) => p.x)
      .sort((a, b) => a - b);
    expect(defs).toEqual([12.5, 37.5, 62.5, 87.5]);
  });

  test("derives detailed labels — a 4-3-3 front three is LW / ST / RW", () => {
    const labels = positionXI(fourThreeThree(), "single")
      .filter((p) => p.player.pos === "F")
      .sort((a, b) => a.x - b.x)
      .map((p) => p.label);
    expect(labels).toEqual(["LW", "ST", "RW"]);
  });

  test("away team mirrors left/right because it faces down the pitch", () => {
    const labels = positionXI(fourThreeThree(), "away")
      .filter((p) => p.player.pos === "F")
      .sort((a, b) => a.x - b.x)
      .map((p) => p.label);
    expect(labels).toEqual(["RW", "ST", "LW"]);
  });
});

describe("deriveFormation", () => {
  test("reads a 4-3-3 back-to-front from the XI", () => {
    expect(deriveFormation(fourThreeThree())).toBe("4-3-3");
  });
});

describe("aggregatePlayerStats", () => {
  test("credits the scorer a goal and the assister an assist", () => {
    const events: MatchEvent[] = [
      { team_id: 1, type: "goal", detail: "Normal Goal", player_id: 9, related_id: 10, minute: 23 },
    ];
    const stats = aggregatePlayerStats(events);
    expect(stats.get(9)).toMatchObject({ goals: 1, assists: 0 });
    expect(stats.get(10)).toMatchObject({ goals: 0, assists: 1 });
  });

  test("a second yellow counts as a red, not a yellow", () => {
    const events: MatchEvent[] = [
      { team_id: 1, type: "card", detail: "Second Yellow card", player_id: 4, related_id: null, minute: 70 },
    ];
    expect(aggregatePlayerStats(events).get(4)).toMatchObject({ yellow: 0, red: 1 });
  });

  test("tallies repeated goals for the same player", () => {
    const goal = (m: number): MatchEvent => ({ team_id: 1, type: "goal", detail: "Normal Goal", player_id: 7, related_id: null, minute: m });
    expect(aggregatePlayerStats([goal(10), goal(55)]).get(7)).toMatchObject({ goals: 2 });
  });
});

describe("applySubs", () => {
  const lineup: TeamLineup = {
    team_id: 1,
    xi: [
      { player_id: 1, name: "Keeper", grid: "1:1", pos: "G" },
      { player_id: 9, name: "Striker", grid: "4:1", pos: "F" },
    ],
    subs: [{ player_id: 20, name: "Sub Striker", grid: null, pos: "F" }],
  };

  test("brings the sub on into the outgoing player's slot", () => {
    const events: MatchEvent[] = [
      { team_id: 1, type: "subst", detail: null, player_id: 20, related_id: 9, minute: 60 },
    ];
    const { onPitch, wentOff, benchRemaining } = applySubs(lineup, events);
    expect(onPitch.map((p) => p.player_id).sort((a, b) => a - b)).toEqual([1, 20]);
    expect(onPitch.find((p) => p.player_id === 20)?.grid).toBe("4:1"); // inherits the slot it replaced
    expect(wentOff.map((p) => p.player_id)).toEqual([9]);
    expect(benchRemaining).toHaveLength(0);
  });

  test("ignores substitutions made by the other team", () => {
    const events: MatchEvent[] = [
      { team_id: 2, type: "subst", detail: null, player_id: 20, related_id: 9, minute: 60 },
    ];
    const { onPitch, benchRemaining } = applySubs(lineup, events);
    expect(onPitch.map((p) => p.player_id).sort((a, b) => a - b)).toEqual([1, 9]);
    expect(benchRemaining.map((p) => p.player_id)).toEqual([20]);
  });
});

describe("toScorerLineup", () => {
  test("maps a match_lineups row into the predict Lineup shape", () => {
    const row = {
      xi: [{ player_id: 9, name: "X", number: 9, pos: "F", grid: "4:1" }],
      subs: [{ player_id: 20, name: "Y", number: 20, pos: "F", grid: null }],
    };
    expect(toScorerLineup(row)).toEqual({
      starters: [9],
      subs: [20],
      xi: [{ player_id: 9, name: "X", pos: "F", grid: "4:1" }],
    });
  });

  test("returns null for a missing row", () => {
    expect(toScorerLineup(null)).toBeNull();
  });
});
