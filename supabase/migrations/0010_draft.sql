-- Draft side-game: a separate "league" (join code DRAFT) where 16 players each
-- draft one team from each of three pots. Pot 1 drafts in seat order 1->16,
-- pots 2 and 3 draft 16->1 (snake). Standings/scoring come later; this migration
-- builds the live draft event: seats, the pick state machine, and admin controls.
--
-- Idempotent (re-runnable) and self-contained so it can be applied ALONE via psql
-- without triggering the still-pending destructive migration 0009.

-- ---------------------------------------------------------------------------
-- 1. League kind + per-member draft seat
-- ---------------------------------------------------------------------------
alter table leagues add column if not exists kind text not null default 'regular';

alter table league_members add column if not exists draft_seat int;

-- A seat (1..16) is held by at most one member per league.
create unique index if not exists league_members_draft_seat_uniq
  on league_members (league_id, draft_seat) where draft_seat is not null;

-- ---------------------------------------------------------------------------
-- 2. Draft state machine (one row per draft league)
-- ---------------------------------------------------------------------------
create table if not exists draft_state (
  league_id          uuid primary key references leagues (id) on delete cascade,
  status             text not null default 'not_started',  -- not_started | in_progress | complete
  current_pick_index int  not null default 0,              -- 0..47, see turn mapping below
  timer_enabled      boolean not null default false,       -- 30s soft clock (client-enforced)
  turn_started_at    timestamptz,                          -- when the on-the-clock turn began
  updated_at         timestamptz not null default now()
);

-- Each pick: which team (pot + slot, slot = 1-based index into the pot's TS list)
-- a user took, and the global pick number it filled.
create table if not exists draft_picks (
  id         bigint generated always as identity primary key,
  league_id  uuid not null references leagues (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  pot        int  not null check (pot between 1 and 3),
  slot       int  not null check (slot between 1 and 16),
  pick_no    int  not null check (pick_no between 0 and 47),
  created_at timestamptz not null default now(),
  unique (league_id, pot, slot),    -- each team drafted once
  unique (league_id, user_id, pot), -- one team per user per pot
  unique (league_id, pick_no)       -- each global pick slot filled once
);

create index if not exists draft_picks_league_idx on draft_picks (league_id);

-- ---------------------------------------------------------------------------
-- 3. RLS: members read; all writes go through the security-definer RPCs below
-- ---------------------------------------------------------------------------
alter table draft_state enable row level security;
alter table draft_picks enable row level security;

drop policy if exists "members read draft state" on draft_state;
create policy "members read draft state" on draft_state
  for select using (is_league_member(league_id));

drop policy if exists "members read draft picks" on draft_picks;
create policy "members read draft picks" on draft_picks
  for select using (is_league_member(league_id));

-- ---------------------------------------------------------------------------
-- 4. Realtime: stream state, picks, and seat changes to clients (RLS applies).
--    league_members is included so the lobby shows live seat claims.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['draft_state', 'draft_picks', 'league_members'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Pick-order math (snake): global index 0..47 -> (pot, seat).
--    within = idx % 16; pot = idx / 16 + 1.
--    pot 1 picks seat (within + 1); pots 2 & 3 pick seat (16 - within).
-- ---------------------------------------------------------------------------
create or replace function draft_seat_for_index(p_index int, out pot int, out seat int)
language plpgsql immutable as $$
declare
  v_within int := p_index % 16;
begin
  pot := p_index / 16 + 1;
  if pot = 1 then
    seat := v_within + 1;
  else
    seat := 16 - v_within;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Player RPC: claim your own seat (only before the draft starts)
-- ---------------------------------------------------------------------------
create or replace function claim_seat(p_league uuid, p_seat int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_seat < 1 or p_seat > 16 then
    raise exception 'seat must be between 1 and 16';
  end if;
  if not exists (select 1 from leagues where id = p_league and kind = 'draft') then
    raise exception 'not a draft league';
  end if;
  if not exists (select 1 from league_members where league_id = p_league and user_id = v_uid) then
    raise exception 'not a member of this league';
  end if;
  if (select status from draft_state where league_id = p_league) <> 'not_started' then
    raise exception 'draft already started';
  end if;
  if exists (
    select 1 from league_members
    where league_id = p_league and draft_seat = p_seat and user_id <> v_uid
  ) then
    raise exception 'seat % is already taken', p_seat;
  end if;

  update league_members
    set draft_seat = p_seat
    where league_id = p_league and user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Internal: apply one pick and advance the clock. Assumes caller is the RPC
--    layer; locks draft_state so concurrent picks serialize.
-- ---------------------------------------------------------------------------
create or replace function draft_apply_pick(p_league uuid, p_slot int, p_enforce_owner boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status     text;
  v_idx        int;
  v_pot        int;
  v_seat       int;
  v_seat_user  uuid;
  v_slot       int;
  v_new_index  int;
begin
  select status, current_pick_index into v_status, v_idx
    from draft_state where league_id = p_league
    for update;

  if v_status is null then
    raise exception 'draft does not exist';
  end if;
  if v_status <> 'in_progress' then
    raise exception 'draft is not in progress';
  end if;

  select pot, seat into v_pot, v_seat from draft_seat_for_index(v_idx);

  select user_id into v_seat_user
    from league_members where league_id = p_league and draft_seat = v_seat;
  if v_seat_user is null then
    raise exception 'seat % has no player', v_seat;
  end if;
  if p_enforce_owner and v_seat_user <> auth.uid() then
    raise exception 'it is not your turn';
  end if;

  if p_slot is null then
    -- admin "force random": choose any team still available in this pot.
    select s into v_slot
      from generate_series(1, 16) s
      where not exists (
        select 1 from draft_picks
        where league_id = p_league and pot = v_pot and slot = s
      )
      order by random()
      limit 1;
    if v_slot is null then
      raise exception 'no teams left in pot %', v_pot;
    end if;
  else
    v_slot := p_slot;
  end if;

  if v_slot < 1 or v_slot > 16 then
    raise exception 'slot must be between 1 and 16';
  end if;
  if exists (
    select 1 from draft_picks where league_id = p_league and pot = v_pot and slot = v_slot
  ) then
    raise exception 'that team is already drafted';
  end if;

  insert into draft_picks (league_id, user_id, pot, slot, pick_no)
  values (p_league, v_seat_user, v_pot, v_slot, v_idx);

  v_new_index := v_idx + 1;
  update draft_state
    set current_pick_index = v_new_index,
        status = case when v_new_index >= 48 then 'complete' else 'in_progress' end,
        turn_started_at = case when v_new_index >= 48 then null else now() end,
        updated_at = now()
    where league_id = p_league;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Player RPC: make the pick for your own turn
-- ---------------------------------------------------------------------------
create or replace function make_pick(p_league uuid, p_slot int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_slot is null then
    raise exception 'slot is required';
  end if;
  perform draft_apply_pick(p_league, p_slot, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Admin RPCs (league owner only)
-- ---------------------------------------------------------------------------
create or replace function draft_is_owner(p_league uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from leagues where id = p_league and owner_id = auth.uid());
$$;

-- Start the draft: requires all 16 seats filled.
create or replace function admin_open_draft(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not draft_is_owner(p_league) then
    raise exception 'only the league owner can open the draft';
  end if;
  if (select status from draft_state where league_id = p_league) <> 'not_started' then
    raise exception 'draft already started';
  end if;
  if (
    select count(*) from league_members
    where league_id = p_league and draft_seat is not null
  ) <> 16 then
    raise exception 'all 16 seats must be filled before opening the draft';
  end if;

  update draft_state
    set status = 'in_progress',
        current_pick_index = 0,
        turn_started_at = now(),
        updated_at = now()
    where league_id = p_league;
end;
$$;

-- Owner override of a seat assignment (only before start).
create or replace function admin_set_seat(p_league uuid, p_user uuid, p_seat int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not draft_is_owner(p_league) then
    raise exception 'only the league owner can set seats';
  end if;
  if p_seat < 1 or p_seat > 16 then
    raise exception 'seat must be between 1 and 16';
  end if;
  if (select status from draft_state where league_id = p_league) <> 'not_started' then
    raise exception 'draft already started';
  end if;
  if not exists (select 1 from league_members where league_id = p_league and user_id = p_user) then
    raise exception 'that user is not a member of this league';
  end if;

  -- Free the seat if someone else holds it, then assign it.
  update league_members set draft_seat = null
    where league_id = p_league and draft_seat = p_seat and user_id <> p_user;
  update league_members set draft_seat = p_seat
    where league_id = p_league and user_id = p_user;
end;
$$;

-- Force the current pick: a specific team (p_slot) or a random available one (null).
create or replace function admin_force_pick(p_league uuid, p_slot int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not draft_is_owner(p_league) then
    raise exception 'only the league owner can force a pick';
  end if;
  perform draft_apply_pick(p_league, p_slot, false);
end;
$$;

-- Toggle the 30s soft clock on/off mid-draft.
create or replace function admin_toggle_timer(p_league uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not draft_is_owner(p_league) then
    raise exception 'only the league owner can toggle the timer';
  end if;
  update draft_state
    set timer_enabled = p_enabled,
        turn_started_at = case when p_enabled then now() else turn_started_at end,
        updated_at = now()
    where league_id = p_league;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Execute privileges: public-facing RPCs to authenticated; internals private
-- ---------------------------------------------------------------------------
revoke all on function draft_apply_pick(uuid, int, boolean) from public;
revoke all on function draft_seat_for_index(int) from public;

revoke all on function claim_seat(uuid, int) from public;
grant execute on function claim_seat(uuid, int) to authenticated;

revoke all on function make_pick(uuid, int) from public;
grant execute on function make_pick(uuid, int) to authenticated;

revoke all on function draft_is_owner(uuid) from public;
grant execute on function draft_is_owner(uuid) to authenticated;

revoke all on function admin_open_draft(uuid) from public;
grant execute on function admin_open_draft(uuid) to authenticated;

revoke all on function admin_set_seat(uuid, uuid, int) from public;
grant execute on function admin_set_seat(uuid, uuid, int) to authenticated;

revoke all on function admin_force_pick(uuid, int) from public;
grant execute on function admin_force_pick(uuid, int) to authenticated;

revoke all on function admin_toggle_timer(uuid, boolean) from public;
grant execute on function admin_toggle_timer(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Seed the draft league (owner = admin account). Skipped if the admin
--     hasn't signed up yet; safe to re-run.
-- ---------------------------------------------------------------------------
do $$
declare
  v_owner  uuid;
  v_league uuid;
begin
  select id into v_owner from auth.users where email = 'tomerbutbuleast@gmail.com' limit 1;
  if v_owner is null then
    raise notice 'draft seed skipped: admin tomerbutbuleast@gmail.com not found';
    return;
  end if;

  insert into profiles (id, display_name)
  values (v_owner, 'Tomer')
  on conflict (id) do nothing;

  select id into v_league from leagues where join_code = 'DRAFT';
  if v_league is null then
    insert into leagues (name, join_code, owner_id, kind)
    values ('The Draft', 'DRAFT', v_owner, 'draft')
    returning id into v_league;
  end if;

  insert into league_members (league_id, user_id, role)
  values (v_league, v_owner, 'owner')
  on conflict (league_id, user_id) do nothing;

  insert into draft_state (league_id)
  values (v_league)
  on conflict (league_id) do nothing;
end $$;
