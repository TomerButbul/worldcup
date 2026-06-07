"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import Flag from "@/components/Flag";
import { goalCelebration } from "@/lib/goal";
import { detectGoals } from "@/lib/liveGoals";

type Mini = { id: number; name: string; code: string | null; logo_url: string | null } | null;
type Game = {
  id: number;
  stage: string;
  done: boolean; // finished within the linger window — kept briefly so the final score shows
  elapsed: number | null;
  home: Mini;
  away: Mini;
  homeGoals: number;
  awayGoals: number;
};
// The feed sorts live-first (by elapsed) then most-recently-finished (capped server-side),
// and reports how many are live / how many finished results are shown.
type Feed = { games?: Game[]; liveCount?: number; finishedShown?: number };
type Mode = "panel" | "pill" | "hidden";

// A floating live-scores widget with three states: the full panel, a compact
// "N LIVE" pill, and fully dismissed (just a tiny pulsing dot to summon it back).
// Polls /api/live (cheap — reads our synced matches table) and renders nothing
// when no games are live. Your chosen state is remembered across reloads.
export default function LiveScoresWidget() {
  const [games, setGames] = useState<Game[]>([]);
  // Trust the feed's live count when present (it knows which finished rows were capped);
  // fall back to counting client-side so a stale/old-shape response still works.
  const [liveCountServer, setLiveCountServer] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "pill";
    try {
      const m = localStorage.getItem("liveWidgetMode");
      return m === "panel" || m === "hidden" ? (m as Mode) : "pill";
    } catch {
      return "pill";
    }
  });

  // The previous poll's games — bookkeeping for goal detection, not rendered, so a
  // ref (mutating it must not trigger a re-render).
  const prevGames = useRef<Game[]>([]);

  useEffect(() => {
    let alive = true;
    // `celebrate` is true only for the recurring live poll. The initial load and the
    // refocus refresh just (re)establish the baseline silently — so we never fire a
    // takeover on first paint, nor when you simply return to a backgrounded tab.
    const load = async (celebrate: boolean) => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Feed;
        if (!alive) return;
        const nextGames = json.games ?? [];
        if (celebrate) {
          const events = detectGoals(prevGames.current, nextGames);
          if (events.length > 0) {
            // One clean takeover per cycle, even if two matches score together.
            goalCelebration("GOAL!", { subtitle: events[0].teamName });
          }
        }
        prevGames.current = nextGames;
        setGames(nextGames);
        setLiveCountServer(typeof json.liveCount === "number" ? json.liveCount : null);
      } catch {
        /* offline / transient — keep last known */
      }
    };
    void load(false);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 45_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(false);
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

  // Prefer the feed's count; fall back to counting locally (covers a stale CDN response
  // served briefly after a deploy, before the new shape propagates).
  const liveCount = liveCountServer ?? games.filter((g) => !g.done).length;
  const finishedCount = games.length - liveCount;
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
                    {finishedCount > 0 && (
                      <span className="font-normal text-chalk-dim">· {finishedCount} FT</span>
                    )}
                  </>
                ) : (
                  <>
                    FULL TIME
                    {finishedCount > 1 && <span className="font-normal text-chalk-dim">· {finishedCount}</span>}
                  </>
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
                    href={`/predict#match-${g.id}`}
                    aria-label={g.done ? "Final result" : "Live match"}
                    className={`flex items-center gap-2 px-3 py-2 text-xs transition hover:bg-night/5 ${
                      g.done ? "opacity-65 hover:opacity-100" : ""
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                      <span className="truncate font-semibold text-chalk">{code(g.home)}</span>
                      <Flag teamId={g.home?.id ?? null} logoUrl={g.home?.logo_url ?? null} code={g.home?.code ?? null} name={g.home?.name ?? "?"} size={16} />
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 font-display text-sm text-chalk ${
                        g.done ? "bg-night/[0.03]" : "bg-night/5"
                      }`}
                    >
                      {g.homeGoals}–{g.awayGoals}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Flag teamId={g.away?.id ?? null} logoUrl={g.away?.logo_url ?? null} code={g.away?.code ?? null} name={g.away?.name ?? "?"} size={16} />
                      <span className="truncate font-semibold text-chalk">{code(g.away)}</span>
                    </span>
                    {g.done ? (
                      <span className="flex w-7 shrink-0 justify-end">
                        <span className="rounded bg-night/10 px-1 py-px text-[10px] font-bold tracking-wide text-chalk-dim">
                          FT
                        </span>
                      </span>
                    ) : (
                      <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-red-600">
                        {g.elapsed != null ? `${g.elapsed}'` : "LIVE"}
                      </span>
                    )}
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
