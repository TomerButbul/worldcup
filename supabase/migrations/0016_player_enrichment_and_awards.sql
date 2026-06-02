-- Player enrichment (from the squads endpoint we already call): position, age,
-- shirt number, photo. Height/weight need the heavier profiles endpoint — TBD.
alter table players add column if not exists position text;
alter table players add column if not exists age int;
alter table players add column if not exists number int;
alter table players add column if not exists photo_url text;

-- Individual award predictions (Golden Boot / Ball / Glove / Young Player),
-- scored into the Upfront game. Shape: { "<award_key>": player_id }.
alter table bracket_predictions add column if not exists awards jsonb not null default '{}'::jsonb;

-- Tournament-wide award winners, entered by the operator at tournament end.
-- (Golden Boot is auto-derived from goal data; a row here overrides it.)
create table if not exists tournament_awards (
  key        text primary key,
  player_id  int references players (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table tournament_awards enable row level security;
drop policy if exists "public read awards" on tournament_awards;
create policy "public read awards" on tournament_awards for select using (true);
