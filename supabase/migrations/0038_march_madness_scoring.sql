-- 0038: March Madness bracket scoring + rebalanced live points.
--
-- The knockout bracket now doubles each round the way an NCAA bracket does:
--   R32 1 · R16 2 · QF 4 · SF 8 · Final 16 · Champion 32
-- Each tier has half as many picks as the one before it, so every round is worth
-- the same 32-point aggregate — nailing the champion is worth as much as calling
-- all 32 first-round teams. Changes vs. the old curve: semi 6->8, final 8->16,
-- champion 25->32 (older leagues had 15), third place 4->8.
--
-- Live (in-running, per match) points scale up to stay balanced against the
-- bigger bracket: knockout exact 5->8, result 2->3, scorer 2->3, pen 2->3, and
-- group exact 2->3. Group result/scorer stay light (72 group games).
--
-- Pre-tournament: every score is still 0, so re-pointing is safe. Existing rows
-- are merged (||) rather than overwritten, preserving any other tuned field.

-- (a) New column default for leagues created from here on — the full config,
--     matching DEFAULT_SCORING in src/lib/types.ts exactly.
alter table leagues alter column scoring set default '{
  "upfront": {
    "group_exact_score": 3,
    "group_correct_result": 1,
    "group_winner": 3,
    "group_position": 1,
    "group_order_bonus": 3,
    "advance_round_of_32": 1,
    "advance_round_of_16": 2,
    "advance_quarter": 4,
    "advance_semi": 8,
    "advance_final": 16,
    "champion": 32,
    "third_place": 8,
    "golden_boot": 12,
    "golden_ball": 10,
    "golden_glove": 8,
    "young_player": 8,
    "sweep_round_of_32": 5,
    "sweep_round_of_16": 8,
    "sweep_quarter": 12,
    "sweep_semi": 15
  },
  "live": {
    "exact_score": 8,
    "correct_result": 3,
    "goal_scorer": 3,
    "pen_winner": 3,
    "group_exact_score": 3,
    "group_correct_result": 1,
    "group_goal_scorer": 1
  }
}'::jsonb;

-- (b) Bring existing leagues onto the new scale. Shallow-merge only the fields
--     that change (incl. adding third_place where it was absent); every other
--     stored field is preserved.
update leagues
set scoring =
  scoring
  || jsonb_build_object(
       'upfront',
       (scoring -> 'upfront')
         || '{"advance_semi":8,"advance_final":16,"champion":32,"third_place":8}'::jsonb
     )
  || jsonb_build_object(
       'live',
       (scoring -> 'live')
         || '{"exact_score":8,"correct_result":3,"goal_scorer":3,"pen_winner":3,"group_exact_score":3}'::jsonb
     );
