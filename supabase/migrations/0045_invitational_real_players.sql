-- 0045_invitational_real_players.sql
-- The Invitational is the REAL-players prize board. Global ("World") stays "everyone"
-- — humans + guests + the AI mascot accounts (a lively board) — but the Invitational
-- holds only real human competitors, since the cash goes to the top of it.
--
-- AI/bot accounts are identified by their /mascots/ avatar. Guests by is_guest.

-- 1. Remove guests + mascot/AI accounts from the prize league: membership AND their
--    prize scoring rows, so they vanish from its leaderboard entirely.
delete from league_members
where league_id = (select id from leagues where is_prize limit 1)
  and user_id in (select id from profiles where is_guest = true or avatar_url like '/mascots/%');

delete from scores
where league_id = (select id from leagues where is_prize limit 1)
  and user_id in (select id from profiles where is_guest = true or avatar_url like '/mascots/%');

delete from bracket_predictions
where league_id = (select id from leagues where is_prize limit 1)
  and user_id in (select id from profiles where is_guest = true or avatar_url like '/mascots/%');

delete from match_predictions
where league_id = (select id from leagues where is_prize limit 1)
  and user_id in (select id from profiles where is_guest = true or avatar_url like '/mascots/%');

-- 2. New signups: real accounts auto-join the Invitational; guests join the global
--    board only (keeps its profile-creation + global-enrol behaviour intact).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_global uuid;
  v_prize  uuid;
begin
  insert into public.profiles (id, display_name, is_guest)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Guest'
    ),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;

  select id into v_global from public.leagues where is_global limit 1;
  if v_global is not null then
    insert into public.league_members (league_id, user_id) values (v_global, new.id) on conflict do nothing;
  end if;

  -- Real (non-anonymous) accounts only get the Invitational.
  if not coalesce(new.is_anonymous, false) then
    select id into v_prize from public.leagues where is_prize limit 1;
    if v_prize is not null then
      insert into public.league_members (league_id, user_id) values (v_prize, new.id) on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- 3. When a guest UPGRADES to a full account, add them to the Invitational and copy
--    their picks in (enroll_in_prize copies their global bracket so they rank).
create or replace function on_guest_upgrade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_guest is distinct from new.is_guest and new.is_guest = false then
    perform enroll_in_prize(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_guest_upgrade_t on profiles;
create trigger on_guest_upgrade_t
  after update of is_guest on profiles
  for each row execute function on_guest_upgrade();
