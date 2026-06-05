-- Per-user notification category preferences. Opt-out model: a category is ON
-- unless explicitly set to false, so existing users keep getting everything until
-- they tune it. Keys: deadlines, matches, goals, results.
alter table profiles
  add column if not exists notif_prefs jsonb not null default '{}'::jsonb;

-- The full-time-results notification looks up everyone who predicted a given match
-- by match_id alone, which the existing (league_id, …) keys can't serve. Small,
-- and it makes that lookup an index scan instead of a table scan as data grows.
create index if not exists match_predictions_match_idx on match_predictions (match_id);
