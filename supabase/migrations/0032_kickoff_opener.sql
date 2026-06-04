-- Align the bracket lock + the "kickoff in" countdown with the REAL opening match.
-- The synced fixtures put the first match (Mexico v South Africa) at 19:00 UTC on
-- Jun 11; an early placeholder locked everything at 09:00 UTC — 10 hours too early,
-- and 10 hours out of step with the per-match countdowns. Lock at the first whistle.
alter table leagues alter column bracket_lock_at set default '2026-06-11T19:00:00Z';

-- Move every league still on the old placeholder to the actual opener (derived
-- from the fixtures so it stays exact even if the scheduled time shifts).
update leagues
set bracket_lock_at = (select min(kickoff_at) from matches)
where bracket_lock_at = '2026-06-11T09:00:00Z'
  and exists (select 1 from matches);
