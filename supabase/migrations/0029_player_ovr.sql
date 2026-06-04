-- EA FC 26 overall rating per player, for a beginner-friendly "who's better"
-- gold badge on player cards and pitch tiles. Seeded best-effort by name+nation
-- match (0030); null when a player isn't in the FC 26 database.
alter table players add column if not exists ovr int;
