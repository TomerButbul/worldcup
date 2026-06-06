import { describe, it, expect } from "vitest";
import { liveGroupStandings, type StandingMatch, type StandingTeam } from "@/lib/tournament-standings";

const team = (id: number, group: string, fifa?: number): StandingTeam => ({ id, group_label: group, fifa_rank: fifa });
const gm = (
  home: number,
  away: number,
  hg: number | null,
  ag: number | null,
  status = "finished",
  group = "A",
): StandingMatch => ({
  stage: "group",
  group_label: group,
  status,
  home_team_id: home,
  away_team_id: away,
  home_goals: hg,
  away_goals: ag,
});

describe("liveGroupStandings", () => {
  it("lists all four teams even before any game is played", () => {
    const teams = [team(1, "A"), team(2, "A"), team(3, "A"), team(4, "A")];
    const tables = liveGroupStandings([], teams);
    expect(tables).toHaveLength(1);
    expect(tables[0].group).toBe("A");
    expect(tables[0].rows).toHaveLength(4);
    expect(tables[0].rows.every((r) => r.played === 0 && r.pts === 0)).toBe(true);
    expect(tables[0].complete).toBe(false);
  });

  it("tallies W/D/L, GF/GA/GD and points from finished matches", () => {
    const teams = [team(1, "A"), team(2, "A"), team(3, "A"), team(4, "A")];
    // 1 beats 2 (3-1); 3 draws 4 (0-0)
    const tables = liveGroupStandings([gm(1, 2, 3, 1), gm(3, 4, 0, 0)], teams);
    const rows = tables[0].rows;
    const byId = new Map(rows.map((r) => [r.teamId, r]));
    expect(byId.get(1)).toMatchObject({ played: 1, won: 1, drawn: 0, lost: 0, gf: 3, ga: 1, gd: 2, pts: 3 });
    expect(byId.get(2)).toMatchObject({ played: 1, won: 0, drawn: 0, lost: 1, gf: 1, ga: 3, gd: -2, pts: 0 });
    expect(byId.get(3)).toMatchObject({ played: 1, drawn: 1, pts: 1, gf: 0, ga: 0 });
    expect(byId.get(4)).toMatchObject({ played: 1, drawn: 1, pts: 1 });
  });

  it("ranks by points then goal difference", () => {
    const teams = [team(1, "A"), team(2, "A"), team(3, "A"), team(4, "A")];
    // team 1 wins 1-0 (gd +1); team 3 wins 3-0 (gd +3); losers split by GD too.
    const tables = liveGroupStandings([gm(1, 2, 1, 0), gm(3, 4, 3, 0)], teams);
    expect(tables[0].rows.map((r) => r.teamId)).toEqual([3, 1, 2, 4]);
  });

  it("breaks points/GD/GF ties by FIFA rank (lower is better)", () => {
    const teams = [team(1, "A", 10), team(2, "A", 5), team(3, "A", 20), team(4, "A", 1)];
    // 1 & 3 both win 1-0 (level pts/gd/gf) → FIFA 10 < 20 → team 1 first.
    // 2 & 4 both lose 0-1 (level)           → FIFA 1 < 5  → team 4 above team 2.
    const tables = liveGroupStandings([gm(1, 2, 1, 0), gm(3, 4, 1, 0)], teams);
    expect(tables[0].rows.map((r) => r.teamId)).toEqual([1, 3, 4, 2]);
  });

  it("ignores live/scheduled matches and knockout fixtures", () => {
    const teams = [team(1, "A"), team(2, "A")];
    const tables = liveGroupStandings(
      [
        gm(1, 2, 2, 0, "live"), // not counted (live)
        { ...gm(1, 2, 9, 0), stage: "round_of_32" }, // not a group match
      ],
      teams,
    );
    expect(tables[0].rows.every((r) => r.played === 0)).toBe(true);
  });

  it("marks a group complete only once every group match is finished", () => {
    const teams = [team(1, "A"), team(2, "A"), team(3, "A"), team(4, "A")];
    const finished = [gm(1, 2, 1, 0), gm(3, 4, 1, 0), gm(1, 3, 1, 0), gm(2, 4, 1, 0), gm(1, 4, 1, 0), gm(2, 3, 1, 0)];
    expect(liveGroupStandings(finished, teams)[0].complete).toBe(true);
    // Drop one to scheduled → incomplete.
    const partial = [...finished.slice(0, 5), { ...finished[5], status: "scheduled", home_goals: null, away_goals: null }];
    expect(liveGroupStandings(partial, teams)[0].complete).toBe(false);
  });

  it("returns groups in label order", () => {
    const teams = [team(1, "C"), team(2, "A"), team(3, "B")];
    const tables = liveGroupStandings([], teams);
    expect(tables.map((t) => t.group)).toEqual(["A", "B", "C"]);
  });
});
