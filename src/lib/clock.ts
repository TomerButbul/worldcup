// Intentional render/request-time "now" snapshot, isolated from components so
// the react-hooks purity rule doesn't flag a bare Date.now() in render.
// (Server components render once per request; client lock checks want a snapshot.)
export const nowMs = (): number => Date.now();

// World Cup 2026 kickoff — the opening match (Mexico v South Africa) and the
// moment every bracket locks. The synced fixtures put the opener at 19:00 UTC on
// Jun 11 (an early placeholder used 09:00 UTC, which left this clock 10h out of
// step with the real first match). Keep in sync with min(matches.kickoff_at) and
// the leagues.bracket_lock_at default (see supabase/migrations/0032).
export const KICKOFF_MS = Date.parse("2026-06-11T19:00:00Z");

// The Round of 32 begins right after the group stage — the moment the KNOCKOUT
// bracket locks for everyone (late joiners + reset players included). The 2026 R32
// kicks off ~Jun 28; the exact first-match time isn't in our fixtures yet (knockout
// games sync once the field is known), so this is the fallback. Once knockout
// fixtures load, the real lock is the first knockout kickoff — see knockoutLockMs().
export const KNOCKOUT_LOCK_FALLBACK_MS = Date.parse("2026-06-28T16:00:00Z");

// The actual knockout lock: the first knockout kickoff if we have it, else the
// fallback above. Pass min(matches.kickoff_at where stage <> 'group') or null.
export function knockoutLockMs(firstKnockoutKickoffMs: number | null): number {
  return firstKnockoutKickoffMs ?? KNOCKOUT_LOCK_FALLBACK_MS;
}

export type CountdownParts = { days: number; hours: number; mins: number; secs: number };

// Time remaining until `target`, broken into units. Returns null once the
// target has passed. Shared by the hero Countdown and per-match countdowns.
export function countdownParts(target: number, now: number = Date.now()): CountdownParts | null {
  const diff = target - now;
  if (diff <= 0) return null;
  const total = Math.floor(diff / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    mins: Math.floor((total % 3600) / 60),
    secs: total % 60,
  };
}
