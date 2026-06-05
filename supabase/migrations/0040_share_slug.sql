-- 0040_share_slug.sql
-- Public bracket sharing: a stable, unguessable per-user slug powering /b/<slug>,
-- a read-only view of a user's predicted bracket (the "beat my bracket" share that
-- funnels new players to sign up). Additive + idempotent — nothing reads share_slug
-- until the new code ships, so this is safe to apply ahead of the deploy.

alter table profiles add column if not exists share_slug text;

-- Backfill every existing profile with a random 10-char slug.
update profiles
  set share_slug = substr(md5(random()::text || id::text), 1, 10)
  where share_slug is null;

-- New profiles get one automatically on insert.
alter table profiles alter column share_slug set default substr(md5(random()::text), 1, 10);

-- Unguessable + unique; doubles as the lookup index for /b/<slug>.
create unique index if not exists profiles_share_slug_key on profiles (share_slug);
