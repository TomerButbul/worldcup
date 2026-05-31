-- ===========================================================================
-- LOCAL TEST SEED — fake tournament data so you can exercise everything
-- (brackets, predictions, scoring, leaderboards, favorite-team status, locks)
-- WITHOUT the real tournament or an API-Football key.
--
-- Run in the Supabase SQL editor AFTER migrations 0001–0007.
-- IDs are in the 9000+ range so a later real /api/sync won't collide.
-- Re-runnable (ON CONFLICT DO NOTHING / upserts).
-- To wipe later: delete from teams where id >= 9000; (cascades to matches etc.)
-- ===========================================================================

-- Teams: Group A (9001-9004) fully played, Group B (9005-9008) mixed states.
insert into teams (id, name, code, group_label) values
  (9001, 'Brazil', 'BRA', 'A'),
  (9002, 'Serbia', 'SRB', 'A'),
  (9003, 'Switzerland', 'SUI', 'A'),
  (9004, 'Cameroon', 'CMR', 'A'),
  (9005, 'Argentina', 'ARG', 'B'),
  (9006, 'Mexico', 'MEX', 'B'),
  (9007, 'Poland', 'POL', 'B'),
  (9008, 'Saudi Arabia', 'KSA', 'B')
on conflict (id) do nothing;

-- Players (3 per team) for goal-scorer predictions.
insert into players (id, team_id, name) values
  (90001, 9001, 'Vinicius Jr'), (90002, 9001, 'Rodrygo'),   (90003, 9001, 'Casemiro'),
  (90004, 9002, 'Mitrovic'),    (90005, 9002, 'Tadic'),     (90006, 9002, 'Vlahovic'),
  (90007, 9003, 'Shaqiri'),     (90008, 9003, 'Embolo'),    (90009, 9003, 'Xhaka'),
  (90010, 9004, 'Aboubakar'),   (90011, 9004, 'Choupo'),    (90012, 9004, 'Onana'),
  (90013, 9005, 'Messi'),       (90014, 9005, 'Alvarez'),   (90015, 9005, 'Di Maria'),
  (90016, 9006, 'Lozano'),      (90017, 9006, 'Jimenez'),   (90018, 9006, 'Herrera'),
  (90019, 9007, 'Lewandowski'), (90020, 9007, 'Zielinski'), (90021, 9007, 'Szczesny'),
  (90022, 9008, 'Al-Dawsari'),  (90023, 9008, 'Al-Shehri'), (90024, 9008, 'Al-Owais')
on conflict (id) do nothing;

-- Matches.
-- Group A: all finished -> standings score (top 2: Brazil 9pts, Switzerland 6pts).
insert into matches (id, stage, group_label, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals, goals_synced) values
  (99001, 'group', 'A', '2026-06-01T16:00:00Z', 'finished', 9001, 9002, 2, 0, true),
  (99002, 'group', 'A', '2026-06-01T19:00:00Z', 'finished', 9003, 9004, 2, 1, true),
  (99003, 'group', 'A', '2026-06-05T16:00:00Z', 'finished', 9001, 9003, 1, 0, true),
  (99004, 'group', 'A', '2026-06-05T19:00:00Z', 'finished', 9002, 9004, 1, 1, true),
  (99005, 'group', 'A', '2026-06-09T16:00:00Z', 'finished', 9001, 9004, 3, 1, true),
  (99006, 'group', 'A', '2026-06-09T19:00:00Z', 'finished', 9002, 9003, 0, 1, true),
  -- Group B: two finished, one LIVE, one upcoming (predictable).
  (99007, 'group', 'B', '2026-06-02T16:00:00Z', 'finished', 9005, 9006, 2, 1, true),
  (99008, 'group', 'B', '2026-06-02T19:00:00Z', 'finished', 9007, 9008, 0, 0, true),
  (99009, 'group', 'B', '2026-06-06T16:00:00Z', 'live',     9005, 9007, 1, 0, false),
  (99010, 'group', 'B', '2099-06-20T16:00:00Z', 'scheduled', 9006, 9008, null, null, false),
  -- A knockout fixture so "reached Round of 16" is testable; upcoming so it's predictable.
  (99011, 'round_of_16', null, '2099-06-25T16:00:00Z', 'scheduled', 9001, 9005, null, null, false)
on conflict (id) do nothing;

-- Goal scorers for finished matches (used by live goal-scorer scoring).
insert into match_goals (match_id, player_id) values
  (99001, 90001), (99001, 90002),
  (99002, 90007), (99002, 90008), (99002, 90010),
  (99003, 90001),
  (99004, 90004), (99004, 90010),
  (99005, 90001), (99005, 90002), (99005, 90003), (99005, 90011),
  (99006, 90007),
  (99007, 90013), (99007, 90014), (99007, 90016),
  (99009, 90013)
on conflict do nothing;
