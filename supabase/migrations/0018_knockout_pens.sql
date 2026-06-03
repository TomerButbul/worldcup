-- 0018: penalty-shootout predictions for knockout matches.
--   * match_predictions.pen_winner_team_id — the user's predicted advancer when
--     they tip a level scoreline (a knockout can't actually end level).
--   * matches.winner_team_id — the REAL advancer, from API-Football's
--     teams.{home,away}.winner flag (correct for shootouts). Also fixes champion
--     derivation: a final decided on pens no longer crowns the away side.
--   * leagues.scoring gains live.pen_winner (default 2): bonus for calling the
--     shootout winner. Stacks on top of the scoreline points.

alter table match_predictions add column if not exists pen_winner_team_id int;
alter table matches add column if not exists winner_team_id int;

-- New default scoring config (adds live.pen_winner).
alter table leagues alter column scoring set default '{
  "upfront": {"group_exact_score":3,"group_correct_result":1,"group_winner":3,"advance_round_of_32":1,"advance_round_of_16":2,"advance_quarter":4,"advance_semi":6,"advance_final":8,"champion":15,"golden_boot":12,"golden_ball":10,"golden_glove":8,"young_player":8},
  "live": {"exact_score":5,"correct_result":2,"goal_scorer":2,"pen_winner":2}
}'::jsonb;

-- Backfill existing leagues that don't have the key yet.
update leagues
  set scoring = jsonb_set(scoring, '{live,pen_winner}', '2'::jsonb, true)
  where not (scoring -> 'live' ? 'pen_winner');
