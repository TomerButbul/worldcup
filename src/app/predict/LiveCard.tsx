"use client";

import { useEffect, useState, type ReactNode } from "react";
import Flag from "@/components/Flag";
import { stageLabel } from "@/lib/stages";

// A live game on the Matches list, shown as a collapsible card. The score + LIVE
// minute (and your pick) are always visible; tapping expands to the lineup pitch,
// match stats and everyone's predictions — passed in as server-rendered children.
// Predicting is over once a game kicks off, so this replaces the predict card
// while a match is in play. Collapsible because up to four can be live at once.
export type LiveCardProps = {
  matchId: number;
  stage: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  elapsed: number | null;
  predHome: number | null;
  predAway: number | null;
  venueName?: string | null;
  venueCity?: string | null;
  defaultOpen?: boolean;
  children: ReactNode;
};

export default function LiveCard({
  matchId,
  stage,
  homeTeamId,
  awayTeamId,
  homeName,
  awayName,
  homeGoals,
  awayGoals,
  elapsed,
  predHome,
  predAway,
  venueName,
  venueCity,
  defaultOpen = false,
  children,
}: LiveCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  // A deep link (/predict#match-<id>, e.g. from the live-scores widget) expands this card.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === `#match-${matchId}`) setOpen(true);
  }, [matchId]);

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="block w-full p-4 text-left transition hover:bg-night/5"
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-display text-gold">{stageLabel(stage)}</span>
          <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Live{elapsed != null ? ` ${elapsed}'` : ""}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-center gap-3 text-center sm:gap-4">
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk">
            <span className="truncate">{homeName}</span>
            <Flag teamId={homeTeamId} name={homeName} size={28} className="shrink-0" />
          </span>
          <span className="net shrink-0 rounded-xl bg-night/5 px-4 py-1.5 font-display text-2xl text-chalk">
            {homeGoals ?? 0} – {awayGoals ?? 0}
          </span>
          <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk">
            <Flag teamId={awayTeamId} name={awayName} size={28} className="shrink-0" />
            <span className="truncate">{awayName}</span>
          </span>
        </div>

        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-chalk-dim">
          {venueName && (
            <span className="truncate">
              📍 {venueName}{venueCity ? ` · ${venueCity}` : ""}
            </span>
          )}
          {predHome != null ? (
            <span className="shrink-0">
              Your pick: <span className="font-display tabular-nums text-chalk">{predHome}–{predAway}</span>
            </span>
          ) : (
            <span className="shrink-0">No pick</span>
          )}
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-chalk-dim">
            {open ? "Hide" : "Details"}
            <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </button>

      {open && <div className="space-y-5 border-t border-night/10 p-4">{children}</div>}
    </div>
  );
}
