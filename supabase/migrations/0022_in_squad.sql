-- 0022: flag players that are in their team's CURRENT (World Cup) squad. The
-- squad sync resets this to false then re-flags the named squad, so cut players
-- and friendly-only call-ups drop out of "WC players" filters everywhere.
alter table players add column if not exists in_squad boolean not null default false;
create index if not exists players_in_squad_idx on players (team_id) where in_squad;
