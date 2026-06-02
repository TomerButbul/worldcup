# Upfront Bracket Redesign — Design Spec

- **Date:** 2026-06-01
- **Status:** Draft for review
- **Area:** `src/app/leagues/[id]/bracket/*`, `src/lib/scoring-core.ts`, `src/lib/types.ts`, `supabase/migrations/*`

## 1. Problem

The current upfront bracket does not match the real 2026 World Cup format and lets users
make impossible predictions:

1. **The Round of 32 is missing.** `BracketEditor.tsx` starts the knockout at the Round of 16.
   The 2026 tournament has 48 teams and a 32-team first knockout round. The DB enum and the
   `matches` table already know `round_of_32`; the editor and scoring config do not.
2. **Knockout picks are free-form.** Users select any teams into each round from a global pool.
   In reality the knockout bracket is a **fixed template** keyed to group finishing positions —
   once standings are known, every matchup is determined. The current model can't represent
   "Winner C vs Runner-up F" or derive any team's path.
3. **The group stage is just an ordering.** Users drag each group 1st–4th. This can't drive the
   real third-place qualification (which needs points / goal difference / goals scored), so the
   eight best third-placed teams can't be derived.
4. **Scoring has no Round-of-32 tier** and computes standings with only points → GD → GF (no
   head-to-head), so it does not reproduce FIFA's real ordering.

## 2. Goals & non-goals

**Goals**

- Predict the group stage by **scoreline** (all 72 group matches), entered upfront.
- **Derive** group standings, the best-8 third-placed teams, and the full fixed knockout bracket
  from those scorelines using FIFA's exact rules.
- Let users **pick the winner of each knockout tie** down a real, populated bracket tree
  (Round of 32 → Final), crowning a champion.
- Reproduce FIFA's tiebreaker ladder as far as match scores allow (everything except the
  unpredictable disciplinary / drawing-of-lots criteria).
- Add the missing **Round-of-32** scoring tier; keep knockout scoring **forgiving** (survival).
- Reuse the existing design system and the existing pure/testable scoring core.

**Non-goals**

- Predicting **goal scorers** upfront. Scorers stay in the existing matchday "Match predictions"
  feature (predicting scorers for 72 group games upfront is too heavy).
- Modeling **extra time / penalties** in the bracket. The user only picks a winner per tie.
- Predicting the **third-place playoff** (match 103). Out of scope; optional later.
- Reworking the live matchday prediction feature beyond the integration described in §8.

## 3. Decisions (settled during brainstorming)

| Decision | Choice |
|---|---|
| Bracket fidelity | **Exact FIFA** — fixed template + official Annex C third-place table |
| Group input | **Predict scorelines** for all 72 group matches, upfront |
| Third-place selection | **Auto-derived** from predicted scores (FIFA's best-8 method) |
| Knockout scoring "feel" | **Forgiving** (survival: points per team that reaches each round) + new R32 tier |
| Goal scorers | Stay in the **live matchday** feature, not the upfront bracket |

> The "forgiving" knockout choice is the recommended default and fits the existing engine. It is
> easy to retune or switch to matchup-based scoring later; values are per-league config.

## 4. Reference data — the real 2026 knockout bracket

48 teams → 12 groups (A–L) of 4 → top 2 of each group (24) + 8 best third-placed teams (8) = **32**.

### 4.1 Round of 32 (matches 73–88)

Slots are written as `1X` = winner of group X, `2X` = runner-up of group X, `3[…]` = a third-placed
team from one of the listed groups (resolved by Annex C, §7).

| Match | Home | Away |
|---|---|---|
| 73 | 2A | 2B |
| 74 | 1E | 3[A/B/C/D/F] |
| 75 | 1F | 2C |
| 76 | 1C | 2F |
| 77 | 1I | 3[C/D/F/G/H] |
| 78 | 2E | 2I |
| 79 | 1A | 3[C/E/F/H/I] |
| 80 | 1L | 3[E/H/I/J/K] |
| 81 | 1D | 3[B/E/F/I/J] |
| 82 | 1G | 3[A/E/H/I/J] |
| 83 | 2K | 2L |
| 84 | 1H | 2J |
| 85 | 1B | 3[E/F/G/I/J] |
| 86 | 1J | 2H |
| 87 | 1K | 3[D/E/I/J/L] |
| 88 | 2D | 2G |

Eight matches are fully fixed (winner/runner-up only); the other eight each pair a group winner
with one of the eight best third-placed teams — that is how all eight thirds enter the bracket.

### 4.2 Bracket tree (fixed)

```
R16:  89 = W74 v W77   90 = W73 v W75   91 = W76 v W78   92 = W79 v W80
      93 = W83 v W84   94 = W81 v W82   95 = W86 v W88   96 = W85 v W87
QF:   97 = W89 v W90   98 = W93 v W94   99 = W91 v W92  100 = W95 v W96
SF:  101 = W97 v W98  102 = W99 v W100
3rd: 103 = L101 v L102
Final: 104 = W101 v W102        (champion = winner of 104)
```

## 5. Tiebreaker ladder (exact FIFA 2026)

**Ranking teams within a group** (after points in all group matches):

1. Points in head-to-head matches among the tied teams
2. Goal difference in those head-to-head matches
3. Goals scored in those head-to-head matches
4. Goal difference in all group matches
5. Goals scored in all group matches
6. Fair-play / disciplinary "conduct" score *(not derivable from scores)*
7. FIFA world ranking
8. Drawing of lots *(random)*

> Head-to-head (1–3) is applied only among teams still tied; if it separates some but not all
> teams, it is re-applied to the still-tied subset.

**Ranking third-placed teams across groups** (best 8 of 12 advance):

1. Points → 2. Goal difference → 3. Goals scored → 4. Conduct *(not derivable)* →
5. FIFA world ranking → 6. Drawing of lots *(random)*

**Derivability.** Every criterion that depends on match results (points, GD, goals, head-to-head)
is computed **exactly** from predicted scorelines. FIFA world ranking is a known per-team value we
can include as a deterministic tiebreak. The **only** criteria we cannot reproduce are the
disciplinary "conduct" score (needs predicted cards) and drawing of lots (random). These matter
only when teams are dead-level on every score-based criterion *and* FIFA ranking — vanishingly rare
and unpredictable by anyone. **This is the sole, inherent gap between the engine and reality.**

## 6. End-to-end flow

**What the player fills in (once, before the tournament; locked at `bracket_lock_at`):**

1. **Group stage:** the scoreline of all 72 group matches (12 groups × 6).
2. **Knockout:** the winner of each tie down the derived bracket (R32 → Final). The last pick is
   the champion.

**What the app derives from step 1:**

- Each group's final table via the §5 ladder → 1st & 2nd per group.
- The twelve third-placed teams ranked → **best 8** advance.
- Those 32 teams slotted into the §4 template (Annex C for the thirds) → every R32 matchup, and
  therefore every team's full path.

The same derivation runs on **real results** as they arrive, so predictions and reality are always
computed by identical code.

## 7. Derivation engine

New pure module (e.g. `src/lib/bracket-core.ts`), no Supabase, fully unit-tested. Shared by the
predicted bracket (input = a user's `group_scores`) and the real bracket (input = actual
`matches`). Reuses/extends `scoring-core.ts`.

- `computeGroupStandings(matches)` — **upgraded** to the full §5 within-group ladder (currently
  points → GD → GF only; add head-to-head mini-table + FIFA-ranking tiebreak).
- `rankThirdPlaceTeams(standings) → Team[]` and `pickBestEightThirds(...) → { teams, groups }`
  using the §5 across-group ladder.
- `assignThirdsAnnexC(qualifyingGroups: Set<Group>) → Record<Slot, Group>` — the official Annex C
  lookup keyed by the sorted set of the eight qualifying groups (§7.1).
- `buildBracket(standings, bestThirds, annexC) → BracketNode tree` — produces every matchup
  (teams or `null` placeholders) for matches 73–104, plus a helper to apply a user's winner picks
  and surface each team's path.

### 7.1 Annex C (the one heavy data task)

FIFA's regulations publish Annex C: for each of the **495** combinations (`C(12,8)`) of which eight
groups produce a qualifying third, an exact assignment of those teams to the eight third-place
slots (§4.1). We will:

1. **Source and encode** the official table as a lookup (`sorted-group-key → slot map`).
2. **Verify** it with tests: every combination yields a complete, valid assignment that respects
   each slot's eligibility list (§4.1) and never produces an impossible slot.
3. **Fallback (only if the official table cannot be sourced):** a deterministic constraint match
   over the eligibility lists. This can differ from FIFA's official assignment in rare cases, so it
   is a safety net, not the plan — the chosen approach is the exact table.

## 8. Data model

### 8.1 `bracket_predictions`

| Column | Change |
|---|---|
| `group_scores jsonb` | **new** — `{ "<match_id>": { "h": int, "a": int } }` for the 72 group matches |
| `knockout jsonb` | **reshaped** — `{ "<match_no 73..104>": winnerTeamId }` (winner per tie) |
| `champion_team_id int` | keep (denormalized; = winner of match 104) |
| `group_standings jsonb` | **drop** — now derived from `group_scores` (single source of truth) |

`scoreUpfront` and the editor derive standings/bracket from `group_scores` via §7, so stored data
can never contradict itself.

### 8.2 `leagues.scoring` (config)

Add to `upfront`:

- `group_exact_score` (nailed the exact group scoreline) — e.g. **3**
- `group_correct_result` (got W/D/L right) — e.g. **1**
- `advance_round_of_32` — e.g. **1**

Keep `group_winner` (e.g. 3) and `champion` (e.g. 15). **Drop `group_qualifier`** — "made the
knockouts" is now covered by `advance_round_of_32`, removing double-counting. Existing advancement
tiers stay: `advance_round_of_16` 2, `advance_quarter` 4, `advance_semi` 6, `advance_final` 8. All
values remain per-league configurable; final numbers can be tuned during playtest.

### 8.3 Relationship to the live `match_predictions` feature

- The bracket's `group_scores` are a **frozen snapshot** locked at `bracket_lock_at` (tournament
  start). They drive derivation and group-accuracy scoring.
- `match_predictions` remains the **rolling matchday** feature (each match locks at its own
  kickoff), feeding `live_points`.
- **No double entry:** when a user fills the bracket's group scores, we **seed** their matchday
  prediction for those games (still editable until each kickoff). The two scoring streams stay
  separate (upfront group-accuracy vs live), so there is no double-counting; whether group matches
  also earn live points is a config toggle (default: group accuracy scored from the bracket only).

### 8.4 Migration

App is pre-launch (today 2026-06-01; `bracket_lock_at` 2026-06-11) with no real predictions to
preserve, so the migration may **reset** `bracket_predictions` to the new shape rather than
back-fill. Confirm before running. Update `DEFAULT_SCORING`, `ScoringConfig`, and the
`BracketPrediction` type in `src/lib/types.ts` to match.

## 9. Scoring

`scoreUpfront(cfg, actual, bracket)` is refactored to:

1. **Derive predicted standings** from `bracket.group_scores` via §7 (same code as actuals).
2. **Group accuracy (precise):** per group match, award `group_exact_score` or
   `group_correct_result` by comparing the predicted scoreline to the actual result.
3. **Position bonus:** `group_winner` when the predicted group winner matches reality.
4. **Advancement (forgiving survival):** for each team the user predicted to reach
   R32 / R16 / QF / SF / Final that actually reached it, award the escalating tier (now including
   `advance_round_of_32`). Set-membership, robust to bracket divergence.
5. **Champion bonus** on exact match.

`computeActuals` already records `advancers` per stage including `round_of_32`; the engine just
needs the new tier wired in plus the derived-standings change. `scoreLive` is unchanged.

## 10. UI / UX

- **Group step:** 12 group panels, each listing its 6 fixtures with compact score steppers
  (mobile-first). As scores change, show the live derived table (positions, 1st/2nd highlighted)
  and a running "projected best-8 thirds" panel so the user sees consequences immediately.
- **Thirds:** read-only, derived, with a one-line explanation of why these 8 qualified.
- **Knockout:** the derived bracket tree, populated with the user's teams; tap a team to advance it;
  picking cascades and invalidates downstream picks that no longer apply; final tap sets champion.
- **Lock:** unchanged server-side enforcement against `bracket_lock_at`; locked view is read-only.
- Reuse `GameButton`, glass surfaces, grass/gold palette, `Reveal`, existing typography.

## 11. Testing

Extend `src/lib/__tests__/scoring-core.test.ts` and add tests for `bracket-core.ts`:

- **Within-group tiebreaks:** head-to-head separating 2- and 3-way ties; recursion to the still-tied
  subset; FIFA-ranking fallback.
- **Third-place ranking:** best-8 selection, ties broken by GD/GF/ranking.
- **Annex C:** every one of the 495 combinations yields a complete assignment respecting slot
  eligibility; spot-check against published example combinations.
- **buildBracket:** correct matchups for matches 73–104; a team's path is consistent with the tree.
- **scoreUpfront:** group accuracy, position bonus, advancement incl. R32, champion; derived
  standings equal hand-computed expectations.

## 12. Risks & open questions

1. **Sourcing the exact Annex C table.** Mitigation: official FIFA regulations + verification tests;
   constraint-matching fallback (§7.1). *This is the main research/data task.*
2. **72-scoreline UX effort.** Mitigation: fast steppers, sensible defaults, progress indicator,
   live feedback so it feels purposeful rather than a chore.
3. **Exact within-group ordering** (head-to-head before vs after overall GD) must be pinned to the
   official FIFA 2026 regulations during implementation; sources vary. Does not affect derivability.
4. **Confirm pre-launch reset** of `bracket_predictions` is acceptable (§8.4).
5. **Live-feature double-scoring policy** (§8.3) — confirm group matches earn upfront accuracy only
   by default.
