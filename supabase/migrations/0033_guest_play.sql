-- Guest play: a visitor can start predicting instantly via an anonymous Supabase
-- session, then "upgrade" by adding an email (keeps every pick). Two needs:
--   1) anonymous users have no email, so give them a friendly default name and
--      flag them, so the global board can hide them until they convert;
--   2) keep the global-league auto-enrolment from 0031 intact.

alter table profiles add column if not exists is_guest boolean not null default false;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_global uuid;
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

  -- Auto-enroll every account (guests included) into the worldwide league so they
  -- can predict + be ranked without joining a friends league.
  select id into v_global from public.leagues where is_global limit 1;
  if v_global is not null then
    insert into public.league_members (league_id, user_id)
    values (v_global, new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
