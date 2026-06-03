-- 0021: most-recent lineup per team (formation + starting XI with pitch grid),
-- so tapping a drafted team shows its latest shape. One row per team, refreshed
-- by the sync from each team's last fixture. Public read; service-role writes.
create table if not exists team_lineups (
  team_id    int primary key,
  formation  text,
  xi         jsonb  not null default '[]'::jsonb, -- [{player_id,name,number,pos,grid}]
  fixture_id bigint,
  updated_at timestamptz not null default now()
);

alter table team_lineups enable row level security;
drop policy if exists "read team lineups" on team_lineups;
create policy "read team lineups" on team_lineups for select using (true);
