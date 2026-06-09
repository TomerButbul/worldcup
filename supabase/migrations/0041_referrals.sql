-- 0041_referrals.sql
-- Referral attribution for "The TopCorner Invitational" — the $75 best-bracket
-- skill contest. A single nullable self-reference on profiles records who referred
-- each user. Eligibility for the Invitational is COMPUTED from this graph (you
-- referred at least one real player, OR a real player referred you), so there is
-- NO separate league row and NO gated join to bypass — this one additive column is
-- the entire schema change.
--
-- Safe to apply ahead of the deploy: nothing reads referred_by until the new code
-- ships, and the new code degrades gracefully (treats a missing column as "no
-- referrals") so the order of (apply migration) vs (deploy) cannot break the site.

alter table profiles
  add column if not exists referred_by uuid references profiles (id) on delete set null;

-- Powers the "how many people did X refer?" eligibility + admin-vetting lookups.
create index if not exists profiles_referred_by_idx on profiles (referred_by);

-- A user must never be recorded as referring themselves (the /r/<slug> capture
-- already guards this, but enforce it at the data layer too — defense in depth).
alter table profiles drop constraint if exists profiles_no_self_referral;
alter table profiles
  add constraint profiles_no_self_referral check (referred_by is null or referred_by <> id);
