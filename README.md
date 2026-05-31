# 🏆 WorldCuP 2026 — Bracket & Prediction Game

A real-time, video-game-styled World Cup prediction game for you and your friends. Predict
the full 48-team bracket up front, call the score and goal scorers of every match as the
tournament unfolds, and battle across three live leaderboards — **upfront**, **live**, and
**overall**.

Built for the 2026 FIFA World Cup (48 teams · 12 groups · 32-team knockout).

## ✨ Features

- **Upfront bracket** — rank all 12 groups (top 2 advance), then a knockout funnel
  (16 → 8 → 4 → 2 → champion) where each round is constrained to your previous picks.
- **Live match predictions** — score + goal-scorer picks for every fixture, locked at kickoff.
- **Three leaderboards, three winners** — upfront, in-tournament, and combined.
- **Real-time** — results sync from API-Football and scores update live via Supabase Realtime.
- **Leagues** — create a private league, share a join code, compete with friends.
- **Favorite team** — pick the nation you support; the app reacts to how they're really doing.
- **Profiles** — manager name, custom team name, and avatar upload.
- **Party mode** — country flags + player photos everywhere, flag bunting, floating balloons,
  confetti, synthesized sound effects, a winner's crown, and a *trolly* last-place treatment
  (wooden spoon + a "rain shame on the loser" button 🍅). Honors `prefers-reduced-motion`.

## 🧱 Tech stack

- **Next.js 16** (App Router, React 19, TypeScript)
- **Supabase** — Postgres, Auth (email/password), Storage (avatars), Realtime
- **Tailwind CSS 4**, **Framer Motion** (`motion`), **canvas-confetti**, Web Audio API
- **API-Football** for live fixtures, results, squads, and goal events
- Deploys on **Vercel** (with a cron for the sync job)

## 🚀 Getting started

1. Install deps: `npm install`
2. Create a [Supabase](https://supabase.com) project. Copy `.env.example` → `.env.local` and
   fill in the Supabase URL + anon key + service-role key.
3. Run the SQL migrations in `supabase/migrations/` **in order** (`0001` → `0007`) via the
   Supabase SQL editor.
4. In Supabase Auth → Email, turn **off** "Confirm email" (so friends can log in instantly).
5. Add your [API-Football](https://www.api-football.com/) key to `.env.local` and verify the
   World Cup league id / season.
6. `npm run dev`, then load tournament data:
   - `GET /api/sync?secret=<SYNC_SECRET>` — teams, fixtures, results
   - `GET /api/sync?secret=<SYNC_SECRET>&squads=1` — squads (for goal-scorer photos; one-time)

## 🗂️ Project structure

```
src/
  app/                 # routes: landing, auth, dashboard, leagues/[id], matches, bracket, api/sync
  components/          # Flag, Avatar, GameButton, EmojiRain, FavoriteTeam*, etc.
  lib/                 # supabase clients, scoring engine, api-football client, sound, confetti
supabase/migrations/   # schema, RLS, RPCs, storage, realtime
```

## 🧪 Quality & scripts

```bash
npm run dev     # local dev server
npm run build   # production build
npm run lint    # eslint (zero warnings)
npm test        # vitest — unit tests for the scoring engine & favorite-team logic
```

The scoring logic (`src/lib/scoring-core.ts`) is pure and covered by tests, so you can
validate group standings, knockout advancers, champion, and live match scoring without a
database. Use `supabase/seed.sql` + `GET /api/recompute?secret=…` to simulate a whole
tournament locally before the real thing kicks off.

## ⚖️ Scoring (configurable per league)

- **Upfront** — correct group winner / qualifiers, knockout advancers by round, and champion.
- **Live** — exact score, correct result, and each correct goal scorer.

---

Built with [Claude Code](https://claude.com/claude-code).
