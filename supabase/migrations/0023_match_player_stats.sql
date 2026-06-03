-- 0023: per-player participation in a finished match. One row = the player
-- appeared (started, or came on as a sub). Powers the player card's tournament
-- Appearances (row count), Minutes (sum), and Assists (sum). Goals stay in
-- match_goals and cards in match_cards. Public read (non-sensitive tournament
-- data); writes via the service role only (no insert/update policy).

create table if not exists match_player_stats (
  match_id   bigint not null references matches (id) on delete cascade,
  player_id  bigint not null,
  minutes    int    not null default 0,
  assists    int    not null default 0,
  primary key (match_id, player_id)
);
create index if not exists match_player_stats_player_idx on match_player_stats (player_id);

alter table match_player_stats enable row level security;
drop policy if exists "read player stats" on match_player_stats;
create policy "read player stats" on match_player_stats for select using (true);
