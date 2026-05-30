-- Track which finished matches have had their goal events imported,
-- so the sync job doesn't refetch events (and burn API quota) every run.
alter table matches add column goals_synced boolean not null default false;
