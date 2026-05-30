-- Cosmetic: the national team a user supports (not a prediction).
alter table profiles add column favorite_team_id int references teams (id);
