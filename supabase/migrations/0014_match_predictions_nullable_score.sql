-- Hybrid live predictions: for group-stage matches the live game captures goal
-- scorers ONLY — the scoreline is owned by the upfront bracket (so it isn't
-- scored twice). Those group picks therefore store no live scoreline, so the
-- score columns become nullable. Knockout picks still require a scoreline
-- (enforced in the savePrediction server action, not at the column level).
alter table match_predictions alter column home_goals drop not null;
alter table match_predictions alter column away_goals drop not null;
