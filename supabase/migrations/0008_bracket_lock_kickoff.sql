-- Lock every bracket at the real 2026 World Cup kickoff: noon Israel time
-- (IDT = UTC+3 in June) == 2026-06-11 09:00 UTC. Keep in sync with KICKOFF_MS
-- in src/lib/clock.ts.
alter table leagues alter column bracket_lock_at set default '2026-06-11T09:00:00Z';

-- Pre-launch: realign existing leagues to the new kickoff instant.
update leagues set bracket_lock_at = '2026-06-11T09:00:00Z';
