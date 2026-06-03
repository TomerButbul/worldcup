"use client";

import { useState, type ReactNode } from "react";

type TabKey = "summary" | "lineups" | "stats" | "predictions";

const TAB_LABEL: Record<TabKey, string> = {
  summary: "Summary",
  lineups: "Lineups",
  stats: "Stats",
  predictions: "Predictions",
};

// Google-style tabbed match card. Each section is server-rendered in the page
// and handed in as a ReactNode prop (null = hide that tab entirely, e.g. a draft
// league with no predictions). We only render a tab for the sections we got, and
// keep one mounted panel at a time. Order is fixed: Summary · Lineups · Stats ·
// Predictions, defaulting to the first non-null tab.
export default function MatchTabs({
  summary,
  lineups,
  stats,
  predictions,
}: {
  summary: ReactNode | null;
  lineups: ReactNode | null;
  stats: ReactNode | null;
  predictions: ReactNode | null;
}) {
  const content: Record<TabKey, ReactNode | null> = {
    summary,
    lineups,
    stats,
    predictions,
  };
  const order: TabKey[] = ["summary", "lineups", "stats", "predictions"];
  const tabs = order.filter((k) => content[k] != null);

  const [active, setActive] = useState<TabKey>(tabs[0] ?? "summary");
  // Guard against the active tab vanishing across a refresh (e.g. predictions
  // tab disappears) — fall back to the first available tab.
  const current = tabs.includes(active) ? active : (tabs[0] ?? "summary");

  if (tabs.length === 0) return null;

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Match sections"
        className="glass flex gap-1 rounded-2xl p-1"
      >
        {tabs.map((k) => {
          const isActive = k === current;
          return (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActive(k)}
              className={`relative flex-1 rounded-xl px-2 py-2 text-center font-display text-xs tracking-wide transition-colors sm:text-sm ${
                isActive
                  ? "bg-night/5 text-chalk"
                  : "text-chalk-dim hover:text-chalk"
              }`}
            >
              {TAB_LABEL[k]}
              {isActive && (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold" />
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{content[current]}</div>
    </div>
  );
}
