-- Bracket redesign: scoreline-driven group stage + fixed knockout template.
-- Pre-launch (kickoff 2026-06-11): no real predictions to preserve, so reset
-- bracket_predictions to the new shape rather than back-fill.

-- 1. Teams: FIFA world ranking for the deterministic deep tiebreak (§5).
--    Nullable; populated by a later sync. The engine falls back to team-id
--    order when a rank is null, so correctness never depends on this being set.
alter table teams add column if not exists fifa_rank int;

-- 2. Leagues scoring config.
--    a) New default for leagues created from now on.
alter table leagues alter column scoring set default '{
  "upfront": {
    "group_exact_score": 3,
    "group_correct_result": 1,
    "group_winner": 3,
    "advance_round_of_32": 1,
    "advance_round_of_16": 2,
    "advance_quarter": 4,
    "advance_semi": 6,
    "advance_final": 8,
    "champion": 15
  },
  "live": {
    "exact_score": 5,
    "correct_result": 2,
    "goal_scorer": 2
  }
}'::jsonb;

--    b) Migrate existing rows in place: drop group_qualifier, add the three new
--       tiers, preserving any per-league customisation of the other values.
update leagues set scoring = jsonb_set(
  jsonb_set(
    jsonb_set(
      (scoring #- '{upfront,group_qualifier}'),
      '{upfront,group_exact_score}', '3'
    ),
    '{upfront,group_correct_result}', '1'
  ),
  '{upfront,advance_round_of_32}', '1'
);

-- 3. bracket_predictions: store predicted scorelines; knockout becomes
--    { "<canonical_match_no>": winnerTeamId }. Drop the derived group_standings.
alter table bracket_predictions
  add column if not exists group_scores jsonb not null default '{}'::jsonb;
alter table bracket_predictions
  drop column if exists group_standings;

comment on column bracket_predictions.group_scores is
  '{ "<db_match_id>": { "h": int, "a": int } } predicted scorelines for the 72 group matches';
comment on column bracket_predictions.knockout is
  '{ "<canonical_match_no 73..104>": winnerTeamId } predicted winner of each knockout tie';

-- 4. Pre-launch reset: no stored row should carry the old shape.
update bracket_predictions
  set group_scores = '{}'::jsonb,
      knockout = '{}'::jsonb,
      champion_team_id = null,
      submitted_at = null;
