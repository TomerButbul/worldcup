import { describe, it, expect } from "vitest";
import { computeFavStatus } from "@/lib/favoriteStatus";
import type { Match, Team } from "@/lib/types";

const teams: Team[] = [
  { id: 1, name: "Brazil", code: "BRA", logo_url: null, group_label: "A" },
  { id: 2, name: "Spain", code: "ESP", logo_url: null, group_label: "A" },
  { id: 3, name: "Japan", code: "JPN", logo_url: null, group_label: "B" },
];

const PAST = "2026-06-01T16:00:00Z";
const FUTURE = "2099-06-20T16:00:00Z";

function match(p: Partial<Match> & { id: number }): Match {
  return {
    id: p.id,
    stage: p.stage ?? "group",
    group_label: p.group_label ?? "A",
    kickoff_at: p.kickoff_at ?? PAST,
    status: p.status ?? "finished",
    home_team_id: p.home_team_id ?? null,
    away_team_id: p.away_team_id ?? null,
    home_goals: p.home_goals ?? null,
    away_goals: p.away_goals ?? null,
  };
}

describe("computeFavStatus", () => {
  it("returns null for an unknown team", () => {
    expect(computeFavStatus(999, teams, [])).toBeNull();
  });

  it("reports a win with a good mood", () => {
    const s = computeFavStatus(1, teams, [
      match({ id: 1, home_team_id: 1, away_team_id: 2, home_goals: 3, away_goals: 1 }),
    ])!;
    expect(s.mood).toBe("good");
    expect(s.last?.outcome).toBe("W");
    expect(s.headline).toMatch(/won/i);
  });

  it("computes goals-for/against from the team's perspective when away", () => {
    const s = computeFavStatus(2, teams, [
      match({ id: 1, home_team_id: 1, away_team_id: 2, home_goals: 3, away_goals: 1 }),
    ])!;
    expect(s.last).toMatchObject({ gf: 1, ga: 3, outcome: "L" });
  });

  it("a group-stage loss does not mark the team eliminated", () => {
    const s = computeFavStatus(2, teams, [
      match({ id: 1, home_team_id: 1, away_team_id: 2, home_goals: 2, away_goals: 0 }),
    ])!;
    expect(s.eliminated).toBe(false);
    expect(s.mood).toBe("bad");
  });

  it("a knockout loss with no upcoming match marks elimination", () => {
    const s = computeFavStatus(2, teams, [
      match({ id: 1, stage: "round_of_16", group_label: null, home_team_id: 1, away_team_id: 2, home_goals: 2, away_goals: 1 }),
    ])!;
    expect(s.eliminated).toBe(true);
    expect(s.headline).toMatch(/knocked out/i);
  });

  it("detects champions when they win the final", () => {
    const s = computeFavStatus(1, teams, [
      match({ id: 1, stage: "final", group_label: null, home_team_id: 1, away_team_id: 2, home_goals: 2, away_goals: 0 }),
    ])!;
    expect(s.champion).toBe(true);
    expect(s.mood).toBe("good");
    expect(s.headline).toMatch(/champions/i);
  });

  it("surfaces the next fixture when nothing has been played", () => {
    const s = computeFavStatus(1, teams, [
      match({ id: 9, status: "scheduled", kickoff_at: FUTURE, home_team_id: 1, away_team_id: 3 }),
    ])!;
    expect(s.last).toBeNull();
    expect(s.next?.opponentName).toBe("Japan");
  });

  it("prefers the most recent finished match as 'last'", () => {
    const s = computeFavStatus(1, teams, [
      match({ id: 1, kickoff_at: "2026-06-01T16:00:00Z", home_team_id: 1, away_team_id: 2, home_goals: 0, away_goals: 1 }),
      match({ id: 2, kickoff_at: "2026-06-05T16:00:00Z", home_team_id: 1, away_team_id: 3, home_goals: 4, away_goals: 0 }),
    ])!;
    expect(s.last?.gf).toBe(4);
    expect(s.last?.outcome).toBe("W");
  });
});
