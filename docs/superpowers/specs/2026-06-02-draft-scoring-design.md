# Draft side-game — scoring & standings

Authoritative rules for the 3-pot draft scoring (task #34). Captured here so
they survive context compaction.

## Structure
- 16 managers; **3 pots** (Pot 1 = "Good", Pot 2 = "Mid", Pot 3 = "Long shots").
  Each manager drafts exactly one team per pot.
- **Each pot is its own independent competition.** Pots are NOT weighted
  against each other and do NOT combine into a single "real" result.

## Per-team progress points
A drafted team earns points by how far it advances in the tournament:

| Reached            | Points |
| ------------------ | ------ |
| Group stage exit   | 0      |
| Round of 32        | 1      |
| Round of 16        | 2      |
| Quarter-final      | 4      |
| Semi-final         | 6      |
| Final (runner-up)  | 8      |
| Champion           | 12     |

*(Scale is a config constant — easy to tweak.)*

## Standings
- **Per pot (the real competitions):** rank the 16 managers by their pot-team's
  progress points.
  - 🏆 **Pot winner** = most points.
  - 🥄 **Wooden Spoon** = fewest points — a funny booby prize for the loser.
- **Final total — BRAGGING RIGHTS ONLY:** sum of each manager's 3 teams'
  points across all pots, ranked. **Does not affect** the three pot
  competitions; it's just a fun aggregate.
- **Tiebreakers:** points, then regular (name).

## Implementation notes
- Draft teams are a hardcoded pool (`DRAFT_POTS` in `lib/draft.ts`, names +
  emoji). To score progress they must map to the real synced `teams` (by id),
  via a normalized name match + an alias table for known mismatches
  (e.g. "South Korea" → "Korea Republic", "Côte d'Ivoire" → "Ivory Coast").
- Furthest stage comes from `computeActuals().advancers` + `champion`.
- Scoring is a pure function (`lib/draft-scoring.ts`) with unit tests; the draft
  results view renders the 3 pot tables + the bragging-rights total. Pre-results
  everyone sits at 0 and fills in as the tournament plays (live auto-refresh).
