# Unified lineup pitch + reachable match centre

- **Date:** 2026-06-06
- **Status:** Approved (design), pending implementation plan
- **Owner:** Tomer

## Problem

The match experience has three related issues, all surfaced just before launch:

1. **The match-centre lineup looks broken.** In `src/app/leagues/[id]/matches/[matchId]/Pitch.tsx`, both teams share one tall, narrow vertical pitch. The two halves are positioned so the forwards land ~4% apart vertically and **collide at the halfway line**. The team headers are also lopsided — the away name floats top-left (a `flex justify-between` with a single child) while the home name is centred below the pitch.

2. **The match centre is buried.** `/leagues/[id]/matches/[matchId]` has no primary-nav entry. The only in-app link is a tiny gold "Full match centre →" text link hidden *inside* the `Lineups ▾` expander on a predict card. (`/leagues/[id]/matches` just redirects to `/predict`.) The "Matches" bottom-nav tab points at `/predict` — the prediction surface — not the match centre.

3. **Three different pitch renderers.** The same "formation pitch" concept is drawn three ways, three sizes, with two different avatar components:
   - `Pitch.tsx` — match centre + inline predict preview: vertical, **both teams**, `aspect-[3/5]`, raw `<img>` avatars.
   - `TeamFormation.tsx` — team profile: half pitch, **one team**, `aspect-[5/6]`, `PlayerAvatar`.
   - `TeamScorers` pitch inside `MatchCard.tsx` — predict scorer picker: half pitch, **one team**, `aspect-[5/6]`, `PlayerAvatar`, interactive.

## Goals

- One shared, consistent formation pitch used in all three places.
- The match-centre lineup looks correct: both teams on one pitch, no overlap, balanced headers.
- The match centre is easy to reach from where users already are.
- No regressions to the prediction flow.

## Non-goals (scope guard)

- Not redesigning the match-centre Summary / Stats / Predictions tabs.
- Not changing prediction *semantics* (scoring, scorer caps, autosave).
- No data / sync / schema changes.
- Not adding a new bottom-nav destination.

## Design decisions (all confirmed)

1. **Match-centre layout:** both teams on one pitch (classic match view), rebuilt with proper spacing — not stacked half-pitches, not a toggle.
2. **Reachability:** a clear, always-visible `Match Centre →` affordance per match (no new nav tab).
3. **Card has two lives, split at kickoff:**
   - **Before kickoff (unlocked):** predictor as today + a clear `Match Centre →` link.
   - **After kickoff (locked):** prediction controls gone; the whole card taps through to the match centre; the read-only "Your pick: H–A · tap for detail" chip stays; the inline `Lineups ▾` toggle is dropped (the match centre owns the unified lineup).

## Architecture

Three new shared units, then migrate the three call sites onto them.

### `src/lib/formation.ts` (pure logic, no JSX)

Consolidates the position math currently copy-pasted across the three files.

- `positionXI(xi, mode)` → `{ player, x, y, label }[]`, where `mode` is:
  - `"team"` — single team, half pitch. GK near the bottom goal line, forwards near the top (the existing `y = 88 - frac*74` behaviour).
  - `"home"` — two-team pitch, **bottom half only** (GK ~96% → forwards ~58%).
  - `"away"` — two-team pitch, **top half only** (GK ~4% → forwards ~42%), labels reversed (team faces down).
  - The 16% centre band between `~42%` and `~58%` is what removes the collision.
  - Uses real grid `"row:col"` coords when present; falls back to position rows (G/D/M/F). Labels via the existing `rowLabels` from `src/lib/positions.ts`.
- `deriveFormation(xi)` — moved from `TeamFormation.tsx`.
- `applySubs(lineup, events)` and `aggregatePlayerStats(events)` — moved from `Pitch.tsx` (the `currentXI` / `aggregateStats` helpers), so the live match logic is shared and unit-testable.

### `src/components/lineup/PlayerChip.tsx`

One player tile, used in every pitch. Built on `PlayerAvatar` + `PlayerCardButton`.

- Always: avatar + last name + `POS · OVR` label; `tone` (`home` | `away` | `neutral`) controls the avatar ring.
- Optional `number` badge.
- Optional `interactive` (predict): tapping the **face** runs an add-goal callback (with a count badge + cap-disable); tapping the **name** opens the player card with the same add-goal action. Mirrors today's two-target behaviour.
- Optional `badges` (match centre): goals / assists / yellow / red corner marks.
- Default (team profile, match-centre display): the whole tile opens the player card via `PlayerCardButton`.

### `src/components/lineup/FormationPitch.tsx`

The public pitch component. Renders the green field + markings, positions chips via `formation.ts`, draws a `PlayerChip` per player.

- `mode="team"` — single team, half-pitch markings (goal box bottom, centre arc top). Used by team profile (static) and predict picker (passes `interactive`).
- `mode="match"` — two teams on one full pitch (centre line + both boxes), symmetric **centred** headers (away + formation above, home + formation below), plus the substitutes/bench grid and the live-event badges. Used by the match centre.
- Avatars come from `PlayerAvatar` (player id) everywhere → the match centre no longer threads a `photoById` map.
- Responsive width so chips have room (wider on desktop, where the page is `max-w-5xl`).

## Call-site migration

| File | Change |
|---|---|
| `src/app/leagues/[id]/matches/[matchId]/Pitch.tsx` | Becomes a thin adapter: maps the page's data into `FormationPitch mode="match"` and re-exports the `EventRow` / `LineupRow` types its importers (`page.tsx`, `MatchCard.tsx`'s `LazyPitch`) already rely on. Overlap fixed; headers balanced; benches + badges preserved. |
| `src/app/leagues/[id]/matches/[matchId]/page.tsx` | Drops the `photoById` plumbing now that avatars are id-based. |
| `src/app/leagues/[id]/TeamFormation.tsx` | Becomes a thin wrapper over `FormationPitch mode="team"` (static). |
| `src/app/leagues/[id]/matches/MatchCard.tsx` | (a) `TeamScorers` pitch → `FormationPitch mode="team"` with `interactive`. (b) Always-visible `Match Centre →` link pre-kickoff. (c) Locked card → tap-through gateway to the match centre; keep read-only pick chip; drop inline `Lineups ▾`. |

Existing deep links into the match centre (live-scores widget `→ /match/[id]`, Tournament → Fixtures rows, `NextMatchCard` when given a `leagueId`) keep working unchanged.

## Verification plan

Run the dev server and check, in the browser:

- **Team profile** pitch renders (formation label, avatars, OVR).
- **Predict picker** (pre-kickoff, squads loaded): tap face = add goal, count badge, cap-disable, tap name = player card; "Your scorers" + search list unaffected.
- **Match centre**, three states: (a) upcoming with lineups posted, (b) **live with subs + goals + cards** (badges, bench strike-through, sub arrows), (c) no-lineup empty state. Confirm **no overlap at the halfway line** and balanced headers, on mobile width and desktop width.
- **Card lifecycle:** unlocked card shows predictor + `Match Centre →`; after kickoff the card becomes a tap-through with the read-only pick chip and no `Lineups ▾`.
- Confirm `PlayerAvatar`'s api-sports CDN resolves for these players (already true on two existing surfaces).

## Risks

- **Predict interactivity** is the most delicate behaviour to preserve through the chip abstraction — verify add-goal, count, and cap-disable explicitly.
- **Avatar source change** in the match centre (DB `photo_url` → id-based CDN). Low risk (same source the other two pitches already use) but verify visually.
- **Motion animations** (`layout` / `layoutId` on subs) — preserve or intentionally simplify; don't leave them half-wired.

## Out of scope / follow-ups

- Revisiting whether the "Matches" bottom-nav tab should point somewhere other than `/predict`.
- Any redesign of the match-centre tabs themselves.
