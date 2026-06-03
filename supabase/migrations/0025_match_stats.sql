-- 0025: per-team match statistics (possession, shots, passes, etc.) captured
-- from API-Football's fixtures/statistics endpoint, plus the live minute on the
-- match itself. One row per (match, team); `stats` maps the raw API type string
-- (e.g. "Ball Possession", "Shots on Goal", "Total passes") to its value, kept
-- as-is (numbers stay numbers, percentages stay strings like "55%"). Populated
-- for live matches by the lightweight live-sync path and for finished matches by
-- the full sync. Public read (non-sensitive tournament data); writes via the
-- service role only (no insert/update policy).

create table if not exists match_stats (
  match_id int not null references matches (id) on delete cascade,
  team_id  int not null references teams (id) on delete cascade,
  stats    jsonb not null default '{}'::jsonb,
  primary key (match_id, team_id)
);

-- Live minute (e.g. 73). Null for scheduled/finished or when not reported.
alter table matches add column if not exists elapsed int;

alter table match_stats enable row level security;
drop policy if exists "read match stats" on match_stats;
create policy "read match stats" on match_stats for select using (true);
