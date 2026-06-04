-- 0026: dedup state for LIVE-GOAL push notifications. The live sync pushes a
-- notification when a match's score increases; these columns record the score we
-- last pushed for so the 60s cron is idempotent (each goal fires once) and a
-- VAR-disallowed goal can't wedge the counter. Service-role writes only (the
-- live sync runs with the service key), so no RLS change is needed.

alter table matches add column if not exists notified_home_goals int;
alter table matches add column if not exists notified_away_goals int;
