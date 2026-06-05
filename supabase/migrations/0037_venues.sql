-- Stadiums. The fixture sync already receives fixture.venue from API-Football; we
-- just keep it now. id powers the photo (media.api-sports.io/.../venues/{id}.png);
-- name + city come straight off the fixture. Capacity/country are curated for the
-- 16 host venues in lib/venues.ts. No extra API calls in the live pipeline.
alter table matches add column if not exists venue_id int;
alter table matches add column if not exists venue_name text;
alter table matches add column if not exists venue_city text;
