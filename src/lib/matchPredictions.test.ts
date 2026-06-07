import { describe, expect, test } from "vitest";
import { buildPredRows, type MatchPredictionRow, type BracketPredictionRow } from "./matchPredictions";

// player_id → name / team / photo, for resolving predicted scorers.
const playerById = new Map([
  [100, { name: "Striker A", team_id: 1, photo_url: "a.jpg" }],
  [200, { name: "Winger B", team_id: 2, photo_url: null }],
]);

const prof = (display: string, team: string | null = null, avatar: string | null = null) => ({
  display_name: display,
  team_name: team,
  avatar_url: avatar,
});

describe("buildPredRows — knockout", () => {
  test("maps each prediction to a row with scorers, name and isMe", () => {
    const preds: MatchPredictionRow[] = [
      { user_id: "u-bravo", home_goals: 2, away_goals: 1, scorer_goals: { "100": 2 }, pen_winner_team_id: null, profiles: prof("Bravo") },
      { user_id: "u-alpha", home_goals: 0, away_goals: 0, scorer_goals: {}, pen_winner_team_id: null, profiles: prof("Alpha", "Alpha FC", "x.png") },
    ];
    const rows = buildPredRows({ matchId: 5, isGroup: false, userId: "u-alpha", preds, brackets: [], playerById });

    // Sorted by points (all null → 0) then name asc: "Alpha FC" < "Bravo".
    expect(rows.map((r) => r.userId)).toEqual(["u-alpha", "u-bravo"]);

    const alpha = rows[0];
    expect(alpha).toMatchObject({
      userId: "u-alpha",
      name: "Alpha FC", // team_name wins over display_name
      avatarUrl: "x.png",
      homeGoals: 0,
      awayGoals: 0,
      scorers: [],
      points: null,
      isMe: true,
    });

    const bravo = rows[1];
    expect(bravo.name).toBe("Bravo"); // falls back to display_name
    expect(bravo.isMe).toBe(false);
    expect(bravo.scorers).toEqual([{ name: "Striker A", count: 2, photo: "a.jpg", teamId: 1 }]);
  });

  test("pointsFor populates points and drives the sort (desc)", () => {
    const preds: MatchPredictionRow[] = [
      { user_id: "u-low", home_goals: 0, away_goals: 0, scorer_goals: {}, pen_winner_team_id: null, profiles: prof("Low") },
      { user_id: "u-high", home_goals: 2, away_goals: 1, scorer_goals: {}, pen_winner_team_id: null, profiles: prof("High") },
    ];
    const rows = buildPredRows({
      matchId: 5,
      isGroup: false,
      userId: "u-low",
      preds,
      brackets: [],
      playerById,
      pointsFor: ({ homeGoals }) => (homeGoals === 2 ? 5 : 0),
    });
    expect(rows.map((r) => [r.userId, r.points])).toEqual([
      ["u-high", 5],
      ["u-low", 0],
    ]);
  });

  test("dedupes the same person appearing across multiple leagues", () => {
    const preds: MatchPredictionRow[] = [
      { user_id: "u-1", home_goals: 1, away_goals: 1, scorer_goals: {}, pen_winner_team_id: null, profiles: prof("One") },
      { user_id: "u-1", home_goals: 1, away_goals: 1, scorer_goals: {}, pen_winner_team_id: null, profiles: prof("One") },
    ];
    const rows = buildPredRows({ matchId: 5, isGroup: false, userId: "x", preds, brackets: [], playerById });
    expect(rows).toHaveLength(1);
  });
});

describe("buildPredRows — group", () => {
  test("uses bracket group score, falls back to live scoreline, drops empty picks", () => {
    const brackets: BracketPredictionRow[] = [
      { user_id: "u-bracket", group_scores: { "5": { h: 1, a: 2 } }, profiles: prof("Bracket") },
      { user_id: "u-fallback", group_scores: {}, profiles: prof("Fallback") },
      { user_id: "u-scorer", group_scores: {}, profiles: prof("ScorerOnly") },
      { user_id: "u-empty", group_scores: {}, profiles: prof("Empty") },
    ];
    const preds: MatchPredictionRow[] = [
      // No bracket score for match 5, but a live scoreline exists → fall back to it.
      { user_id: "u-fallback", home_goals: 3, away_goals: 0, scorer_goals: {}, pen_winner_team_id: null, profiles: prof("Fallback") },
      // No score at all, only a scorer pick → still shown.
      { user_id: "u-scorer", home_goals: null, away_goals: null, scorer_goals: { "200": 1 }, pen_winner_team_id: null, profiles: prof("ScorerOnly") },
    ];
    const rows = buildPredRows({ matchId: 5, isGroup: true, userId: "u-scorer", preds, brackets, playerById });

    // u-empty has neither a group score nor scorer picks → excluded entirely.
    const byUser = new Map(rows.map((r) => [r.userId, r]));
    expect(byUser.has("u-empty")).toBe(false);
    expect(rows).toHaveLength(3);

    expect(byUser.get("u-bracket")).toMatchObject({ homeGoals: 1, awayGoals: 2, scorers: [] });
    expect(byUser.get("u-fallback")).toMatchObject({ homeGoals: 3, awayGoals: 0 });
    expect(byUser.get("u-scorer")).toMatchObject({
      homeGoals: null,
      awayGoals: null,
      isMe: true,
      scorers: [{ name: "Winger B", count: 1, photo: null, teamId: 2 }],
    });
  });
});
