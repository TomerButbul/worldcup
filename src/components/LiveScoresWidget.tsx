"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import Flag from "@/components/Flag";

type Mini = { id: number; name: string; code: string | null; logo_url: string | null } | null;
type Game = {
  id: number;
  stage: string;
  done: boolean; // finished in the last ~30 min — kept around so the final score shows
  elapsed: number | null;
  home: Mini;
  away: Mini;
  homeGoals: number;
  awayGoals: number;
};
type Mode = "panel" | "pill" | "hidden";

// A floating live-scores widget with three states: the full panel, a compact
// "N LIVE" pill, and fully dismissed (just a tiny pulsing dot to summon it back).
// Polls /api/live (cheap — reads our synced matches table) and renders nothing
// when no games are live. Your chosen state is remembered across reloads.
export default function LiveScoresWidget() {
  const [games, setGames] = useState<Game[]>([]);
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "pill";
    try {
      const m = localStorage.getItem("liveWidgetMode");
      return m === "panel" || m === "hidden" ? (m as Mode) : "pill";
    } catch {
      return "pill";
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

  const go = useCallback((m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem("liveWidgetMode", m);
    } catch {}
  }, []);

  if (games.length === 0) return null;

  const liveCount = games.filter((g) => !g.done).length;
  const hasLive = liveCount > 0;
  const code = (t: Mini) => (t ? (t.code ?? t.name.slice(0, 3)).toUpperCase() : "—");
  const spring = { type: "spring" as const, stiffness: 380, damping: 30 };

  return (
    <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+2.75rem)] z-40 max-w-[calc(100vw-1.5rem)] lg:top-[calc(env(safe-area-inset-top)+5rem)]">
      <AnimatePresence mode="wait" initial={false}>
        {mode === "hidden" ? (
          <motion.button
            key="dot"
            type="button"
            onClick={() => go("pill")}
            aria-label="Show live scores"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={spring}
            className="glass grid h-7 w-7 place-items-center rounded-full shadow-md ring-1 ring-night/10 transition hover:scale-110"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${hasLive ? "animate-pulse bg-red-500" : "bg-chalk-dim"}`} />
          </motion.button>
        ) : mode === "pill" ? (
          <motion.div
            key="pill"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={spring}
            className="glass-strong flex items-center gap-0.5 rounded-full p-1 shadow-lg ring-1 ring-night/10"
          >
            <button
              type="button"
              onClick={() => go("panel")}
              aria-label="Open live scores"
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition hover:bg-night/5 ${
                hasLive ? "text-red-600" : "text-chalk-dim"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${hasLive ? "animate-pulse bg-red-500" : "bg-chalk-dim"}`} />
              {hasLive ? `${liveCount} LIVE` : "FT"}
            </button>
            <button
              type="button"
              onClick={() => go("hidden")}
              aria-label="Dismiss live scores"
              className="grid h-6 w-6 place-items-center rounded-full text-chalk-dim transition hover:bg-night/5 hover:text-chalk"
            >
              <CloseIcon />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="panel"
            initial={{ scale: 0.85, opacity: 0, y: -6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: -6 }}
            transition={spring}
            className="glass-strong w-64 max-w-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-night/10"
          >
            <div className="flex items-center justify-between gap-2 border-b border-night/10 px-3 py-1.5">
              <span className={`flex items-center gap-1.5 text-xs font-bold ${hasLive ? "text-red-600" : "text-chalk-dim"}`}>
                <span className={`h-2 w-2 rounded-full ${hasLive ? "animate-pulse bg-red-500" : "bg-chalk-dim"}`} />
                {hasLive ? (
                  <>
                    LIVE <span className="font-normal text-chalk-dim">· {liveCount}</span>
                  </>
                ) : (
                  "FULL TIME"
                )}
              </span>
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => go("pill")}
                  aria-label="Minimise"
                  className="grid h-6 w-6 place-items-center rounded-md text-chalk-dim transition hover:bg-night/5 hover:text-chalk"
                >
                  <MinusIcon />
                </button>
                <button
                  type="button"
                  onClick={() => go("hidden")}
                  aria-label="Dismiss live scores"
                  className="grid h-6 w-6 place-items-center rounded-md text-chalk-dim transition hover:bg-night/5 hover:text-chalk"
                >
                  <CloseIcon />
                </button>
              </span>
            </div>
            <ul className="max-h-[40vh] divide-y divide-night/5 overflow-y-auto">
              {games.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/match/${g.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-xs transition hover:bg-night/5"
                  >
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                      <span className="truncate font-semibold text-chalk">{code(g.home)}</span>
                      <Flag teamId={g.home?.id ?? null} logoUrl={g.home?.logo_url ?? null} code={g.home?.code ?? null} name={g.home?.name ?? "?"} size={16} />
                    </span>
                    <span className="shrink-0 rounded-md bg-night/5 px-2 py-0.5 font-display text-sm text-chalk">
                      {g.homeGoals}–{g.awayGoals}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Flag teamId={g.away?.id ?? null} logoUrl={g.away?.logo_url ?? null} code={g.away?.code ?? null} name={g.away?.name ?? "?"} size={16} />
                      <span className="truncate font-semibold text-chalk">{code(g.away)}</span>
                    </span>
                    <span className={`w-7 shrink-0 text-right font-semibold tabular-nums ${g.done ? "text-chalk-dim" : "text-red-600"}`}>
                      {g.done ? "FT" : g.elapsed != null ? `${g.elapsed}'` : ""}
                    </span>
                    <span className="shrink-0 text-[10px] text-chalk-dim">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}
