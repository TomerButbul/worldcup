-- 0027: goalkeeper saves on a player's per-match appearance. One more additive
-- column on match_player_stats so the player card can show Saves (for keepers).
-- Summed across a player's rows in playerProfile, exactly like minutes/assists.
-- Clean sheets are NOT stored here — they're derived at read time from the
-- player's appearances + each match's score (team conceded 0). Public read
-- already covers the table (0023); service-role writes only, so no RLS change.

alter table match_player_stats add column if not exists saves int default 0;
