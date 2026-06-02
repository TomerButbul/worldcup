-- Yellow/red cards per match, captured from the same fixture-events call that
-- already imports goals (so no extra API quota). A player can receive more than
-- one card (e.g. two yellows -> a red), so the PK is a surrogate id rather than
-- (match_id, player_id); the sync deletes+reinserts a match's cards to stay
-- idempotent across re-runs.
create table match_cards (
  id         bigint generated always as identity primary key,
  match_id   int  not null references matches (id) on delete cascade,
  player_id  int  references players (id) on delete set null,
  team_id    int  references teams (id) on delete set null,
  type       text not null check (type in ('yellow', 'red')),
  minute     int,
  created_at timestamptz not null default now()
);
create index on match_cards (match_id);

-- Tournament data: public read, writes via service role only (sync job).
alter table match_cards enable row level security;
create policy "public read cards" on match_cards for select using (true);
