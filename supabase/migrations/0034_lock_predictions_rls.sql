-- Cheat-proofing: enforce the prediction lock at the DATABASE level, not just in
-- the app's save actions. Previously RLS allowed a user to write their OWN
-- prediction row at ANY time (only "is it your row" was checked), so a technical
-- user could bypass the server action and POST a prediction straight to the data
-- API for a match that had already kicked off / finished. Now Postgres itself
-- rejects any insert/update of a prediction once the relevant match (or the
-- bracket) has locked — using now() (the DB clock), which no client can fake.
--
-- SELECT is unchanged (the existing "members read ..." policies still let you and
-- your league-mates read picks); only writes gain the time guard.

-- ── match predictions: lock at that match's own kickoff ──────────────────────
drop policy if exists "own match preds write" on match_predictions;

create policy "insert own match preds" on match_predictions
  for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from matches m where m.id = match_id and m.kickoff_at > now())
  );

create policy "update own match preds" on match_predictions
  for update
  using (
    user_id = auth.uid()
    and exists (select 1 from matches m where m.id = match_id and m.kickoff_at > now())
  )
  with check (user_id = auth.uid());

-- ── upfront bracket + awards: lock at the league's bracket_lock_at (the opener) ─
drop policy if exists "own bracket write" on bracket_predictions;

create policy "insert own bracket" on bracket_predictions
  for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from leagues l where l.id = league_id and l.bracket_lock_at > now())
  );

create policy "update own bracket" on bracket_predictions
  for update
  using (
    user_id = auth.uid()
    and exists (select 1 from leagues l where l.id = league_id and l.bracket_lock_at > now())
  )
  with check (user_id = auth.uid());
