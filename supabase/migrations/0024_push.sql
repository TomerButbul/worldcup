-- 0024: web-push notification subscriptions + a global send-once log so the
-- reminder cron never double-fires the same notification.

create table if not exists push_subscriptions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
-- Users manage only their own subscriptions; the service role (sender) bypasses RLS.
drop policy if exists "own subs" on push_subscriptions;
create policy "own subs" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One row per reminder already sent (e.g. "lock_1h", "match_12345").
create table if not exists notif_sent (
  key     text primary key,
  sent_at timestamptz not null default now()
);
alter table notif_sent enable row level security; -- service-role only; no policies
