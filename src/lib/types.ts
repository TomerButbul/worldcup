export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter"
  | "semi"
  | "third_place"
  | "final";

export type MatchStatus = "scheduled" | "live" | "finished";

export interface Team {
  id: number;
  name: string;
  code: string | null;
  logo_url: string | null;
  group_label: string | null;
}

export interface Player {
  id: number;
  team_id: number | null;
  name: string;
  position?: string | null;
  age?: number | null;
  number?: number | null;
  photo_url?: string | null;
}

export interface Match {
  id: number;
  stage: MatchStage;
  group_label: string | null;
  kickoff_at: string;
  status: MatchStatus;
  home_team_id: number | null;
  away_team_id: number | null;
  home_goals: number | null;
  away_goals: number | null;
}

export interface ScoringConfig {
  upfront: {
    group_exact_score: number;   // nailed the exact group scoreline
    group_correct_result: number; // got W/D/L right
    group_winner: number;         // predicted the group winner correctly
    advance_round_of_32: number;
    advance_round_of_16: number;
    advance_quarter: number;
    advance_semi: number;
    advance_final: number;
    champion: number;
    golden_boot: number;
    golden_ball: number;
    golden_glove: number;
    young_player: number;
  };
  live: {
    exact_score: number;
    correct_result: number;
    goal_scorer: number;
  };
}

export interface League {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
  scoring: ScoringConfig;
  bracket_lock_at: string;
}

export type Group = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

// One predicted scoreline. h = home goals, a = away goals.
export interface MatchScore {
  h: number;
  a: number;
}

// group_scores: { "<db_match_id>": { h, a } } for the 72 group matches.
// knockout: { "<canonical_match_no 73..104>": winnerTeamId } — winner per tie.
export interface BracketPrediction {
  league_id: string;
  user_id: string;
  group_scores: Record<string, MatchScore>;
  knockout: Record<string, number>;
  champion_team_id: number | null;
  submitted_at: string | null;
}

export interface ScoreRow {
  league_id: string;
  user_id: string;
  upfront_points: number;
  live_points: number;
  total_points: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  upfront: {
    group_exact_score: 3,
    group_correct_result: 1,
    group_winner: 3,
    advance_round_of_32: 1,
    advance_round_of_16: 2,
    advance_quarter: 4,
    advance_semi: 6,
    advance_final: 8,
    champion: 15,
    golden_boot: 12,
    golden_ball: 10,
    golden_glove: 8,
    young_player: 8,
  },
  live: {
    exact_score: 5,
    correct_result: 2,
    goal_scorer: 2,
  },
};

export const GROUP_LABELS = "ABCDEFGHIJKL".split(""); // 12 groups, 2026 format
