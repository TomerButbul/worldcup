-- 0019: index players by team. The players table is frequently read scoped to a
-- team (match summary, and the live-pitch lineup view), and at scale an unindexed
-- team_id filter is a seq scan of the full squad list.
create index if not exists players_team_id_idx on players (team_id);
