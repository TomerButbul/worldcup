-- Performance indexes for the hot read paths.
--
-- Supabase/Postgres best practice: index every column combination used to filter
-- or sort that the table's primary key can't already serve. These are additive
-- and idempotent (safe to re-run); the tables are small today so they build
-- instantly, and they keep the hot queries fast as data grows.

-- The account-level prediction model mirrors a user's picks across every league
-- they're in, so the Home page reads "my predictions for today's matches" by
-- (user_id, match_id) with NO league_id. The (league_id, user_id, match_id)
-- primary key leads with league_id and can't serve that, forcing a scan. This
-- composite serves it directly and also covers user_id-only lookups via its prefix.
create index if not exists match_predictions_user_match_idx
  on match_predictions (user_id, match_id);

-- Every league page renders its leaderboard as: scores filtered by league_id,
-- ordered by total_points DESC. The (league_id, user_id) PK returns the rows but
-- not in order, so Postgres has to sort them in memory. This index returns them
-- pre-sorted (no sort step) and scales cleanly as a league grows. total_points is
-- a STORED generated column, which is indexable.
create index if not exists scores_league_total_idx
  on scores (league_id, total_points desc);
