-- Worldwide "World" league: every account is auto-enrolled, so anyone can make
-- predictions and be ranked globally WITHOUT joining a friends league.
--
-- Why this works with zero new plumbing: picks already mirror to every non-draft
-- league a user is in (see predictionSync.userPredictionLeagueIds + the save
-- actions), and inserting a league_members row auto-creates that user's scores +
-- bracket_predictions rows (the ensure_score_row / on_member_join trigger). So
-- enrolling everyone into one global league means their picks are always stored
-- and scored there, and the global rankings (max total_points per user across
-- leagues) always include them.

-- 1. Allow an ownerless league — the global one has no human owner.
alter table leagues alter column owner_id drop not null;

-- 2. Flag the single global league.
alter table leagues add column if not exists is_global boolean not null default false;

-- 3. Create it (idempotent via the unique join_code). kind defaults to 'regular'
--    (a normal prediction league), so it flows through all the per-league
--    machinery — scoring, mirroring, leaderboard — unchanged.
insert into leagues (name, join_code, owner_id, is_global, kind)
values ('World', 'GLOBAL', null, true, 'regular')
on conflict (join_code) do nothing;

-- 4. Enroll every existing user. on_member_join creates their scores +
--    bracket_predictions rows, so they appear on the global board immediately.
insert into league_members (league_id, user_id)
select g.id, p.id
from leagues g cross join profiles p
where g.is_global
on conflict do nothing;

-- 5. Seed each user's global bracket from their most-recently-updated bracket in
--    any OTHER league, so picks they already made count globally right away (the
--    app's mirror otherwise only copies on the next save). Updates the blank rows
--    that step 4's trigger just created.
with g as (select id from leagues where is_global limit 1),
src as (
  select distinct on (user_id)
    user_id, knockout, champion_team_id, group_scores, awards, group_order, third_qualifiers
  from bracket_predictions
  where league_id <> (select id from g)
  order by user_id, updated_at desc
)
update bracket_predictions bp set
  knockout = src.knockout,
  champion_team_id = src.champion_team_id,
  group_scores = src.group_scores,
  awards = src.awards,
  group_order = src.group_order,
  third_qualifiers = src.third_qualifiers,
  submitted_at = now(),
  updated_at = now()
from src, g
where bp.league_id = g.id and bp.user_id = src.user_id;

-- 6. Seed each user's global match predictions likewise.
insert into match_predictions (league_id, user_id, match_id, home_goals, away_goals, scorer_ids, scorer_goals, pen_winner_team_id, submitted_at)
select (select id from leagues where is_global limit 1),
  mp.user_id, mp.match_id, mp.home_goals, mp.away_goals, mp.scorer_ids, mp.scorer_goals, mp.pen_winner_team_id, now()
from (
  select distinct on (user_id, match_id)
    user_id, match_id, home_goals, away_goals, scorer_ids, scorer_goals, pen_winner_team_id
  from match_predictions
  where league_id <> (select id from leagues where is_global limit 1)
  order by user_id, match_id, submitted_at desc
) mp
on conflict (league_id, user_id, match_id) do update set
  home_goals = excluded.home_goals,
  away_goals = excluded.away_goals,
  scorer_ids = excluded.scorer_ids,
  scorer_goals = excluded.scorer_goals,
  pen_winner_team_id = excluded.pen_winner_team_id,
  submitted_at = now();

-- 7. New signups: enroll into the global league too (extends the profile trigger,
--    keeping its existing profile-creation behaviour intact).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_global uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  select id into v_global from public.leagues where is_global limit 1;
  if v_global is not null then
    insert into public.league_members (league_id, user_id)
    values (v_global, new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
