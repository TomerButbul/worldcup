// Intentional render/request-time "now" snapshot, isolated from components so
// the react-hooks purity rule doesn't flag a bare Date.now() in render.
// (Server components render once per request; client lock checks want a snapshot.)
export const nowMs = (): number => Date.now();

// World Cup 2026 kickoff — also the moment every bracket locks.
// Noon Israel time (IDT = UTC+3 in June) == 09:00 UTC. Keep in sync with the
// leagues.bracket_lock_at default (see supabase/migrations).
export const KICKOFF_MS = Date.parse("2026-06-11T09:00:00Z");

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
