# Unified Match Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Merge the predict surface and the 4-tab match centre into one state-driven match page — a predictor before kickoff, a live/stats board after — and turn the Matches tab into a list that links into it.

**Architecture:** The match page (`/leagues/[id]/matches/[matchId]`) becomes the single home for a match. Pre-kickoff it reuses the existing `MatchCard` predictor **unchanged** (its header/steppers/scorer-picker/autosave), with a new `embedded` flag that just hides its inline "Lineups ▾" toggle + "Full match centre" link; below it sits the projected lineup. Post-kickoff it shows the actual lineup (`MatchPitch`), stats, events, and everyone's predictions vs result — stacked, no tabs. `/predict` becomes a list of match rows that link here. Predictions are account-level (`savePrediction` fans out to every league), so passing the route's `id` as the league is safe.

**Tech Stack:** Next 16 App Router (server pages + existing client `MatchCard`/`MatchPitch`), Supabase, Tailwind 4, vitest.

**Verification note:** `/predict` and the match page are auth-gated, so visual/behaviour checks are done in the running dev server **logged in** (the dev server is already configured). `tsc --noEmit` + `vitest run` cover compile + logic at every step.

**Ordering rationale:** Tasks 1–4 make the match page a working predictor+board while `/predict` keeps its existing cards — nothing breaks. Only Task 5 flips `/predict` to a list, once predicting already works on the match page.

---

### Task 1: `embedded` flag on MatchCard

**Files:**
- Modify: `src/app/leagues/[id]/matches/MatchCard.tsx`

- [ ] **Step 1: Add the prop.** In `interface Props`, add `embedded?: boolean;` (doc: "rendered inside the match page, which shows its own lineup — hide the inline Lineups toggle + Match Centre link"). Destructure `embedded` in the component signature.
- [ ] **Step 2: Gate the lineup affordances.** Render `lineupsToggle` (both footers) and `lineupsPanel` only when `!embedded`. The locked-state "Your pick" chip, steppers, scorer picker, pen picker, autosave all stay unchanged.
- [ ] **Step 3: Verify.** `npx tsc --noEmit` clean. In the browser, `/predict` (which passes no `embedded`) renders exactly as before.
- [ ] **Step 4: Commit** — `feat(matchcard): add embedded flag to hide inline lineup affordances`.

---

### Task 2: Lineup-conversion helper (TDD)

`MatchCard`'s scorer picker needs a `Lineup` (`{ starters, subs, xi }`); the match page has `match_lineups` rows (`{ team_id, formation, xi, subs }`). Extract the conversion as tested logic.

**Files:**
- Modify: `src/lib/formation.ts`
- Test: `src/lib/formation.test.ts`

- [ ] **Step 1: Failing test.**
```ts
import { toScorerLineup } from "./formation";

test("toScorerLineup maps match_lineups xi/subs into the predict Lineup shape", () => {
  const row = { team_id: 1, formation: "4-4-2",
    xi: [{ player_id: 9, name: "X", pos: "F", grid: "4:1" }],
    subs: [{ player_id: 20, name: "Y", pos: "F", grid: null }] };
  expect(toScorerLineup(row)).toEqual({
    starters: [9], subs: [20],
    xi: [{ player_id: 9, name: "X", pos: "F", grid: "4:1" }],
  });
});
test("toScorerLineup returns null for a missing row", () => {
  expect(toScorerLineup(null)).toBeNull();
});
```
- [ ] **Step 2:** `npx vitest run src/lib/formation.test.ts` → FAIL (not defined).
- [ ] **Step 3: Implement** in `formation.ts`:
```ts
export function toScorerLineup(
  row: { xi: FormationPlayer[]; subs: FormationPlayer[] } | null,
): { starters: number[]; subs: number[]; xi: { player_id: number; name?: string | null; pos?: string | null; grid?: string | null }[] } | null {
  if (!row) return null;
  return {
    starters: row.xi.map((p) => p.player_id),
    subs: row.subs.map((p) => p.player_id),
    xi: row.xi.map((p) => ({ player_id: p.player_id, name: p.name, pos: p.pos ?? null, grid: p.grid ?? null })),
  };
}
```
- [ ] **Step 4:** `npx vitest run src/lib/formation.test.ts` → PASS.
- [ ] **Step 5: Commit** — `feat(formation): toScorerLineup helper`.

---

### Task 3: Match page fetches the predictor's data

**Files:**
- Modify: `src/app/leagues/[id]/matches/[matchId]/page.tsx`

- [ ] **Step 1:** Import `getCachedPlayers` from `@/lib/tournamentData`, `toScorerLineup` from `@/lib/formation`, and `MatchCard`, `type MatchCardData`, `type Lineup` from `../MatchCard`.
- [ ] **Step 2:** After the existing fetches, derive (no render change yet):
  - `squad = await getCachedPlayers()` → `homePlayers`/`awayPlayers` = squad filtered to `home_team_id`/`away_team_id` with `in_squad` (mirror `/predict` lines 48–53).
  - `myPredRow` = the current user's row out of `preds` (`p.user_id === user.id`) → `initial: { home_goals, away_goals, scorer_goals, pen_winner_team_id } | null`.
  - `homeScorerLineup`/`awayScorerLineup` = `toScorerLineup(lineupByTeam.get(teamId))` (official XI when posted); fall back to a `team_lineups` last-XI fetch like `/predict` lines 103–115 when absent.
  - `cardData: MatchCardData` = map `match` → the `toCard` shape (`/predict` lines 133–149).
- [ ] **Step 3:** Verify `npx tsc --noEmit` clean (still rendering MatchTabs).
- [ ] **Step 4: Commit** — `feat(match-page): fetch squad + prediction + scorer lineup`.

---

### Task 4: Match page state-driven render (retire tabs)

**Files:**
- Modify: `src/app/leagues/[id]/matches/[matchId]/page.tsx`

- [ ] **Step 1:** Keep building `summaryTab`, `statsTab`, `predictionsTab` exactly as today (reused as plain sections). Build a `lineupBlock = lineupsTab` (the `<Pitch>`), and an `<h2>`-titled wrapper for each section.
- [ ] **Step 2:** Replace the `<MatchTabs .../>` element with a state switch:
```tsx
{!locked ? (
  // PRE-KICKOFF — predictor + projected lineup. MatchCard supplies teams+score.
  <div className="space-y-6">
    <MatchCard
      leagueId={id} match={cardData}
      homePlayers={homePlayers} awayPlayers={awayPlayers}
      initial={initial}
      homeLineup={homeScorerLineup} awayLineup={awayScorerLineup}
      embedded
    />
    {lineupBlock /* projected XI when posted; <Pitch> returns null if no lineup */}
    {league.kind !== "draft" && (
      <p className="glass rounded-2xl p-4 text-center text-sm text-chalk-dim">
        🔒 Everyone&apos;s predictions are revealed the moment this match kicks off.
      </p>
    )}
  </div>
) : (
  // LIVE / FINISHED — board: lineup, stats, summary, predictions
  <div className="space-y-6">
    {lineupBlock}
    <section><h2 className="mb-2 font-display text-lg text-chalk">Stats</h2>{statsTab}</section>
    {summaryTab && <section><h2 className="mb-2 font-display text-lg text-chalk">Match events</h2>{summaryTab}</section>}
    {predictionsTab}
  </div>
)}
```
- [ ] **Step 3:** Render the existing teams/score header block (lines 533–634) **only when `locked`** (pre-kickoff, MatchCard already shows teams+score+steppers). Keep the `← Matches` back link in both states; point it at `/predict`.
- [ ] **Step 4:** Verify `npx tsc --noEmit` clean. Logged-in browser checks:
  - Upcoming match → MatchCard predictor (steppers + scorer pitch) + projected lineup (or the "lineups ~1h before" empty state) + the revealed-at-kickoff note. Editing a score autosaves (unchanged).
  - Live/finished match → score header + lineup (badges) + stats + events + predictions. **No tab bar.**
  - Draft league match → projected lineup, no predictions section.
- [ ] **Step 5: Commit** — `feat(match-page): one state-driven page (predict pre-KO, board post-KO)`.

---

### Task 5: Retire MatchTabs

**Files:**
- Modify: `page.tsx` (remove the `MatchTabs` import + the `defaultTab` plumbing)
- Delete: `src/app/leagues/[id]/matches/[matchId]/MatchTabs.tsx`

- [ ] **Step 1:** Remove the import and any now-unused vars (`defaultTab`).
- [ ] **Step 2:** `grep -r MatchTabs src` → no references; delete the file.
- [ ] **Step 3:** Verify `npx tsc --noEmit` clean; reload a match page.
- [ ] **Step 4: Commit** — `refactor: remove MatchTabs (page is no longer tabbed)`.

---

### Task 6: Matches tab (`/predict`) → list of rows

**Files:**
- Create: `src/app/predict/MatchListRow.tsx` (client `Link` row)
- Modify: `src/app/predict/page.tsx`

- [ ] **Step 1:** Create `MatchListRow` — a `Link` to `/leagues/${leagueId}/matches/${id}` showing: home flag+name, score (`h–a` when `finished`/`live`, else kickoff time), away name+flag, a small status chip (LIVE pulse / "FT" / "Predict →" when upcoming and no pick), and a chevron. Mirror `FixturesList.tsx`'s row styling for consistency.
- [ ] **Step 2:** In `page.tsx`, replace `renderCard` (which renders `MatchCard`) with `renderRow` using `MatchListRow`, passing `leagueId`. Keep the live / upcoming-by-day / past sections and the "predict earlier" disclosure. Drop the now-unused MatchCard import + the squad/lineup fetching that only fed the cards.
- [ ] **Step 3:** Verify `npx tsc --noEmit` clean. Logged-in browser: `/predict` is a tappable list; tapping an upcoming match → predictor page; tapping a finished match → board page. A "Predict →" hint shows on upcoming matches with no pick.
- [ ] **Step 4: Commit** — `feat(predict): Matches tab is a list linking to match pages`.

---

### Task 7: Cleanup

**Files:**
- Delete: `src/app/preview/lineup/`, `src/app/preview/predict/`, `src/app/preview/match/`
- Review: `src/components/lineup/FormationPitch.tsx` (`TeamPitch`) + `PlayerChip` `interactive` branch + `src/lib/formation.ts` (`positionXI "single"`)

- [ ] **Step 1:** Delete the three throwaway `/preview/*` routes added during design review.
- [ ] **Step 2:** `TeamPitch` + the `interactive` chip branch are unused in the final app (the predictor stays on `MatchCard`'s own pitch per "leave predict alone"). Decide: remove them, OR keep `TeamPitch`/`positionXI("single")` if a later team-card unification is planned. Default: **remove** the unused `interactive` branch + `TeamPitch` to keep the surface clean; keep `positionXI`/`deriveFormation`/`applySubs`/`aggregatePlayerStats` (used by `MatchPitch`).
- [ ] **Step 3:** Verify `npx tsc --noEmit` + `npx vitest run` all green. `grep -r "preview/" src` → no references.
- [ ] **Step 4: Commit** — `chore: remove design-review preview routes + unused scaffolding`.

---

## Out of scope (explicitly)
- The predictor's mechanics/look (`MatchCard`'s steppers, scorer picker, autosave) — **unchanged** per "leave predict alone".
- Team-card (`TeamFormation`) unification — not part of this; it keeps its current pitch.
- The match-centre lineup itself — already shipped on this branch (`MatchPitch` via the `Pitch` adapter).
- Bottom-nav changes — the "Matches" tab still points at `/predict`; only its *contents* change to a list.
