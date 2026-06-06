"use client";

import { useCallback, useEffect, useState } from "react";
import Flag from "@/components/Flag";

type Mini = { id: number; name: string; code: string | null; logo_url: string | null } | null;
type Game = {
  id: number;
  stage: string;
  elapsed: number | null;
  home: Mini;
  away: Mini;
  homeGoals: number;
  awayGoals: number;
};

// A floating, collapsible live-scores pill. Polls /api/live (cheap — reads our
// synced matches table). Renders nothing when no games are live; can be minimised
// to a tiny pill that's remembered across reloads.
export default function LiveScoresWidget() {
  const [games, setGames] = useState<Game[]>([]);
  // Default to the small collapsed pill so it never covers content uninvited —
  // expand on tap, and remember that choice across reloads.
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("liveWidgetOpen") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { games?: Game[] };
        if (alive) setGames(json.games ?? []);
      } catch {
        /* offline / transient — keep last known */
      }
    };
    void load();
    // Only poll while visible; refetch immediately on reopen/refocus so the
    // installed app shows fresh scores the instant you come back to it.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 45_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const toggle = useCallback((next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem("liveWidgetOpen", next ? "1" : "0");
    } catch {}
  }, []);

  if (games.length === 0) return null;

  const code = (t: Mini) => (t ? (t.code ?? t.name.slice(0, 3)).toUpperCase() : "—");

  return (
    <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+2.75rem)] z-40 max-w-[calc(100vw-1.5rem)] lg:top-[calc(env(safe-area-inset-top)+5rem)]">
      {open ? (
        <div className="glass-strong w-64 max-w-full overflow-hidden rounded-2xl border border-night/10 shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-night/10 px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              LIVE
              <span className="font-normal text-chalk-dim">· {games.length}</span>
            </span>
            <button
              type="button"
              onClick={() => toggle(false)}
              aria-label="Minimise live scores"
              className="rounded-md p-0.5 text-chalk-dim transition hover:bg-night/5 hover:text-chalk"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14" />
              </svg>
            </button>
          </div>
          <ul className="max-h-[40vh] divide-y divide-night/5 overflow-y-auto">
            {games.map((g) => (
              <li key={g.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  <span className="truncate font-semibold text-chalk">{code(g.home)}</span>
                  <Flag teamId={g.home?.id ?? null} logoUrl={g.home?.logo_url ?? null} code={g.home?.code ?? null} name={g.home?.name ?? "?"} size={16} />
                </span>
                <span className="net shrink-0 rounded-md bg-night/5 px-2 py-0.5 font-display text-sm text-chalk">
                  {g.homeGoals}–{g.awayGoals}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Flag teamId={g.away?.id ?? null} logoUrl={g.away?.logo_url ?? null} code={g.away?.code ?? null} name={g.away?.name ?? "?"} size={16} />
                  <span className="truncate font-semibold text-chalk">{code(g.away)}</span>
                </span>
                <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-red-600">
                  {g.elapsed != null ? `${g.elapsed}'` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => toggle(true)}
          aria-label="Show live scores"
          className="glass-strong flex items-center gap-1.5 rounded-full border border-night/10 px-3 py-2 text-xs font-bold text-red-600 shadow-lg"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          {games.length} LIVE
        </button>
      )}
    </div>
  );
}
