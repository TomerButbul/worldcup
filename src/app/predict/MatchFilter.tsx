"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Tab = "upcoming" | "live" | "played";

// Top filter for the Matches page — Upcoming / Live / Played — so each "mode" is one
// tap with no scrolling past the others. Defaults to Upcoming, shows a red Live tab
// only when games are on, and remembers your last choice. A /predict#match-<id> deep
// link (from "Up next", a notification, etc.) opens that match's tab and scrolls to it.
export default function MatchFilter({
  upcoming,
  live,
  played,
  upcomingCount,
  liveCount,
  playedCount,
  tabByMatchId,
}: {
  upcoming: ReactNode;
  live: ReactNode;
  played: ReactNode;
  upcomingCount: number;
  liveCount: number;
  playedCount: number;
  tabByMatchId?: Record<string, Tab>;
}) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const pendingScroll = useRef<string | null>(null);
  useEffect(() => {
    // A deep link wins over the remembered tab: open the targeted match's tab.
    const target = (typeof window !== "undefined" ? window.location.hash : "").match(/^#match-(\d+)$/)?.[1];
    if (target && tabByMatchId?.[target]) {
      pendingScroll.current = target;
      setTab(tabByMatchId[target]);
      return;
    }
    try {
      const v = localStorage.getItem("matchesTab");
      if (v === "upcoming" || v === "live" || v === "played") setTab(v);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem("matchesTab", t);
    } catch {}
  };

  const tabs: { key: Tab; label: string; count: number; live?: boolean }[] = [
    { key: "upcoming", label: "Upcoming", count: upcomingCount },
    ...(liveCount > 0 ? [{ key: "live" as Tab, label: "Live", count: liveCount, live: true }] : []),
    { key: "played", label: "Played", count: playedCount },
  ];
  // Fall back to Upcoming if the remembered tab no longer exists (e.g. live ended).
  const active: Tab = tabs.some((t) => t.key === tab) ? tab : "upcoming";

  // After a deep link switches tabs, wait for the panel to mount, then bring the
  // targeted card into view.
  useEffect(() => {
    if (!pendingScroll.current) return;
    const id = pendingScroll.current;
    pendingScroll.current = null;
    const t = setTimeout(() => document.getElementById(`match-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Match filter" className="glass flex gap-1 rounded-2xl p-1">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => pick(t.key)}
              className={`relative flex-1 rounded-xl px-2 py-2 text-center font-display text-sm tracking-wide transition-colors ${
                isActive ? "bg-night/5 text-chalk" : "text-chalk-dim hover:text-chalk"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {t.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
                {t.label}
                <span className={`text-xs tabular-nums ${t.live ? "text-red-600" : "text-chalk-dim"}`}>{t.count}</span>
              </span>
              {isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold" />}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{active === "live" ? live : active === "played" ? played : upcoming}</div>
    </div>
  );
}
