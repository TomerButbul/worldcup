-- Table-pick upfront model (replaces 72 group scorelines).
-- Instead of predicting every group scoreline, a manager predicts each group's
-- finishing ORDER (1st→4th) and which 8 third-placed teams advance. The bracket
-- derives from the order; per-match scores move to live match predictions.
--
-- group_order:       { "A": [teamId,teamId,teamId,teamId], ... }  (predicted 1st→4th)
-- third_qualifiers:  ["A","C","E", ...]  (the 8 groups whose 3rd-placed team advances)
--
-- group_scores is kept (nullable, default '{}') for back-compat while the new
-- model rolls out; it is no longer the source of truth for bracket derivation.
alter table bracket_predictions
  add column if not exists group_order      jsonb not null default '{}'::jsonb,
  add column if not exists third_qualifiers jsonb not null default '[]'::jsonb;
