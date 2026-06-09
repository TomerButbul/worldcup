-- 0044_open_invitational.sql
-- Open the Invitational to everyone. It changes from referral-GATED to "every player
-- is in; the more who join, the bigger the prize pool." We drop the eligibility gate,
-- enroll every existing account, and make new signups auto-join — exactly like the
-- global "World" league. The /r/<slug> referral links still work for growth; they
-- just no longer gate entry. (0042's is_prize flag + reset columns stay untouched.)

-- 1. Remove the referral gate + the referral-triggered enrol.
drop trigger if exists guard_prize_membership_t on league_members;
drop trigger if exists on_referral_change_t on profiles;

-- 2. enroll_in_prize no longer checks eligibility — anyone can be a member. It still
--    copies their current global bracket in so they rank immediately.
create or replace function enroll_in_prize(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prize  uuid;
  v_global uuid;
begin
  select id into v_prize from leagues where is_prize limit 1;
  if v_prize is null then return; end if;

  insert into league_members (league_id, user_id) values (v_prize, uid) on conflict do nothing;

  select id into v_global from leagues where is_global limit 1;
  if v_global is null then return; end if;

  update bracket_predictions bp set
    knockout         = src.knockout,
    champion_team_id = src.champion_team_id,
    group_scores     = src.group_scores,
    awards           = src.awards,
    group_order      = src.group_order,
    third_qualifiers = src.third_qualifiers,
    submitted_at     = now(),
    updated_at       = now()
  from bracket_predictions src
  where bp.league_id = v_prize and bp.user_id = uid
    and src.league_id = v_global and src.user_id = uid;

  insert into match_predictions
    (league_id, user_id, match_id, home_goals, away_goals, scorer_ids, scorer_goals, pen_winner_team_id, submitted_at)
  select v_prize, mp.user_id, mp.match_id, mp.home_goals, mp.away_goals, mp.scorer_ids, mp.scorer_goals, mp.pen_winner_team_id, now()
  from match_predictions mp
  where mp.league_id = v_global and mp.user_id = uid
  on conflict (league_id, user_id, match_id) do update set
    home_goals = excluded.home_goals, away_goals = excluded.away_goals,
    scorer_ids = excluded.scorer_ids, scorer_goals = excluded.scorer_goals,
    pen_winner_team_id = excluded.pen_winner_team_id, submitted_at = now();
end;
$$;

-- 3. Enroll every existing account.
select enroll_in_prize(id) from profiles;

-- 4. New signups auto-join the Invitational too (extends the global-enrol trigger;
--    keeps its profile-creation + global-enrol behaviour intact).
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

  select id into v_prize from public.leagues where is_prize limit 1;
  if v_prize is not null then
    insert into public.league_members (league_id, user_id) values (v_prize, new.id) on conflict do nothing;
  end if;

  return new;
end;
$$;
