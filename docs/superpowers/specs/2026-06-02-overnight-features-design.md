# Overnight Feature Batch — Design & Decisions (2026-06-02)

Baseline commit: `0e3fda1` (main, synced w/ origin). Pre-launch (test users only); tournament/bracket lock = 2026-06-11T09:00:00Z.

Built autonomously overnight per explicit "do all this, continue working through the night" mandate. Could not get interactive design approval, so decisions + assumptions are documented here for morning review. Conservative + reversible on anything touching the core game model.

## Requests → plan

### 1. Countdown to next predictable game
Surface a countdown to the next match still open for prediction (kickoff in the future). Reuse the per-match-lock concept (`matches.kickoff_at`). Shown on dashboard (Phase C) and per-match (Phase B).

### 2. Edit knockout score predictions until the game happens (+ per-game countdowns)
**KEY DECISION:** This is the *existing* live per-match prediction system (`match_predictions`), which already locks each match individually at its `kickoff_at` — knockout stages included. We are NOT changing the upfront-bracket global lock (`bracket_lock_at`). So this = surface knockout matches as predictable + add a per-match countdown on each card. The matches page already lists all stages and lets you predict TBD-team knockout games before teams are known.
**Assumption:** "knockout score predictions" means the live per-match score track (live_points), not the upfront bracket winner picks. If the user meant the upfront bracket should unlock knockout per-round, that's a separate, larger change — flag it.

### 3. Home page: upcoming game + your predicted score
New dashboard widget: soonest upcoming match across the user's leagues + their `match_predictions` score (or a "predict now" CTA) + countdown.

### 4. Post-game summary (scoreline, scorers, cards, everyone's picks)
Persistent per-match summary for finished matches: final score (`matches`) + goal scorers (`match_goals ⨝ players`) + what each league member predicted (`match_predictions ⨝ profiles`).
- **Cards are NOT modeled today.** Phase D2 adds migration `0012_match_cards` + extends the API-Football sync (`fetchFixtureEvents`) to capture Card events.
- **Verification caveat:** pre-launch there are zero finished real matches, so the summary UI is built to the real data shape and verified with seeded/empty states; live correctness can only be confirmed once real fixtures finish.

### 5. Rename leagues
Owner-only rename. RLS `owner updates league` (owner_id = auth.uid()) already exists. New settings server action + UI on the league page, gated to the owner.

### 6. Themed background (flags, trophies, player cartoons, one art style)
Replace the `BALLOONS` emoji array in `AnimatedBackground.tsx` with flat SVG elements matching the existing `SoccerBall` line-art / flat-fill style and color tokens (night/grass/gold/electric/magenta). New SVGs: World Cup trophy, stylized flag motif, simple player cartoon. Keep motion/react drift + `useReducedMotion`.
**Subjective — flagged for visual review.**

## Execution order (low risk → high)
A. League rename → B. Per-match countdowns → C. Dashboard widget → D1 summary (score+scorers+picks) → D2 cards (migration + sync) → E. Background art → F. Green gate + deploy.

## Deploy policy (mirrors last night's authorized pattern)
Build + tsc/vitest/eslint/next-build + commit every phase. Deploy the solid set + apply additive migration 0012 to prod (low-risk, pre-launch, no real data). Hold/flag anything ambiguous instead of shipping it. No secrets committed; no destructive prod changes.
