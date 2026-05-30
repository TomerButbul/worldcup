-- Atomic league create/join via SECURITY DEFINER (bypasses RLS safely).
-- Needed because a user is not yet a member when creating/joining, so the
-- "members read league" SELECT policy would otherwise hide the row.

create or replace function create_league(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_id    uuid;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i       int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;

  -- generate a unique 6-char join code
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from leagues where join_code = v_code);
  end loop;

  insert into leagues (name, join_code, owner_id)
  values (trim(p_name), v_code, v_uid)
  returning id into v_id;

  insert into league_members (league_id, user_id, role)
  values (v_id, v_uid, 'owner');

  return v_id;
end;
$$;

create or replace function join_league_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select id into v_id from leagues where join_code = upper(trim(p_code));
  if v_id is null then raise exception 'invalid join code'; end if;

  insert into league_members (league_id, user_id)
  values (v_id, v_uid)
  on conflict do nothing;

  return v_id;
end;
$$;

revoke all on function create_league(text) from public;
revoke all on function join_league_by_code(text) from public;
grant execute on function create_league(text) to authenticated;
grant execute on function join_league_by_code(text) to authenticated;
