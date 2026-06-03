-- 0020: live match visuals. Lineups (formation + pitch grid coords) and a
-- per-player event timeline (goals/assists/cards/subs), populated for live
-- matches by the lightweight live-sync path. Display-only — scoring still uses
-- match_goals. Public read (non-sensitive tournament data); writes via service
-- role only (no insert/update policy).

create table if not exists match_lineups (
  match_id   bigint not null references matches (id) on delete cascade,
  team_id    int    not null,
  formation  text,
  xi         jsonb  not null default '[]'::jsonb, -- [{player_id,name,number,pos,grid}]
  subs       jsonb  not null default '[]'::jsonb, -- [{player_id,name,number,pos}]
  updated_at timestamptz not null default now(),
  primary key (match_id, team_id)
);

create table if not exists match_events (
  id           bigint generated always as identity primary key,
  match_id     bigint not null references matches (id) on delete cascade,
  team_id      int,
  type         text   not null,            -- goal | card | subst
  detail       text,
  player_id    int,
  player_name  text,
  related_id   int,                        -- assist giver, or the player coming OFF
  related_name text,
  minute       int,
  sort         int    not null default 0,
  updated_at   timestamptz not null default now()
);
create index if not exists match_events_match_idx on match_events (match_id);

alter table match_lineups enable row level security;
alter table match_events  enable row level security;

drop policy if exists "read lineups" on match_lineups;
create policy "read lineups" on match_lineups for select using (true);
drop policy if exists "read events" on match_events;
create policy "read events" on match_events for select using (true);

-- Realtime so the pitch can update without a full refetch (optional consumer).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_lineups') then
    execute 'alter publication supabase_realtime add table match_lineups';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_events') then
    execute 'alter publication supabase_realtime add table match_events';
  end if;
end $$;
