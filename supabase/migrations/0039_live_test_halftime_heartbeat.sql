-- 0039: live-sync support for the real-game dress rehearsal + half-time + a heartbeat.
--
-- api_fixture_id : a "proxy" match (sentinel id, hidden from public lists) whose
--   live data is pulled from a REAL API-Football fixture — lets us run a true
--   real-game test before the tournament without exposing it to other users.
-- status_short   : the raw API status (1H/HT/2H/FT/ET/P…) so the UI can show
--   "Half Time" properly and the sync can skip wasted calls during the break.
-- second_half_at : when the 2nd half is expected (HT detected + 15 min) — powers
--   the half-time countdown.
alter table matches add column if not exists api_fixture_id integer;
alter table matches add column if not exists status_short text;
alter table matches add column if not exists second_half_at timestamptz;

-- Heartbeat: each sync mode stamps its last run, so we can confirm the live cron
-- (cron-job.org) is actually firing — and at what cadence — vs. only the 10-min
-- GitHub Action. A 60s gap on mode='live' = the live pinger is alive.
create table if not exists sync_heartbeat (
  mode text primary key,
  last_run timestamptz not null default now(),
  note text
);
