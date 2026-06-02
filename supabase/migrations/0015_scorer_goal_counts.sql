-- Per-scorer goal counts. Predictions record how many goals each player gets
-- (scorer_goals: { "<player_id>": count }); actuals track goals-per-player so
-- those counts can be scored (goal_scorer x min(predicted, actual)). The legacy
-- scorer_ids array stays (the save action keeps it in sync with the map keys)
-- for backward compatibility.
alter table match_predictions add column if not exists scorer_goals jsonb not null default '{}'::jsonb;

-- One row per (match, player) already; add how many that player scored.
alter table match_goals add column if not exists goals int not null default 1;
