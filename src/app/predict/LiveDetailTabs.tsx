"use client";

import { useState, type ReactNode } from "react";

// The expanded live card's detail as tabs (Lineups / Stats / Events / Predictions)
// rather than one long scroll. Each panel is server-rendered and passed in; only
// the active one mounts. The Events tab is dropped when there are no events.
export default function LiveDetailTabs({
  lineups,
  stats,
  events,
  predictions,
}: {
  lineups: ReactNode;
  stats: ReactNode;
  events: ReactNode | null;
  predictions: ReactNode;
}) {
  const tabs: { key: string; label: string; panel: ReactNode }[] = [
    { key: "lineups", label: "Lineups", panel: lineups },
    { key: "stats", label: "Stats", panel: stats },
    ...(events ? [{ key: "events", label: "Events", panel: events }] : []),
    { key: "predictions", label: "Predictions", panel: predictions },
  ];
  const [active, setActive] = useState("lineups");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Match details" className="flex gap-1 rounded-xl bg-night/5 p-1">
        {tabs.map((t) => {
          const on = t.key === current.key;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-center font-display text-xs tracking-wide transition ${
                on ? "bg-white text-chalk shadow-sm" : "text-chalk-dim hover:text-chalk"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{current.panel}</div>
    </div>
  );
}
