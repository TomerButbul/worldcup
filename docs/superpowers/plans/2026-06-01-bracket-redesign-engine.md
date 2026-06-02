# Bracket Redesign — Engine, Scoring & Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested derivation engine + scoring that turns a user's 72 predicted group scorelines into the real 2026 World Cup knockout bracket (Round of 32 → Final), and reshape the data model to store scorelines instead of free-form standings.

**Architecture:** Two new pure modules with no Supabase dependency — `src/lib/bracket-core.ts` (canonical FIFA match template, group-result derivation, third-place ranking, bracket construction, predicted-advancer extraction) and `src/lib/annex-c.ts` (the official Annex C third-place→slot assignment over all 495 combinations). `src/lib/scoring-core.ts` is upgraded (full FIFA within-group tiebreaker ladder) and its `scoreUpfront` is refactored to derive everything from `group_scores`. A migration reshapes `bracket_predictions`, adjusts `leagues.scoring`, and adds `teams.fifa_rank`. This is Plan 1 of 2 — the UI (Plan 2) consumes these types and functions.

**Tech Stack:** TypeScript, Vitest (`npm test` → `vitest run`), Supabase Postgres migrations (`supabase/migrations/*.sql`), Next.js 16 App Router. No new dependencies.

**Pre-launch assumptions (confirmed defaults from spec §12):** the app has no real predictions to preserve, so migration `0009` **resets** `bracket_predictions` to the new shape; group matches earn **upfront accuracy only** (no live double-count) — this plan does not change `scoreLive`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/types.ts` | `ScoringConfig`, `DEFAULT_SCORING`, `BracketPrediction`, shared `MatchScore`, `Group` types | Modify |
| `src/lib/annex-c.ts` | Eligibility lists for the 8 third-place slots; `assignThirdsAnnexC(groups)` deterministic perfect-matching + official overrides | Create |
| `src/lib/bracket-core.ts` | Canonical match template (73–104) + `stageOf`; third-place ranking (`rankThirdPlaceTeams`, `pickBestEightThirds`); bracket build (`buildRound32`, `buildBracket`); `predictedAdvancers` | Create |
| `src/lib/scoring-core.ts` | Upgrade `computeGroupStandings` to the full FIFA ladder; expose `computeGroupTables` / `GroupTable` / `GroupStat`; refactor `scoreUpfront`; add `advance_round_of_32` to `ADVANCE_KEYS` | Modify |
| `src/lib/scoring-engine.ts` | Select `group_scores`; build `groupFixtures` + `fifaRank`; call new `scoreUpfront` | Modify |
| `supabase/migrations/0009_bracket_redesign.sql` | `teams.fifa_rank`; reshape `bracket_predictions`; adjust `leagues.scoring`; pre-launch reset | Create |
| `src/lib/__tests__/annex-c.test.ts` | All 495 combinations valid + complete + eligibility-respecting; published spot-checks | Create |
| `src/lib/__tests__/bracket-core.test.ts` | Derivation, third-place ranking, round-of-32 build, predicted advancers | Create |
| `src/lib/__tests__/scoring-core.test.ts` | Extend: H2H tiebreaks, ranking fallback, new `scoreUpfront` shape | Modify |

**Canonical vs DB ids (important):** `matches.id` in the DB is the arbitrary API-Football fixture id. The FIFA bracket template uses **canonical match numbers 1–104** (1–72 group, 73–104 knockout). The engine works entirely in canonical/stage space. `group_scores` is keyed by **DB match id** (group fixtures have known teams post-draw); `knockout` picks are keyed by **canonical match number 73–104**. The mapping between canonical knockout numbers and DB knockout fixtures is a UI/Plan-2 concern; the engine never needs it because scoring uses **per-stage set membership**, and canonical numbers map to stages statically.

---

## Task 1: Types & scoring config

**Files:**
- Modify: `src/lib/types.ts`
- Test: `src/lib/__tests__/scoring-config.test.ts` (Create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/scoring-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_SCORING } from "@/lib/types";

describe("DEFAULT_SCORING", () => {
  it("has the new group-accuracy and R32 tiers", () => {
    expect(DEFAULT_SCORING.upfront.group_exact_score).toBe(3);
    expect(DEFAULT_SCORING.upfront.group_correct_result).toBe(1);
    expect(DEFAULT_SCORING.upfront.advance_round_of_32).toBe(1);
  });

  it("drops the redundant group_qualifier tier", () => {
    expect("group_qualifier" in DEFAULT_SCORING.upfront).toBe(false);
  });

  it("keeps existing advancement + champion tiers", () => {
    expect(DEFAULT_SCORING.upfront.group_winner).toBe(3);
    expect(DEFAULT_SCORING.upfront.advance_round_of_16).toBe(2);
    expect(DEFAULT_SCORING.upfront.advance_quarter).toBe(4);
    expect(DEFAULT_SCORING.upfront.advance_semi).toBe(6);
    expect(DEFAULT_SCORING.upfront.advance_final).toBe(8);
    expect(DEFAULT_SCORING.upfront.champion).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scoring-config`
Expected: FAIL — `group_exact_score` is `undefined` (type/value not present yet).

- [ ] **Step 3: Update the types**

In `src/lib/types.ts`, replace the `ScoringConfig` interface's `upfront` block, the `BracketPrediction` interface, and `DEFAULT_SCORING` with the versions below. Add `MatchScore` and `Group`.

Replace the `ScoringConfig` interface (lines ~38–53) with:

```ts
export interface ScoringConfig {
  upfront: {
    group_exact_score: number;   // nailed the exact group scoreline
    group_correct_result: number; // got W/D/L right
    group_winner: number;         // predicted the group winner correctly
    advance_round_of_32: number;
    advance_round_of_16: number;
    advance_quarter: number;
    advance_semi: number;
    advance_final: number;
    champion: number;
  };
  live: {
    exact_score: number;
    correct_result: number;
    goal_scorer: number;
  };
}
```

Replace the `BracketPrediction` interface (lines ~64–78) with:

```ts
export type Group = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

// One predicted scoreline. h = home goals, a = away goals.
export interface MatchScore {
  h: number;
  a: number;
}

// group_scores: { "<db_match_id>": { h, a } } for the 72 group matches.
// knockout: { "<canonical_match_no 73..104>": winnerTeamId } — winner per tie.
export interface BracketPrediction {
  league_id: string;
  user_id: string;
  group_scores: Record<string, MatchScore>;
  knockout: Record<string, number>;
  champion_team_id: number | null;
  submitted_at: string | null;
}
```

Replace `DEFAULT_SCORING` (lines ~88–103) with:

```ts
export const DEFAULT_SCORING: ScoringConfig = {
  upfront: {
    group_exact_score: 3,
    group_correct_result: 1,
    group_winner: 3,
    advance_round_of_32: 1,
    advance_round_of_16: 2,
    advance_quarter: 4,
    advance_semi: 6,
    advance_final: 8,
    champion: 15,
  },
  live: {
    exact_score: 5,
    correct_result: 2,
    goal_scorer: 2,
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scoring-config`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/__tests__/scoring-config.test.ts
git commit -m "feat(types): reshape scoring config + bracket prediction for scoreline-driven bracket"
```

> Note: `src/lib/scoring-core.ts` and `src/lib/scoring-engine.ts` will not type-check until Tasks 5/8/9 land (they still reference `group_standings` / `group_qualifier`). That is expected; tests for this task run in isolation. Do not "fix" them with stubs here — they are rewritten in later tasks.

---

## Task 2: Migration `0009_bracket_redesign.sql`

**Files:**
- Create: `supabase/migrations/0009_bracket_redesign.sql`

No automated test (DDL). Verified by `supabase db diff`/manual apply during execution; the engine tests cover the shape the app reads/writes.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0009_bracket_redesign.sql`:

```sql
-- Bracket redesign: scoreline-driven group stage + fixed knockout template.
-- Pre-launch (today 2026-06-01, kickoff 2026-06-11): no real predictions to
-- preserve, so reset bracket_predictions to the new shape rather than back-fill.

-- 1. Teams: FIFA world ranking for the deterministic deep tiebreak (§5).
--    Nullable; populated by a later sync. The engine falls back to team-id
--    order when a rank is null, so correctness never depends on this being set.
alter table teams add column if not exists fifa_rank int;

-- 2. Leagues scoring config.
--    a) New default for leagues created from now on.
alter table leagues alter column scoring set default '{
  "upfront": {
    "group_exact_score": 3,
    "group_correct_result": 1,
    "group_winner": 3,
    "advance_round_of_32": 1,
    "advance_round_of_16": 2,
    "advance_quarter": 4,
    "advance_semi": 6,
    "advance_final": 8,
    "champion": 15
  },
  "live": {
    "exact_score": 5,
    "correct_result": 2,
    "goal_scorer": 2
  }
}'::jsonb;

--    b) Migrate existing rows in place: drop group_qualifier, add the three new
--       tiers, preserving any per-league customisation of the other values.
update leagues set scoring = jsonb_set(
  jsonb_set(
    jsonb_set(
      (scoring #- '{upfront,group_qualifier}'),
      '{upfront,group_exact_score}', '3'
    ),
    '{upfront,group_correct_result}', '1'
  ),
  '{upfront,advance_round_of_32}', '1'
);

-- 3. bracket_predictions: store predicted scorelines; knockout becomes
--    { "<canonical_match_no>": winnerTeamId }. Drop the derived group_standings.
alter table bracket_predictions
  add column if not exists group_scores jsonb not null default '{}'::jsonb;
alter table bracket_predictions
  drop column if exists group_standings;

comment on column bracket_predictions.group_scores is
  '{ "<db_match_id>": { "h": int, "a": int } } predicted scorelines for the 72 group matches';
comment on column bracket_predictions.knockout is
  '{ "<canonical_match_no 73..104>": winnerTeamId } predicted winner of each knockout tie';

-- 4. Pre-launch reset: no stored row should carry the old shape.
update bracket_predictions
  set group_scores = '{}'::jsonb,
      knockout = '{}'::jsonb,
      champion_team_id = null,
      submitted_at = null;
```

- [ ] **Step 2: Dry-run against the live DB**

Run (PowerShell; password handled transiently — never write it to a file):

```
npx --no-install supabase db push --db-url "postgresql://postgres:<URL_ENCODED_PW>@db.nqcpsardtflikwglwswt.supabase.co:5432/postgres" --dry-run
```

Expected: `Would push these migrations: • 0009_bracket_redesign.sql`.

> **Pause here for explicit user confirmation before the real push.** Two reasons: (a) step 4 is destructive (resets predictions — safe pre-launch, but confirm); (b) dropping `group_standings` makes the **current** bracket page (`page.tsx` / `BracketEditor.tsx` / `actions.ts`) read/write columns that no longer exist, so that page is **runtime-broken from this apply until Plan 2 rewrites it**. It still *compiles* (those files use the untyped Supabase client + local types — see Task 10), so the engine work proceeds normally.
>
> If you'd rather not have a broken-page window, you may **defer Steps 3–4 (the live apply)** until Plan 2's UI is ready: land the migration file + dry-run now, and apply right before the Plan 2 UI ships. The engine tests are pure and need no DB, so deferring does not block any other Plan 1 task. Ask the user which they prefer.

- [ ] **Step 3: Apply (after confirmation)**

```
npx --no-install supabase db push --db-url "postgresql://postgres:<URL_ENCODED_PW>@db.nqcpsardtflikwglwswt.supabase.co:5432/postgres" --yes
```

- [ ] **Step 4: Verify**

```
psql "<conn>" -c "select column_name from information_schema.columns where table_name='bracket_predictions' order by 1;" -c "select scoring->'upfront' from leagues limit 1;" -c "select count(*) from information_schema.columns where table_name='teams' and column_name='fifa_rank';"
```

Expected: `group_scores` present and `group_standings` absent; `upfront` JSON shows the new keys and no `group_qualifier`; `fifa_rank` count = 1.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0009_bracket_redesign.sql
git commit -m "feat(db): migration 0009 — scoreline group_scores, R32 scoring tiers, teams.fifa_rank"
```

---

## Task 3: Canonical bracket template (`bracket-core.ts` part 1)

**Files:**
- Create: `src/lib/bracket-core.ts`
- Test: `src/lib/__tests__/bracket-core.test.ts` (Create)

This task lays down the fixed FIFA template (matches 73–104) and the stage map. Later tasks add derivation/scoring functions to the same file.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/bracket-core.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ROUND32, BRACKET_TREE, THIRD_MATCHES, stageOf } from "@/lib/bracket-core";

describe("canonical template", () => {
  it("has 16 Round-of-32 matches (73–88)", () => {
    const nums = Object.keys(ROUND32).map(Number).sort((a, b) => a - b);
    expect(nums).toEqual([73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88]);
  });

  it("the eight third-place matches pair a group winner with a third", () => {
    expect(THIRD_MATCHES).toEqual([74, 77, 79, 80, 81, 82, 85, 87]);
    for (const m of THIRD_MATCHES) {
      expect(ROUND32[m].home.kind).toBe("winner");
      expect(ROUND32[m].away).toEqual({ kind: "third", match: m });
    }
  });

  it("the eight fixed matches use only group winners/runners", () => {
    for (const m of [73, 75, 76, 78, 83, 84, 86, 88]) {
      for (const side of [ROUND32[m].home, ROUND32[m].away]) {
        expect(["winner", "runner"]).toContain(side.kind);
      }
    }
  });

  it("wires the tree exactly per FIFA (e.g. 89 = W74 v W77, 104 = W101 v W102)", () => {
    expect(BRACKET_TREE[89]).toEqual({
      home: { kind: "matchWinner", match: 74 },
      away: { kind: "matchWinner", match: 77 },
    });
    expect(BRACKET_TREE[104]).toEqual({
      home: { kind: "matchWinner", match: 101 },
      away: { kind: "matchWinner", match: 102 },
    });
  });

  it("maps canonical numbers to stages", () => {
    expect(stageOf(73)).toBe("round_of_32");
    expect(stageOf(88)).toBe("round_of_32");
    expect(stageOf(89)).toBe("round_of_16");
    expect(stageOf(96)).toBe("round_of_16");
    expect(stageOf(97)).toBe("quarter");
    expect(stageOf(100)).toBe("quarter");
    expect(stageOf(101)).toBe("semi");
    expect(stageOf(102)).toBe("semi");
    expect(stageOf(104)).toBe("final");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- bracket-core`
Expected: FAIL — cannot import from `@/lib/bracket-core` (module does not exist).

- [ ] **Step 3: Create the template module**

Create `src/lib/bracket-core.ts`:

```ts
import type { Group, MatchStage } from "@/lib/types";

// A reference to a team's slot in the fixed bracket, resolved once results exist.
//  winner/runner  -> 1st/2nd of a group
//  third          -> the Annex C third assigned to THIS match (§7.1)
//  matchWinner/Loser -> propagated from an earlier knockout match
export type SlotRef =
  | { kind: "winner"; group: Group }
  | { kind: "runner"; group: Group }
  | { kind: "third"; match: number }
  | { kind: "matchWinner"; match: number }
  | { kind: "matchLoser"; match: number };

export interface MatchTemplate {
  home: SlotRef;
  away: SlotRef;
}

const w = (group: Group): SlotRef => ({ kind: "winner", group });
const r = (group: Group): SlotRef => ({ kind: "runner", group });
const third = (match: number): SlotRef => ({ kind: "third", match });
const W = (match: number): SlotRef => ({ kind: "matchWinner", match });

// The eight Round-of-32 matches whose away slot is an Annex C third-placed team.
export const THIRD_MATCHES = [74, 77, 79, 80, 81, 82, 85, 87] as const;

// Round of 32 (matches 73–88) — FIFA 2026, spec §4.1.
export const ROUND32: Record<number, MatchTemplate> = {
  73: { home: r("A"), away: r("B") },
  74: { home: w("E"), away: third(74) },
  75: { home: w("F"), away: r("C") },
  76: { home: w("C"), away: r("F") },
  77: { home: w("I"), away: third(77) },
  78: { home: r("E"), away: r("I") },
  79: { home: w("A"), away: third(79) },
  80: { home: w("L"), away: third(80) },
  81: { home: w("D"), away: third(81) },
  82: { home: w("G"), away: third(82) },
  83: { home: r("K"), away: r("L") },
  84: { home: w("H"), away: r("J") },
  85: { home: w("B"), away: third(85) },
  86: { home: w("J"), away: r("H") },
  87: { home: w("K"), away: third(87) },
  88: { home: r("D"), away: r("G") },
};

// R16 → Final (matches 89–104, third-place playoff 103 omitted) — spec §4.2.
export const BRACKET_TREE: Record<number, MatchTemplate> = {
  89: { home: W(74), away: W(77) },
  90: { home: W(73), away: W(75) },
  91: { home: W(76), away: W(78) },
  92: { home: W(79), away: W(80) },
  93: { home: W(83), away: W(84) },
  94: { home: W(81), away: W(82) },
  95: { home: W(86), away: W(88) },
  96: { home: W(85), away: W(87) },
  97: { home: W(89), away: W(90) },
  98: { home: W(93), away: W(94) },
  99: { home: W(91), away: W(92) },
  100: { home: W(95), away: W(96) },
  101: { home: W(97), away: W(98) },
  102: { home: W(99), away: W(100) },
  104: { home: W(101), away: W(102) },
};

// Every knockout match keyed by canonical number, in tournament order.
export const KNOCKOUT_TEMPLATE: Record<number, MatchTemplate> = { ...ROUND32, ...BRACKET_TREE };

export function stageOf(matchNo: number): MatchStage {
  if (matchNo >= 73 && matchNo <= 88) return "round_of_32";
  if (matchNo >= 89 && matchNo <= 96) return "round_of_16";
  if (matchNo >= 97 && matchNo <= 100) return "quarter";
  if (matchNo >= 101 && matchNo <= 102) return "semi";
  if (matchNo === 103) return "third_place";
  if (matchNo === 104) return "final";
  throw new Error(`not a knockout match number: ${matchNo}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- bracket-core`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-core.ts src/lib/__tests__/bracket-core.test.ts
git commit -m "feat(bracket): encode the fixed FIFA 2026 knockout template (matches 73-104)"
```

---

## Task 4: Annex C third-place assignment (`annex-c.ts`)

**Files:**
- Create: `src/lib/annex-c.ts`
- Test: `src/lib/__tests__/annex-c.test.ts` (Create)

The away slot of each `THIRD_MATCHES` match is filled by one of the 8 best third-placed teams. FIFA's Annex C maps each of the **495** combinations (`C(12,8)`) of qualifying groups to an exact slot assignment, constrained by each slot's eligibility list (spec §4.1). We implement a deterministic perfect-matching solver over those eligibility lists (always yields a valid, complete, bijective assignment) plus an `OVERRIDES` table to pin any combination where FIFA's published table differs from the solver's deterministic choice.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/annex-c.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { THIRD_SLOT_ELIGIBILITY, assignThirdsAnnexC } from "@/lib/annex-c";
import type { Group } from "@/lib/types";

const ALL_GROUPS: Group[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const SLOT_MATCHES = [74, 77, 79, 80, 81, 82, 85, 87];

// Enumerate every k-subset of `arr`.
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [head, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map((c) => [head, ...c]),
    ...combinations(rest, k),
  ];
}

describe("Annex C eligibility", () => {
  it("defines eligibility for the eight third-place slots", () => {
    expect(Object.keys(THIRD_SLOT_ELIGIBILITY).map(Number).sort((a, b) => a - b)).toEqual(SLOT_MATCHES);
    expect(THIRD_SLOT_ELIGIBILITY[74]).toEqual(["A", "B", "C", "D", "F"]);
    expect(THIRD_SLOT_ELIGIBILITY[87]).toEqual(["D", "E", "I", "J", "L"]);
  });
});

describe("assignThirdsAnnexC — all 495 combinations", () => {
  const combos = combinations(ALL_GROUPS, 8);

  it("there are exactly 495 combinations", () => {
    expect(combos).toHaveLength(495);
  });

  it("every combination yields a complete, bijective, eligibility-respecting assignment", () => {
    for (const combo of combos) {
      const qualifying = new Set<Group>(combo);
      const assignment = assignThirdsAnnexC(qualifying);

      // all 8 slots filled
      expect(Object.keys(assignment).map(Number).sort((a, b) => a - b)).toEqual(SLOT_MATCHES);
      // bijection: the 8 assigned groups are exactly the qualifying set
      expect(new Set(Object.values(assignment))).toEqual(qualifying);
      // each assignment respects that slot's eligibility list
      for (const m of SLOT_MATCHES) {
        expect(THIRD_SLOT_ELIGIBILITY[m]).toContain(assignment[m]);
      }
    }
  });

  it("is deterministic (same input → same output)", () => {
    const q = new Set<Group>(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(assignThirdsAnnexC(q)).toEqual(assignThirdsAnnexC(q));
  });

  it("throws on a non-8 input", () => {
    expect(() => assignThirdsAnnexC(new Set<Group>(["A", "B"]))).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- annex-c`
Expected: FAIL — cannot import from `@/lib/annex-c`.

- [ ] **Step 3: Implement the solver**

Create `src/lib/annex-c.ts`:

```ts
import type { Group } from "@/lib/types";

// Eligibility lists for the eight Round-of-32 third-place slots (spec §4.1),
// keyed by canonical match number. A slot may only be filled by a third-placed
// team from one of its listed groups.
export const THIRD_SLOT_ELIGIBILITY: Record<number, Group[]> = {
  74: ["A", "B", "C", "D", "F"],
  77: ["C", "D", "F", "G", "H"],
  79: ["C", "E", "F", "H", "I"],
  80: ["E", "H", "I", "J", "K"],
  81: ["B", "E", "F", "I", "J"],
  82: ["A", "E", "H", "I", "J"],
  85: ["E", "F", "G", "I", "J"],
  87: ["D", "E", "I", "J", "L"],
};

// Slots processed in a fixed order so the matching is deterministic.
const SLOT_ORDER = [74, 77, 79, 80, 81, 82, 85, 87] as const;

// Official-table overrides: for the (rare) combinations where FIFA's published
// Annex C assignment differs from the solver's deterministic perfect matching,
// pin the exact official map here, keyed by the sorted qualifying groups joined
// with no separator (e.g. "ABCDEFGH"). Populated during execution from the FIFA
// regulations (Step 5); empty means the solver's matching is used as-is.
export const OVERRIDES: Record<string, Record<number, Group>> = {};

function keyOf(qualifying: Set<Group>): string {
  return [...qualifying].sort().join("");
}

// Deterministic bipartite perfect matching of the 8 qualifying groups to the 8
// slots, respecting eligibility. Backtracking over slots in SLOT_ORDER, trying
// eligible groups in each slot's listed order. FIFA's lists guarantee a perfect
// matching exists for all 495 combinations (asserted by the tests).
export function assignThirdsAnnexC(qualifying: Set<Group>): Record<number, Group> {
  if (qualifying.size !== 8) {
    throw new Error(`Annex C needs exactly 8 qualifying groups, got ${qualifying.size}`);
  }

  const override = OVERRIDES[keyOf(qualifying)];
  if (override) return { ...override };

  const result: Record<number, Group> = {};
  const used = new Set<Group>();

  const solve = (i: number): boolean => {
    if (i === SLOT_ORDER.length) return used.size === 8;
    const match = SLOT_ORDER[i];
    for (const g of THIRD_SLOT_ELIGIBILITY[match]) {
      if (qualifying.has(g) && !used.has(g)) {
        used.add(g);
        result[match] = g;
        if (solve(i + 1)) return true;
        used.delete(g);
        delete result[match];
      }
    }
    return false;
  };

  if (!solve(0)) {
    throw new Error(`no valid Annex C assignment for ${keyOf(qualifying)}`);
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- annex-c`
Expected: PASS — including "every combination yields a complete, bijective, eligibility-respecting assignment" over all 495.

- [ ] **Step 5: Reconcile with the official FIFA table (fidelity step)**

The solver always produces a *valid* bracket, but spec §3/§7.1 want the *exact* official assignment. During execution:

1. Fetch FIFA's official Annex C third-place allocation table for the 2026 regulations (use the context7 docs tool or the FIFA regulations PDF; cross-check with a reputable published reconstruction).
2. For each of the 495 combinations, compare the official slot map to `assignThirdsAnnexC` output (write a throwaway script that iterates the combos). For every mismatch, add an entry to `OVERRIDES` keyed by the sorted-group string.
3. Add spot-check assertions to `annex-c.test.ts` for at least 3 officially-published example combinations, asserting the exact slot map.

```ts
// Example shape of a spot-check (fill teams/slots from the official table):
it("matches FIFA's published example for groups A,B,C,D,E,F,G,H", () => {
  const a = assignThirdsAnnexC(new Set(["A", "B", "C", "D", "E", "F", "G", "H"]));
  expect(a).toEqual({ 74: "A", 77: "D", 79: "C", 80: "H", 81: "B", 82: "E", 85: "G", 87: "F" });
  // ^ replace with the actual official mapping
});
```

> If the official table cannot be sourced, the solver's valid matching stands (spec §7.1 fallback). Record that decision in the commit message so it is auditable. Do **not** invent override values — only encode what the official source states.

- [ ] **Step 6: Commit**

```bash
git add src/lib/annex-c.ts src/lib/__tests__/annex-c.test.ts
git commit -m "feat(bracket): Annex C third-place slot assignment with all-495 verification"
```

---

## Task 5: Upgrade `computeGroupStandings` to the full FIFA ladder

**Files:**
- Modify: `src/lib/scoring-core.ts` (replace the `computeGroupStandings` function, lines ~43–82)
- Test: `src/lib/__tests__/scoring-core.test.ts` (add cases)

Today's standings use points → overall GD → overall GF only. FIFA 2026 (spec §5) interposes head-to-head (points → GD → GF among the tied teams, re-applied to still-tied subsets) **before** overall GD/GF, then FIFA world ranking, then (underivable) conduct/lots. We implement everything down to FIFA ranking, with team id as the deterministic final fallback. Ranking is an optional `Map<teamId, rank>` (lower = better); when a team is absent it sorts last among equals.

- [ ] **Step 1: Write the failing tests**

In `src/lib/__tests__/scoring-core.test.ts`, add these cases inside the existing `describe("computeGroupStandings", ...)` block (after the current tests):

```ts
  it("head-to-head beats overall GD for two level teams", () => {
    // 1 and 2 both finish on 6 pts. 2 has the better overall GD (+6 vs +3),
    // but 1 won their head-to-head, so 1 must rank above 2.
    const g: MatchRow[] = [
      gm(1, "A", 1, 2, 1, 0), // 1 beats 2 (head-to-head)
      gm(2, "A", 3, 1, 1, 0), // 3 beats 1
      gm(3, "A", 1, 4, 3, 0), // 1 beats 4
      gm(4, "A", 2, 3, 2, 0), // 2 beats 3
      gm(5, "A", 2, 4, 5, 0), // 2 beats 4 (pads 2's overall GD)
      gm(6, "A", 3, 4, 1, 1), // 3 draws 4
    ];
    const s = computeGroupStandings(g);
    expect(s.A[0]).toBe(1);
    expect(s.A[1]).toBe(2);
  });

  it("breaks a 3-way points tie by head-to-head goal difference", () => {
    // 1,2,3 form a 1-0 cycle and each beat 4 by 3-0 → all on 6 pts.
    // H2H points are equal (3 each); H2H GD/GF are equal too here, so this
    // case actually falls through to FIFA ranking — see next test. To isolate
    // H2H GD, make the cycle margins differ:
    const g: MatchRow[] = [
      gm(1, "B", 1, 2, 2, 0), // 1 beats 2 by 2
      gm(2, "B", 2, 3, 2, 0), // 2 beats 3 by 2
      gm(3, "B", 3, 1, 1, 0), // 3 beats 1 by 1
      gm(4, "B", 1, 4, 1, 0),
      gm(5, "B", 2, 4, 1, 0),
      gm(6, "B", 3, 4, 1, 0),
    ];
    // H2H among {1,2,3}: each 3 pts. GD: 1 = +2-1=+1, 2 = -2+2=0, 3 = -2+1=-1.
    const s = computeGroupStandings(g);
    expect(s.B.slice(0, 3)).toEqual([1, 2, 3]);
    expect(s.B[3]).toBe(4);
  });

  it("falls through to FIFA ranking when teams are dead level on all score criteria", () => {
    // Perfect 1-0 cycle among 1,2,3; all beat 4 by 3-0 → identical pts/GD/GF
    // and an equal head-to-head cycle. FIFA ranking decides: 2 < 3 < 1.
    const g: MatchRow[] = [
      gm(1, "C", 1, 2, 1, 0),
      gm(2, "C", 2, 3, 1, 0),
      gm(3, "C", 3, 1, 1, 0),
      gm(4, "C", 1, 4, 3, 0),
      gm(5, "C", 2, 4, 3, 0),
      gm(6, "C", 3, 4, 3, 0),
    ];
    const fifaRank = new Map<number, number>([[2, 1], [3, 2], [1, 3]]);
    const s = computeGroupStandings(g, fifaRank);
    expect(s.C.slice(0, 3)).toEqual([2, 3, 1]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- scoring-core`
Expected: FAIL — the head-to-head and ranking cases produce the old points→GD→GF order. (The `computeGroupStandings` import takes only one arg today, so the `fifaRank` case may also be a type error — that's fine, it confirms the failure.)

- [ ] **Step 3: Replace `computeGroupStandings` with the full ladder**

In `src/lib/scoring-core.ts`, replace the entire existing `computeGroupStandings` function (lines ~43–82) with:

```ts
interface GroupStat {
  pts: number;
  gd: number;
  gf: number;
}

// Tally points/GD/GF for `teamIds` using only matches *among those teams*.
// Passing the full group → the overall table; passing a tied subset → that
// subset's head-to-head mini-table (matches touching an outside team are skipped).
function tally(teamIds: Iterable<number>, matches: MatchRow[]): Map<number, GroupStat> {
  const stat = new Map<number, GroupStat>();
  for (const id of teamIds) stat.set(id, { pts: 0, gd: 0, gf: 0 });
  for (const m of matches) {
    if (m.home_team_id == null || m.away_team_id == null) continue;
    const h = stat.get(m.home_team_id);
    const a = stat.get(m.away_team_id);
    if (!h || !a) continue; // skip matches involving a team outside the set
    const hg = m.home_goals ?? 0;
    const ag = m.away_goals ?? 0;
    h.gf += hg;
    a.gf += ag;
    h.gd += hg - ag;
    a.gd += ag - hg;
    if (hg > ag) h.pts += 3;
    else if (hg < ag) a.pts += 3;
    else {
      h.pts += 1;
      a.pts += 1;
    }
  }
  return stat;
}

// Split an already-sorted list into maximal runs where `equal(prev, next)` holds.
function runs<T>(sorted: T[], equal: (x: T, y: T) => boolean): T[][] {
  const out: T[][] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && equal(sorted[i], sorted[j])) j++;
    out.push(sorted.slice(i, j));
    i = j;
  }
  return out;
}

// Final, non-head-to-head criteria: overall GD → overall GF → FIFA ranking → id.
function byOverall(tied: number[], overall: Map<number, GroupStat>, fifaRank: Map<number, number>): number[] {
  const rank = (id: number) => fifaRank.get(id) ?? Number.MAX_SAFE_INTEGER;
  return [...tied].sort(
    (x, y) =>
      overall.get(y)!.gd - overall.get(x)!.gd ||
      overall.get(y)!.gf - overall.get(x)!.gf ||
      rank(x) - rank(y) ||
      x - y,
  );
}

// Resolve a set of teams already level on overall points (spec §5 criteria 2–8).
function resolveTied(
  tied: number[],
  groupMatches: MatchRow[],
  overall: Map<number, GroupStat>,
  fifaRank: Map<number, number>,
): number[] {
  if (tied.length === 1) return tied;

  const h2h = tally(tied, groupMatches);
  const sorted = [...tied].sort(
    (x, y) =>
      h2h.get(y)!.pts - h2h.get(x)!.pts ||
      h2h.get(y)!.gd - h2h.get(x)!.gd ||
      h2h.get(y)!.gf - h2h.get(x)!.gf,
  );
  const equalH2h = (x: number, y: number) =>
    h2h.get(x)!.pts === h2h.get(y)!.pts &&
    h2h.get(x)!.gd === h2h.get(y)!.gd &&
    h2h.get(x)!.gf === h2h.get(y)!.gf;

  const out: number[] = [];
  for (const run of runs(sorted, equalH2h)) {
    if (run.length === 1) {
      out.push(run[0]);
    } else if (run.length < tied.length) {
      // Head-to-head separated some teams; re-apply it to the still-tied subset.
      out.push(...resolveTied(run, groupMatches, overall, fifaRank));
    } else {
      // Head-to-head did not separate anyone → overall criteria + ranking.
      out.push(...byOverall(run, overall, fifaRank));
    }
  }
  return out;
}

export function computeGroupStandings(
  matches: MatchRow[],
  fifaRank: Map<number, number> = new Map(),
): Record<string, number[]> {
  const byGroup = new Map<string, MatchRow[]>();
  for (const m of matches) {
    if (m.stage !== "group" || !m.group_label) continue;
    if (!byGroup.has(m.group_label)) byGroup.set(m.group_label, []);
    byGroup.get(m.group_label)!.push(m);
  }

  const standings: Record<string, number[]> = {};
  for (const [label, groupMatches] of byGroup) {
    if (!groupMatches.every((m) => m.status === "finished")) continue;

    const teamIds = new Set<number>();
    for (const m of groupMatches) {
      if (m.home_team_id != null) teamIds.add(m.home_team_id);
      if (m.away_team_id != null) teamIds.add(m.away_team_id);
    }

    const overall = tally(teamIds, groupMatches);
    const byPoints = [...teamIds].sort((x, y) => overall.get(y)!.pts - overall.get(x)!.pts);
    const samePoints = (x: number, y: number) => overall.get(x)!.pts === overall.get(y)!.pts;

    const ordered: number[] = [];
    for (const run of runs(byPoints, samePoints)) {
      ordered.push(...resolveTied(run, groupMatches, overall, fifaRank));
    }
    standings[label] = ordered;
  }
  return standings;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- scoring-core`
Expected: PASS — the three new cases plus all existing `computeGroupStandings`/`computeActuals` tests. (`scoreUpfront` tests in this file still target the old shape and will be rewritten in Task 8; if they fail now that is expected, but `computeGroupStandings` and `computeActuals` describes must be green.)

> The recursive `resolveTied` re-application is implemented per spec §5; a minimal unit fixture that isolates the ≥4-team partial-split recursion is impractical to hand-build, so it is covered by construction and the 3-way/ranking cases above.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring-core.ts src/lib/__tests__/scoring-core.test.ts
git commit -m "feat(scoring): full FIFA within-group tiebreaker ladder (head-to-head + ranking)"
```

---

## Task 6: Third-place ranking + best-8 selection

**Files:**
- Modify: `src/lib/scoring-core.ts` (expose group tables with stats)
- Modify: `src/lib/bracket-core.ts` (add ranking functions)
- Test: `src/lib/__tests__/bracket-core.test.ts` (add cases)

Ranking the twelve third-placed teams (spec §5 across-group ladder) needs each third's overall stats, which `computeGroupStandings` currently discards. We expose a richer `computeGroupTables` (order **plus** per-team stats) and keep `computeGroupStandings` as a thin wrapper, then rank thirds in `bracket-core`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/__tests__/bracket-core.test.ts`, add:

```ts
import {
  rankThirdPlaceTeams,
  pickBestEightThirds,
  type GroupTables,
} from "@/lib/bracket-core";
import type { GroupStat } from "@/lib/scoring-core";

// Minimal table: only the 3rd-placed team's stats are needed for ranking.
function tbl(order: number[], thirdStat: GroupStat): GroupTables[string] {
  const stats = new Map<number, GroupStat>([[order[2], thirdStat]]);
  return { order, stats };
}

describe("third-place ranking", () => {
  it("ranks thirds by points then GD then GF", () => {
    const tables: GroupTables = {
      A: tbl([10, 11, 12, 13], { pts: 4, gd: 1, gf: 3 }), // third = 12
      B: tbl([20, 21, 22, 23], { pts: 6, gd: 2, gf: 4 }), // third = 22 (best, most pts)
      C: tbl([30, 31, 32, 33], { pts: 4, gd: 2, gf: 5 }), // third = 32 (beats A on GD)
    };
    const ranked = rankThirdPlaceTeams(tables);
    expect(ranked.map((t) => t.teamId)).toEqual([22, 32, 12]);
  });

  it("picks the best 8 of 12 and reports their groups", () => {
    const tables: GroupTables = {};
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    groups.forEach((g, i) => {
      // pts descending A..L so A's third is best, L's worst.
      tables[g] = tbl([i * 10, i * 10 + 1, i * 10 + 2, i * 10 + 3], { pts: 24 - i, gd: 0, gf: 0 });
    });
    const best = pickBestEightThirds(tables);
    expect(best.teams).toHaveLength(8);
    expect([...best.groups].sort()).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- bracket-core`
Expected: FAIL — `rankThirdPlaceTeams` / `pickBestEightThirds` / `GroupTables` not exported.

- [ ] **Step 3: Expose group tables in `scoring-core.ts`**

In `src/lib/scoring-core.ts`, add the exported types and `computeGroupTables`, and replace `computeGroupStandings` with a wrapper. Replace the current `computeGroupStandings` function (the version from Task 5) with:

```ts
export interface GroupTable {
  order: number[];
  stats: Map<number, GroupStat>;
}

export function computeGroupTables(
  matches: MatchRow[],
  fifaRank: Map<number, number> = new Map(),
): Record<string, GroupTable> {
  const byGroup = new Map<string, MatchRow[]>();
  for (const m of matches) {
    if (m.stage !== "group" || !m.group_label) continue;
    if (!byGroup.has(m.group_label)) byGroup.set(m.group_label, []);
    byGroup.get(m.group_label)!.push(m);
  }

  const tables: Record<string, GroupTable> = {};
  for (const [label, groupMatches] of byGroup) {
    if (!groupMatches.every((m) => m.status === "finished")) continue;

    const teamIds = new Set<number>();
    for (const m of groupMatches) {
      if (m.home_team_id != null) teamIds.add(m.home_team_id);
      if (m.away_team_id != null) teamIds.add(m.away_team_id);
    }

    const overall = tally(teamIds, groupMatches);
    const byPoints = [...teamIds].sort((x, y) => overall.get(y)!.pts - overall.get(x)!.pts);
    const samePoints = (x: number, y: number) => overall.get(x)!.pts === overall.get(y)!.pts;

    const order: number[] = [];
    for (const run of runs(byPoints, samePoints)) {
      order.push(...resolveTied(run, groupMatches, overall, fifaRank));
    }
    tables[label] = { order, stats: overall };
  }
  return tables;
}

export function computeGroupStandings(
  matches: MatchRow[],
  fifaRank: Map<number, number> = new Map(),
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [label, table] of Object.entries(computeGroupTables(matches, fifaRank))) {
    out[label] = table.order;
  }
  return out;
}
```

Also export the stat type — change the `interface GroupStat` declaration (added in Task 5) to `export interface GroupStat`.

- [ ] **Step 4: Add ranking functions to `bracket-core.ts`**

Add to `src/lib/bracket-core.ts` (imports at top, functions below the template):

```ts
import { computeGroupTables, type GroupStat, type GroupTable } from "@/lib/scoring-core";
import { assignThirdsAnnexC } from "@/lib/annex-c";

export type GroupTables = Record<string, GroupTable>;

export interface ThirdPlaceEntry {
  group: Group;
  teamId: number;
  stat: GroupStat;
}

// Rank the (up to 12) third-placed teams across groups — spec §5 across-group
// ladder: points → GD → GF → FIFA ranking → team id (the underivable conduct /
// drawing-of-lots criteria are skipped).
export function rankThirdPlaceTeams(
  tables: GroupTables,
  fifaRank: Map<number, number> = new Map(),
): ThirdPlaceEntry[] {
  const rank = (id: number) => fifaRank.get(id) ?? Number.MAX_SAFE_INTEGER;
  const thirds: ThirdPlaceEntry[] = [];
  for (const [group, t] of Object.entries(tables)) {
    if (t.order.length < 3) continue;
    const teamId = t.order[2];
    const stat = t.stats.get(teamId);
    if (stat) thirds.push({ group: group as Group, teamId, stat });
  }
  return thirds.sort(
    (x, y) =>
      y.stat.pts - x.stat.pts ||
      y.stat.gd - x.stat.gd ||
      y.stat.gf - x.stat.gf ||
      rank(x.teamId) - rank(y.teamId) ||
      x.teamId - y.teamId,
  );
}

export function pickBestEightThirds(
  tables: GroupTables,
  fifaRank: Map<number, number> = new Map(),
): { teams: ThirdPlaceEntry[]; groups: Set<Group> } {
  const teams = rankThirdPlaceTeams(tables, fifaRank).slice(0, 8);
  return { teams, groups: new Set(teams.map((t) => t.group)) };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- bracket-core scoring-core`
Expected: PASS — new third-place tests plus all earlier `bracket-core` and `computeGroupStandings` tests (the wrapper preserves behaviour).

- [ ] **Step 6: Commit**

```bash
git add src/lib/scoring-core.ts src/lib/bracket-core.ts src/lib/__tests__/bracket-core.test.ts
git commit -m "feat(bracket): rank third-placed teams and select the best eight"
```

---

## Task 7: Build the Round of 32 + extract predicted advancers

**Files:**
- Modify: `src/lib/bracket-core.ts`
- Test: `src/lib/__tests__/bracket-core.test.ts` (add cases)

`buildRound32` resolves every R32 slot to a team id (winner/runner from the group order, third via the Annex C assignment). `buildBracket` ties derivation together (best-8 → Annex C → R32). `predictedAdvancers` turns a user's winner-per-tie picks into the per-stage team sets that scoring consumes (survival semantics).

- [ ] **Step 1: Write the failing tests**

In `src/lib/__tests__/bracket-core.test.ts`, add:

```ts
import { buildRound32, buildBracket, predictedAdvancers, type Round32 } from "@/lib/bracket-core";

describe("buildRound32", () => {
  it("resolves fixed and third-place slots from the group order + Annex C", () => {
    const tables: GroupTables = {
      A: tbl([1, 2, 3, 4], { pts: 0, gd: 0, gf: 0 }),
      B: tbl([11, 12, 13, 14], { pts: 0, gd: 0, gf: 0 }),
      C: tbl([21, 22, 23, 24], { pts: 0, gd: 0, gf: 0 }),
    };
    const annex = { 79: "C" } as Record<number, import("@/lib/types").Group>;
    const r32 = buildRound32(tables, annex);
    expect(r32[73]).toEqual({ home: 2, away: 12 }); // 2A v 2B (runners)
    expect(r32[79]).toEqual({ home: 1, away: 23 }); // 1A v 3C (winner A, third of C)
  });
});

describe("buildBracket (12 synthetic groups)", () => {
  it("fully populates all 16 Round-of-32 matches", () => {
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    const tables: GroupTables = {};
    groups.forEach((g, i) => {
      tables[g] = tbl([i * 10, i * 10 + 1, i * 10 + 2, i * 10 + 3], { pts: 24 - i, gd: 0, gf: 0 });
    });
    const { round32, bestThirds } = buildBracket(tables);
    expect(bestThirds).toHaveLength(8);
    for (const m of Object.values(round32)) {
      expect(m.home).not.toBeNull();
      expect(m.away).not.toBeNull();
    }
    expect(round32[73]).toEqual({ home: 1, away: 11 }); // 2A v 2B
  });
});

describe("predictedAdvancers", () => {
  it("derives per-stage survival sets and the champion from winner picks", () => {
    const round32: Round32 = {
      73: { home: 1, away: 2 },
      74: { home: 3, away: 4 },
    };
    const picks = { "73": 1, "74": 3, "89": 1, "97": 1, "101": 1, "104": 1 };
    const a = predictedAdvancers(round32, picks);
    expect(a.byStage.round_of_32).toEqual(new Set([1, 2, 3, 4]));
    expect(a.byStage.round_of_16).toEqual(new Set([1, 3]));
    expect(a.byStage.quarter).toEqual(new Set([1]));
    expect(a.byStage.semi).toEqual(new Set([1]));
    expect(a.byStage.final).toEqual(new Set([1]));
    expect(a.champion).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- bracket-core`
Expected: FAIL — `buildRound32` / `buildBracket` / `predictedAdvancers` / `Round32` not exported.

- [ ] **Step 3: Implement bracket construction + advancers**

Add to `src/lib/bracket-core.ts`:

```ts
export type Round32 = Record<number, { home: number | null; away: number | null }>;

export function buildRound32(tables: GroupTables, annex: Record<number, Group>): Round32 {
  const teamAt = (g: Group, pos: number): number | null => tables[g]?.order[pos] ?? null;
  const resolve = (s: SlotRef): number | null => {
    switch (s.kind) {
      case "winner":
        return teamAt(s.group, 0);
      case "runner":
        return teamAt(s.group, 1);
      case "third": {
        const g = annex[s.match];
        return g ? teamAt(g, 2) : null;
      }
      default:
        return null; // matchWinner/Loser do not occur in the Round of 32
    }
  };
  const out: Round32 = {};
  for (const noStr of Object.keys(ROUND32)) {
    const no = Number(noStr);
    out[no] = { home: resolve(ROUND32[no].home), away: resolve(ROUND32[no].away) };
  }
  return out;
}

export interface BuiltBracket {
  round32: Round32;
  bestThirds: ThirdPlaceEntry[];
  annex: Record<number, Group>;
}

export function buildBracket(tables: GroupTables, fifaRank: Map<number, number> = new Map()): BuiltBracket {
  const best = pickBestEightThirds(tables, fifaRank);
  const annex = best.groups.size === 8 ? assignThirdsAnnexC(best.groups) : {};
  return { round32: buildRound32(tables, annex), bestThirds: best.teams, annex };
}

const NEXT_STAGE: Record<string, MatchStage | "champion"> = {
  round_of_32: "round_of_16",
  round_of_16: "quarter",
  quarter: "semi",
  semi: "final",
  final: "champion",
};

export interface PredictedAdvancers {
  byStage: Record<string, Set<number>>;
  champion: number | null;
}

// Survival semantics: reaching the next stage = winning the current tie. The 32
// teams placed into the Round of 32 all "reach" round_of_32. picks are keyed by
// canonical match number → predicted winner team id.
export function predictedAdvancers(round32: Round32, picks: Record<string, number>): PredictedAdvancers {
  const byStage: Record<string, Set<number>> = {
    round_of_32: new Set(),
    round_of_16: new Set(),
    quarter: new Set(),
    semi: new Set(),
    final: new Set(),
  };
  for (const m of Object.values(round32)) {
    if (m.home != null) byStage.round_of_32.add(m.home);
    if (m.away != null) byStage.round_of_32.add(m.away);
  }
  let champion: number | null = null;
  for (const [noStr, winner] of Object.entries(picks)) {
    const next = NEXT_STAGE[stageOf(Number(noStr))];
    if (next === "champion") champion = winner;
    else if (next) byStage[next].add(winner);
  }
  return { byStage, champion };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- bracket-core`
Expected: PASS — all `bracket-core` describes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bracket-core.ts src/lib/__tests__/bracket-core.test.ts
git commit -m "feat(bracket): build the Round of 32 and derive predicted advancers"
```

---

## Task 8: Refactor `scoreUpfront` to score predicted scorelines + the derived bracket

**Files:**
- Modify: `src/lib/scoring-core.ts` (`BracketPick`, `ADVANCE_KEYS`, imports, `scoreUpfront`)
- Test: `src/lib/__tests__/scoring-core.test.ts` (replace the `scoreUpfront` describe block)

This is the keystone of the redesign. The old `scoreUpfront` read a hand-entered `group_standings` array and a `knockout` map of team-id arrays. The new one reads the user's 72 predicted **scorelines**, derives predicted standings → bracket → advancers from them (reusing Tasks 5–7), and scores four things: group-result accuracy (exact vs. correct-result), the group-winner bonus, per-stage survival, and the champion.

**Dependency note (read before implementing):** `scoreUpfront` will import `buildBracket` and `predictedAdvancers` from `bracket-core`, which already imports `computeGroupTables` from `scoring-core`. That is a deliberate, *safe* circular import: every cross-imported symbol is a hoisted `export function` used only inside function bodies, and neither module calls across the cycle at top-level (their top-level code is static data/consts). ESM resolves the live bindings at call time, so this works in Vitest and the Next build. Do **not** "fix" it by converting these to `const` arrow exports — that would reintroduce a real top-level-evaluation cycle.

- [ ] **Step 1: Rewrite the failing tests**

In `src/lib/__tests__/scoring-core.test.ts`, replace the **entire** `describe("scoreUpfront", () => { ... })` block (and nothing else) with:

```ts
describe("scoreUpfront", () => {
  const ctx = (groupFixtures: MatchRow[] = []) => ({
    groupFixtures,
    fifaRank: new Map<number, number>(),
  });

  it("scores group results: exact beats correct-result, wrong earns nothing", () => {
    const actual = computeActuals(groupA, new Map());
    const pts = scoreUpfront(
      cfg,
      actual,
      {
        group_scores: {
          "1": { h: 2, a: 0 }, // actual 2-0 → exact
          "2": { h: 3, a: 1 }, // actual 2-1 → home win → correct result
          "3": { h: 0, a: 1 }, // actual 1-0 → wrong sign
        },
        knockout: {},
        champion_team_id: null,
      },
      ctx(groupA),
    );
    expect(pts).toBe(cfg.upfront.group_exact_score + cfg.upfront.group_correct_result);
  });

  it("awards the group-winner bonus when predicted scores yield the real winner", () => {
    const actual = computeActuals(groupA, new Map());
    // Predict every Group A match exactly → predicted standings == actual → winner = team 1.
    const group_scores: Record<string, { h: number; a: number }> = {
      "1": { h: 2, a: 0 },
      "2": { h: 2, a: 1 },
      "3": { h: 1, a: 0 },
      "4": { h: 1, a: 1 },
      "5": { h: 3, a: 1 },
      "6": { h: 0, a: 1 },
    };
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores, knockout: {}, champion_team_id: null },
      ctx(groupA),
    );
    expect(pts).toBe(6 * cfg.upfront.group_exact_score + cfg.upfront.group_winner);
  });

  it("awards advancement points for a knockout pick that reaches its stage", () => {
    // Team 5 actually reached the Round of 16; we predicted it to win R32 match 73.
    const actual = computeActuals([ko(10, "round_of_16", 5, 8)], new Map());
    const pts = scoreUpfront(
      cfg,
      actual,
      { group_scores: {}, knockout: { "73": 5 }, champion_team_id: null },
      ctx(),
    );
    expect(pts).toBe(cfg.upfront.advance_round_of_16);
  });

  it("awards champion points only for the exact champion (from the final pick)", () => {
    const actual = computeActuals([ko(20, "final", 7, 9, 2, 0, "finished")], new Map());
    expect(
      scoreUpfront(cfg, actual, { group_scores: {}, knockout: { "104": 7 }, champion_team_id: null }, ctx()),
    ).toBe(cfg.upfront.champion);
    expect(
      scoreUpfront(cfg, actual, { group_scores: {}, knockout: { "104": 8 }, champion_team_id: null }, ctx()),
    ).toBe(0);
  });

  it("returns 0 for a null bracket", () => {
    const actual = computeActuals(groupA, new Map());
    expect(scoreUpfront(cfg, actual, null, ctx(groupA))).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- scoring-core`
Expected: FAIL — `scoreUpfront` still has the old 3-arg signature and reads `group_standings`; the new `group_scores`/4th-arg calls won't compile/throw.

- [ ] **Step 3: Update `scoring-core.ts` — imports, `BracketPick`, `ADVANCE_KEYS`, `scoreUpfront`**

**3a.** Replace the top import line:

```ts
import type { ScoringConfig, MatchStage } from "@/lib/types";
```

with:

```ts
import type { ScoringConfig, MatchStage, MatchScore } from "@/lib/types";
import { buildBracket, predictedAdvancers } from "@/lib/bracket-core";
```

**3b.** Replace the `BracketPick` interface with:

```ts
export interface BracketPick {
  group_scores: Record<string, MatchScore>; // DB match id (string) → predicted score
  knockout: Record<string, number>;          // canonical match no (string) → winner team id
  champion_team_id: number | null;
}
```

**3c.** Replace the `ADVANCE_KEYS` constant with (adds the new Round-of-32 tier):

```ts
export const ADVANCE_KEYS: Record<string, keyof ScoringConfig["upfront"]> = {
  round_of_32: "advance_round_of_32",
  round_of_16: "advance_round_of_16",
  quarter: "advance_quarter",
  semi: "advance_semi",
  final: "advance_final",
};
```

**3d.** Replace the entire `scoreUpfront` function with:

```ts
export function scoreUpfront(
  cfg: ScoringConfig,
  actual: ActualOutcomes,
  bracket: BracketPick | null,
  ctx: { groupFixtures: MatchRow[]; fifaRank: Map<number, number> },
): number {
  if (!bracket) return 0;
  let pts = 0;

  // Overlay the user's predicted scorelines onto the real group fixtures, then
  // derive predicted standings and the full knockout bracket from them.
  const predictedRows: MatchRow[] = ctx.groupFixtures.map((fx) => {
    const s = bracket.group_scores?.[String(fx.id)];
    return s ? { ...fx, home_goals: s.h, away_goals: s.a, status: "finished" } : fx;
  });
  const tables = computeGroupTables(predictedRows, ctx.fifaRank);
  const { round32 } = buildBracket(tables, ctx.fifaRank);
  const adv = predictedAdvancers(round32, bracket.knockout ?? {});

  // Group-stage scoreline accuracy: an exact score beats a merely correct result.
  for (const [idStr, guess] of Object.entries(bracket.group_scores ?? {})) {
    const r = actual.results.get(Number(idStr));
    if (!r) continue;
    if (guess.h === r.home && guess.a === r.away) {
      pts += cfg.upfront.group_exact_score;
    } else if (Math.sign(guess.h - guess.a) === Math.sign(r.home - r.away)) {
      pts += cfg.upfront.group_correct_result;
    }
  }

  // Group-winner bonus: predicted 1st place matches the real 1st place.
  for (const [label, actualOrder] of Object.entries(actual.groupStandings)) {
    const predictedWinner = tables[label]?.order[0];
    if (predictedWinner != null && predictedWinner === actualOrder[0]) {
      pts += cfg.upfront.group_winner;
    }
  }

  // Survival/advancement: per stage, award for each predicted team that the real
  // tournament also pushed into that stage.
  for (const [stage, key] of Object.entries(ADVANCE_KEYS)) {
    const reached = actual.advancers[stage];
    const predicted = adv.byStage[stage];
    if (!reached || !predicted) continue;
    for (const teamId of predicted) {
      if (reached.has(teamId)) pts += cfg.upfront[key];
    }
  }

  // Champion: the winner the user picked in the final (match 104).
  const predictedChampion = adv.champion ?? bracket.champion_team_id;
  if (actual.champion != null && predictedChampion === actual.champion) {
    pts += cfg.upfront.champion;
  }

  return pts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- scoring-core`
Expected: PASS — all five `scoreUpfront` cases plus the unchanged `computeGroupStandings` / `computeActuals` / `scoreLive` describes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring-core.ts src/lib/__tests__/scoring-core.test.ts
git commit -m "feat(scoring): score predicted scorelines and the derived bracket"
```

---

## Task 9: Wire the new scoring into `scoring-engine.ts`

**Files:**
- Modify: `src/lib/scoring-engine.ts`

`recomputeAllScores` runs against the live DB (service-role client), so it has no unit test of its own — the pure logic it calls is already covered by Tasks 5–8. This task adapts the data plumbing: select `group_scores` instead of the deleted `group_standings`, build the league-independent `groupFixtures` and `fifaRank` once, and pass them as the new `ctx` argument to `scoreUpfront`.

- [ ] **Step 1: Replace the body of `recomputeAllScores`**

Replace the entire function in `src/lib/scoring-engine.ts` with (imports at the top of the file are unchanged):

```ts
// Recompute and upsert scores for every league. Call with a service-role client.
export async function recomputeAllScores(supabase: SupabaseClient) {
  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, group_label, status, home_team_id, away_team_id, home_goals, away_goals");
  const { data: goals } = await supabase.from("match_goals").select("match_id, player_id");
  const { data: teams } = await supabase.from("teams").select("id, fifa_rank");

  const goalsByMatch = new Map<number, number[]>();
  for (const g of goals ?? []) {
    if (!goalsByMatch.has(g.match_id)) goalsByMatch.set(g.match_id, []);
    goalsByMatch.get(g.match_id)!.push(g.player_id);
  }

  const matchRows = (matches ?? []) as MatchRow[];
  const actual = computeActuals(matchRows, goalsByMatch);
  const groupFixtures = matchRows.filter((m) => m.stage === "group");

  const fifaRank = new Map<number, number>();
  for (const t of teams ?? []) {
    if (t.fifa_rank != null) fifaRank.set(t.id, t.fifa_rank);
  }

  const { data: leagues } = await supabase.from("leagues").select("id, scoring");

  for (const league of leagues ?? []) {
    const cfg = (league.scoring as ScoringConfig) ?? DEFAULT_SCORING;

    const { data: brackets } = await supabase
      .from("bracket_predictions")
      .select("user_id, group_scores, knockout, champion_team_id")
      .eq("league_id", league.id);

    const { data: matchPreds } = await supabase
      .from("match_predictions")
      .select("user_id, match_id, home_goals, away_goals, scorer_ids")
      .eq("league_id", league.id);

    const predsByUser = new Map<string, typeof matchPreds>();
    for (const p of matchPreds ?? []) {
      if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, []);
      predsByUser.get(p.user_id)!.push(p);
    }

    const updates = (brackets ?? []).map((b) => ({
      league_id: league.id,
      user_id: b.user_id,
      upfront_points: scoreUpfront(cfg, actual, b, { groupFixtures, fifaRank }),
      live_points: scoreLive(cfg, actual, predsByUser.get(b.user_id) ?? []),
      updated_at: new Date().toISOString(),
    }));

    if (updates.length) {
      await supabase.from("scores").upsert(updates, { onConflict: "league_id,user_id" });
    }
  }
}
```

Notes:
- `groupFixtures` and `fifaRank` are tournament-wide (not per-league), so they are built once before the league loop.
- The `supabase` parameter is the untyped `SupabaseClient`, so `t.fifa_rank` and `b.group_scores` are `any` at compile time — `scoreUpfront`'s `BracketPick` param accepts `b` structurally. No cast needed (mirrors the existing `b` usage).

- [ ] **Step 2: Typecheck the engine wiring**

Run: `npx tsc --noEmit`
Expected: PASS — no errors. (Tasks 1, 5, 8 removed every remaining reference to the old `group_qualifier` / `group_standings` / 3-arg `scoreUpfront`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring-engine.ts
git commit -m "feat(scoring): feed group_scores + fifa ranks into recomputeAllScores"
```

---

## Task 10: Full green — test suite, typecheck, and lint

**Files:** none (verification only)

A final gate over the whole engine slice. Everything the redesign touches must compile, lint clean, and pass tests before the UI (Plan 2) is built on top of it.

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: PASS — all suites green, including `scoring-core`, `bracket-core`, `annex-c`, `scoring-config`, and any pre-existing tests. Zero failures.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors anywhere. This holds even though the bracket UI (`src/app/leagues/[id]/bracket/page.tsx`, `BracketEditor.tsx`, `actions.ts`) still uses the old shape: those files read/write the bracket via the **untyped** Supabase client and define their own local payload/knockout types — they never import the changed `BracketPrediction`/`ScoringConfig`, so reshaping those types in Task 1 does not touch them at compile time. The only *typed* consumers of the changed symbols are `scoring-core.ts` and `scoring-engine.ts`, both rewritten in Tasks 5/8/9.
>
> Those three UI files are **runtime-broken** (they reference the dropped `group_standings` column) until Plan 2 rewrites them — that is the intended Plan 1 / Plan 2 boundary, not a bug to patch here. If `tsc` *does* report an error, it will be in `src/lib/*`; fix it in the owning task, never by editing the bracket UI.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS — no new ESLint errors in `src/lib/*.ts` or the test files.

- [ ] **Step 4: Commit (only if lint/typecheck auto-fixes changed files)**

If Steps 1–3 were all clean with no file changes, skip this commit. Otherwise:

```bash
git add -A
git commit -m "chore(bracket): lint/typecheck cleanup for the derivation engine"
```

---

## Self-Review & Coverage Notes

**Spec coverage (Plan 1 = engine/scoring/data-model slice):**

| Spec section | Covered by |
|---|---|
| §4.1 Round of 32 template | Task 3 (`ROUND32`, `THIRD_MATCHES`) |
| §4.2 Bracket tree (R16→Final) | Task 3 (`BRACKET_TREE`, `stageOf`) |
| §5 within-group ladder (H2H recursion + ranking) | Task 5 (`tally`/`runs`/`byOverall`/`resolveTied`) |
| §5 across-group thirds ladder | Task 6 (`rankThirdPlaceTeams`) |
| §7 derivation (`buildBracket`, paths) | Tasks 6–7 (`computeGroupTables`, `buildRound32`, `buildBracket`, `predictedAdvancers`) |
| §7.1 Annex C (495 combos) | Task 4 (`assignThirdsAnnexC` + verification + override reconciliation) |
| §8.1 `bracket_predictions` reshape | Task 1 (types) + Task 2 (migration) |
| §8.2 `leagues.scoring` config | Task 1 (`ScoringConfig`/`DEFAULT_SCORING`) + Task 2 (jsonb default + in-place migrate) |
| §8.4 pre-launch migration/reset | Task 2 |
| §9 `scoreUpfront` (5 components incl. R32) | Task 8 |
| §9 `computeActuals` advancers incl. R32 | Already present; new tier wired via `ADVANCE_KEYS` (Task 8) |
| §11 testing | Tasks 1,3,4,5,6,7,8 (each ships its own tests) + Task 10 gate |

**Intentional gaps / deferred (not Plan 1 bugs):**

- **§8.3 seeding `match_predictions` from `group_scores`** — a write-path behavior in the bracket save action → **Plan 2**. Plan 1 only guarantees `scoreLive` is untouched and group accuracy is scored from the bracket (no double-count).
- **§10 entire bracket UI** (72-scoreline editor, derived tables, knockout tree, lock view) → **Plan 2**.
- **Annex C official-table fidelity** — Task 4 ships a *valid, deterministic, fully-tested* solver that makes all 495 combos pass; pinning FIFA's *exact* published assignment (the `OVERRIDES` table) is a research step within Task 4 Step 5, sanctioned as a fallback by spec §7.1. Software is correct and shippable without it.
- **`teams.fifa_rank` data population** — the column is added (Task 2) and consumed (Tasks 5–8); filling real ranks is a later sync. The engine falls back to team-id order, so this only affects the vanishingly rare dead-level tiebreak (spec §5).
- **Bracket UI runtime-broken window** — after Task 2's live apply + Task 1's type change, `page.tsx`/`BracketEditor.tsx`/`actions.ts` reference the dropped `group_standings` column and will 500 until Plan 2. This is the deliberate Plan 1/2 boundary (pre-launch, no users). Task 2 offers deferring the destructive apply to just before Plan 2 if a broken window is undesirable.

**Placeholder scan:** the only literal-looking values are Task 4 Step 5's example spot-check map (explicitly labelled "replace with the actual official mapping" and gated by "do not invent override values"). Every code step ships complete, runnable code; no "TBD"/"implement later".

**Type consistency:** `Group`/`MatchScore` (types) → consumed by `bracket-core`/`annex-c`/`scoring-core`; `GroupStat`/`GroupTable`/`GroupTables` exported from `scoring-core` (Task 6) → imported by `bracket-core` (Tasks 6–7); `Round32`/`buildBracket`/`predictedAdvancers` (Task 7) → imported by `scoring-core`'s `scoreUpfront` (Task 8); `ADVANCE_KEYS` stage keys, `predictedAdvancers.byStage` keys, and `computeActuals.advancers` keys all align on `round_of_32`/`round_of_16`/`quarter`/`semi`/`final`. The `scoring-core ↔ bracket-core` import cycle is function-level and safe (documented in Task 8).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-01-bracket-redesign-engine.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (1→10), review between tasks, fast iteration. Best for keeping each task's context clean and catching drift early; the FIFA-ladder and Annex C tasks especially benefit from a focused reviewer.

**2. Inline Execution** — I execute the tasks in this session with checkpoints for your review (e.g., pause at the Task 2 live-DB apply and after the Task 10 green gate).

Which approach?
