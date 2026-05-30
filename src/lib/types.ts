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
    group_winner: number;
    group_qualifier: number;
    advance_round_of_16: number;
    advance_quarter: number;
    advance_semi: number;
    advance_final: number;
    champion: number;
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

// group_standings: { "A": [teamId1..4] ordered 1st..4th }
// knockout: which teams a player predicts to reach each round
export interface BracketPrediction {
  league_id: string;
  user_id: string;
  group_standings: Record<string, number[]>;
  knockout: {
    round_of_16?: number[];
    quarter?: number[];
    semi?: number[];
    final?: number[];
  };
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
    group_winner: 3,
    group_qualifier: 1,
    advance_round_of_16: 2,
    advance_quarter: 4,
    advance_semi: 6,
    advance_final: 8,
    champion: 15,
  },
  live: {
    exact_score: 5,
    correct_result: 2,
    goal_scorer: 2,
  },
};

export const GROUP_LABELS = "ABCDEFGHIJKL".split(""); // 12 groups, 2026 format
