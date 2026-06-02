-- Group-stage match rows were synced without a group_label, but both the scoring
-- engine (computeGroupTables skips group matches with a null group_label) and the
-- bracket editor key off it. Both teams in a group match always share a group, so
-- backfill the column from the home team. Idempotent.
update matches m
   set group_label = t.group_label
  from teams t
 where m.stage = 'group'
   and m.home_team_id = t.id
   and m.group_label is distinct from t.group_label;
