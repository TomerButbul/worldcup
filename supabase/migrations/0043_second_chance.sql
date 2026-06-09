-- 0043_second_chance.sql
-- Two-phase bracket lock + the "second chance" reset.
--
-- The group bracket locks at kickoff; the knockout bracket stays editable until the
-- Round of 32 starts. `reset_at` is the single flag: when set, the player has
-- FORFEITED their group-table points in exchange for a fresh knockout they can edit
-- until R32. Late joiners (who never committed a group bracket before kickoff) live
-- in that same editable, no-group-points state by default — the app derives that
-- from submitted_at vs kickoff, so it needs no flag. `original_bracket` keeps a
-- read-only snapshot of what they had before resetting (for memories).
--
-- Additive + idempotent — safe to apply anytime.

alter table bracket_predictions add column if not exists reset_at timestamptz;
alter table bracket_predictions add column if not exists original_bracket jsonb;

-- Rebalance the group bracket to ~13% of a strong knockout (the Monte-Carlo number)
-- on every existing league — new leagues inherit it from DEFAULT_SCORING. Touch only
-- the three group-table keys; every other scoring value is preserved.
update leagues
set scoring = jsonb_set(jsonb_set(jsonb_set(
  scoring,
  '{upfront,group_winner}', '1'::jsonb),
  '{upfront,group_position}', '0'::jsonb),
  '{upfront,group_order_bonus}', '0'::jsonb)
where scoring is not null;
