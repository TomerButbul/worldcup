-- Deeper player enrichment from the /players profiles endpoint: physical + bio
-- data (the /players/squads endpoint doesn't include these). Populated on
-- demand via /api/sync?profiles=1.
alter table players add column if not exists height_cm   int;
alter table players add column if not exists weight_kg   int;
alter table players add column if not exists birth_date  date;
alter table players add column if not exists nationality text;
