-- WorldCuP schema: leagues, members, tournament data, predictions, scores
-- 2026 World Cup: 48 teams, 12 groups of 4, 32-team knockout.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type match_stage as enum (
  'group',
  'round_of_32',
  'round_of_16',
  'quarter',
  'semi',
  'third_place',
  'final'
);

create type match_status as enum ('scheduled', 'live', 'finished');

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Leagues (a friend group) + membership
-- ---------------------------------------------------------------------------
create table leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,
  owner_id    uuid not null references profiles (id) on delete cascade,
  -- config-driven scoring (editable per league); see defaults below
  scoring     jsonb not null default '{
    "upfront": {
      "group_winner": 3,
      "group_qualifier": 1,
      "advance_round_of_16": 2,
      "advance_quarter": 4,
      "advance_semi": 6,
      "advance_final": 8,
      "champion": 15
    },
    "live": {
      "exact_score": 5,
      "correct_result": 2,
      "goal_scorer": 2
    }
  }'::jsonb,
  -- predictions lock at tournament kickoff
  bracket_lock_at timestamptz not null default '2026-06-11T16:00:00Z',
  created_at  timestamptz not null default now()
);

create table league_members (
  league_id   uuid not null references leagues (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  role        text not null default 'member', -- 'owner' | 'member'
  joined_at   timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Tournament data (shared globally, synced from API-Football)
-- ---------------------------------------------------------------------------
create table teams (
  id          int primary key,           -- API-Football team id
  name        text not null,
  code        text,                      -- 3-letter code
  logo_url    text,
  group_label text                       -- 'A'..'L' (null until draw known)
);

create table players (
  id          int primary key,           -- API-Football player id
  team_id     int references teams (id) on delete cascade,
  name        text not null
);

create table matches (
  id           int primary key,          -- API-Football fixture id
  stage        match_stage not null,
  group_label  text,                     -- set for group-stage matches
  kickoff_at   timestamptz not null,
  status       match_status not null default 'scheduled',
  home_team_id int references teams (id),
  away_team_id int references teams (id),
  home_goals   int,
  away_goals   int,
  updated_at   timestamptz not null default now()
);

-- goal scorers per finished match (for live scorer predictions)
create table match_goals (
  match_id   int not null references matches (id) on delete cascade,
  player_id  int not null references players (id) on delete cascade,
  primary key (match_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Predictions
-- ---------------------------------------------------------------------------
-- Upfront bracket: one row per user per league.
-- group_standings: { "A": [teamId1, teamId2, teamId3, teamId4], ... } ordered 1st..4th
-- knockout: { "round_of_16": [teamIds], "quarter": [...], "semi": [...], "final": [...] }
-- champion: teamId
create table bracket_predictions (
  league_id      uuid not null references leagues (id) on delete cascade,
  user_id        uuid not null references profiles (id) on delete cascade,
  group_standings jsonb not null default '{}'::jsonb,
  knockout        jsonb not null default '{}'::jsonb,
  champion_team_id int references teams (id),
  submitted_at   timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- Live per-match predictions: predicted score + predicted scorers.
create table match_predictions (
  league_id   uuid not null references leagues (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  match_id    int not null references matches (id) on delete cascade,
  home_goals  int not null,
  away_goals  int not null,
  scorer_ids  int[] not null default '{}',
  submitted_at timestamptz not null default now(),
  primary key (league_id, user_id, match_id)
);

-- ---------------------------------------------------------------------------
-- Scores (materialized per user per league; recomputed by scoring engine)
-- ---------------------------------------------------------------------------
create table scores (
  league_id     uuid not null references leagues (id) on delete cascade,
  user_id       uuid not null references profiles (id) on delete cascade,
  upfront_points int not null default 0,
  live_points    int not null default 0,
  total_points   int generated always as (upfront_points + live_points) stored,
  updated_at    timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index on league_members (user_id);
create index on matches (kickoff_at);
create index on match_predictions (league_id, match_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table leagues             enable row level security;
alter table league_members      enable row level security;
alter table bracket_predictions enable row level security;
alter table match_predictions   enable row level security;
alter table scores              enable row level security;
-- teams/players/matches/match_goals are public read; writes via service role only.
alter table teams        enable row level security;
alter table players      enable row level security;
alter table matches      enable row level security;
alter table match_goals  enable row level security;

-- helper: is the current user a member of a league?
create or replace function is_league_member(lid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from league_members m
    where m.league_id = lid and m.user_id = auth.uid()
  );
$$;

-- profiles: a user manages their own row; members can read each other within shared leagues.
create policy "own profile read/write" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "read profiles in shared leagues" on profiles
  for select using (
    exists (
      select 1 from league_members a
      join league_members b on a.league_id = b.league_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );

-- leagues: members read; owner updates; anyone authenticated can create.
create policy "members read league" on leagues
  for select using (is_league_member(id));
create policy "create league" on leagues
  for insert with check (owner_id = auth.uid());
create policy "owner updates league" on leagues
  for update using (owner_id = auth.uid());

-- league_members: members read; a user can insert their own membership (join).
create policy "members read membership" on league_members
  for select using (is_league_member(league_id));
create policy "join league" on league_members
  for insert with check (user_id = auth.uid());

-- predictions: a user reads/writes only their own; members can read others (for the board).
create policy "own bracket write" on bracket_predictions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members read brackets" on bracket_predictions
  for select using (is_league_member(league_id));

create policy "own match preds write" on match_predictions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members read match preds" on match_predictions
  for select using (is_league_member(league_id));

-- scores: members read; writes by service role only (scoring engine).
create policy "members read scores" on scores
  for select using (is_league_member(league_id));

-- tournament data: public read.
create policy "public read teams"   on teams       for select using (true);
create policy "public read players" on players      for select using (true);
create policy "public read matches" on matches      for select using (true);
create policy "public read goals"   on match_goals  for select using (true);

-- ---------------------------------------------------------------------------
-- Auto-create profile + scores row plumbing
-- ---------------------------------------------------------------------------
-- create a scores row when a user joins a league
create or replace function ensure_score_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into scores (league_id, user_id) values (new.league_id, new.user_id)
  on conflict do nothing;
  insert into bracket_predictions (league_id, user_id) values (new.league_id, new.user_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_member_join
  after insert on league_members
  for each row execute function ensure_score_row();
