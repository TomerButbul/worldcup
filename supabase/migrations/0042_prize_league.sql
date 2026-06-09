-- 0042_prize_league.sql
-- Turn "The TopCorner Invitational" into a REAL league that shows up in the Leagues
-- hub like any other — just gated by referrals. Built on the same machinery as the
-- global "World" league (0031): an ownerless flagged league row, the on_member_join
-- trigger that materializes scores + bracket rows, and the app's pick-mirroring.
--
-- Difference vs global: membership is NOT automatic. You're enrolled the moment you
-- become referral-eligible (you referred a real player, OR a real player referred
-- you), and a data-layer guard blocks anyone else from joining. Eligible users get
-- their current bracket copied in so they rank immediately.
--
-- Idempotent + additive — safe to run once via the Supabase SQL editor.

-- 1. Flag column (mirrors is_global).
alter table leagues add column if not exists is_prize boolean not null default false;

-- 2. Seed the prize league (ownerless, regular kind so it flows through scoring,
--    mirroring and the leaderboard unchanged). Idempotent via the unique join_code.
insert into leagues (name, join_code, owner_id, is_prize, kind)
values ('The TopCorner Invitational', 'INVITE', null, true, 'regular')
on conflict (join_code) do nothing;

-- 3. Referral eligibility — the single source of truth in SQL (mirrors
--    src/lib/prizeEligibility.ts): a real (non-guest) account that either referred a
--    real player or was referred by one.
create or replace function is_referral_eligible(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select not is_guest from profiles where id = uid), false)
     and (
       exists (select 1 from profiles where referred_by = uid and is_guest = false)
       or (select referred_by from profiles where id = uid) is not null
     );
$$;

-- 4. Enroll one user in the prize league (idempotent). Silently no-ops if they're
--    not eligible, so it can never trip the guard in step 5. On enrollment we copy
--    their CURRENT global bracket + match predictions in, so their real picks score
--    immediately (the app mirror keeps them in sync on every later save). This is the
--    same copy 0031 did for the global league.
create or replace function enroll_in_prize(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_prize  uuid;
  v_global uuid;
begin
  if not is_referral_eligible(uid) then return; end if;

  select id into v_prize from leagues where is_prize limit 1;
  if v_prize is null then return; end if;

  -- on_member_join materializes blank scores + bracket rows for this membership.
  insert into league_members (league_id, user_id) values (v_prize, uid)
  on conflict do nothing;

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
    home_goals         = excluded.home_goals,
    away_goals         = excluded.away_goals,
    scorer_ids         = excluded.scorer_ids,
    scorer_goals       = excluded.scorer_goals,
    pen_winner_team_id = excluded.pen_winner_team_id,
    submitted_at       = now();
end;
$$;

-- 5. Data-layer gate: nobody can land in the prize league unless they're eligible.
--    enroll_in_prize (step 4) only inserts eligible users so it passes cleanly; this
--    blocks a direct/RLS self-insert by an ineligible account.
create or replace function guard_prize_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from leagues where id = new.league_id and is_prize)
     and not is_referral_eligible(new.user_id) then
    raise exception 'not eligible for the prize league';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_prize_membership_t on league_members;
create trigger guard_prize_membership_t
  before insert on league_members
  for each row execute function guard_prize_membership();

-- 6. Auto-enroll on referral. When referred_by is set (or a referred guest upgrades
--    to a real account), enroll BOTH sides: the referred player (was referred) and
--    the referrer (now has a real referral). Fires for app attribution AND any manual
--    AMOE grant done by setting referred_by in SQL.
create or replace function on_referral_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by is null then return new; end if;
  if coalesce(new.is_guest, false) then return new; end if; -- guests aren't eligible
  perform enroll_in_prize(new.id);
  perform enroll_in_prize(new.referred_by);
  return new;
end;
$$;

drop trigger if exists on_referral_change_t on profiles;
create trigger on_referral_change_t
  after insert or update of referred_by, is_guest on profiles
  for each row execute function on_referral_change();

-- 7. Backfill everyone already eligible (e.g. the launch test referral) so they're in
--    the league the moment this runs.
select enroll_in_prize(p.id) from profiles p where is_referral_eligible(p.id);
