-- Broadcast score and match changes to connected clients via Supabase Realtime.
-- RLS still applies to realtime, so members only receive rows they can read.
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table matches;
