-- Populate teams.fifa_rank with the current (April 2026) FIFA Men's World
-- Ranking for the 48 finalists. The column was added in 0009 but never seeded,
-- so the team-card "FIFA #N" chip was hidden, the bracket group editor defaulted
-- to alphabetical instead of by strength, and the FIFA tiebreaker in scoring was
-- a no-op. Public data (Wikipedia top-19 + ESPN top-50); refresh if it shifts
-- before kickoff. Matched by team code.
update teams t set fifa_rank = v.rank
from (values
  ('FRA', 1), ('SPA', 2), ('ARG', 3), ('ENG', 4), ('POR', 5), ('BRA', 6),
  ('NET', 7), ('MOR', 8), ('BEL', 9), ('GER', 10), ('CRO', 11), ('COL', 13),
  ('SEN', 14), ('MEX', 15), ('USA', 16), ('URU', 17), ('JAP', 18), ('SWI', 19),
  ('IRN', 21), ('TUR', 22), ('ECU', 23), ('AUT', 24), ('KOR', 25), ('AUS', 27),
  ('ALG', 28), ('EGY', 29), ('CAN', 30), ('NOR', 31), ('PAN', 33), ('IVO', 34),
  ('SWE', 38), ('PAR', 40), ('CZE', 41), ('SCO', 43), ('TUN', 44), ('CON', 46),
  ('UZB', 50), ('QAT', 55), ('IRQ', 57), ('SOU', 60), ('SAU', 61), ('JOR', 63),
  ('BOS', 65), ('CAP', 69), ('GHA', 74), ('CUW', 82), ('HAI', 83), ('ZEA', 85)
) as v(code, rank)
where t.code = v.code;
