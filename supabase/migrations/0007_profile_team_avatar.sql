-- Profile identity: a fantasy "team name" and an uploaded avatar.
alter table profiles add column team_name text;
alter table profiles add column avatar_url text;

-- Public storage bucket for avatars.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone can view avatars; a user may only write files under their own uid folder.
create policy "avatar public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatar own upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar own update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar own delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
