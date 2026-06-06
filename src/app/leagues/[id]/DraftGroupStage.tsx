"use client";

import { motion } from "motion/react";
import Flag from "@/components/Flag";
import Ball from "@/components/art/Ball";

// One nation as it sits in a group table. `pts`/`played` are null pre-tournament
// (no results yet) — the row then shows a "—" instead of a points tally.
export type GroupStageTeam = {
  id: number;
  name: string;
  code: string | null;
  logo_url: string | null;
  pts: number | null;
  played: number | null;
};

// A single group (A..L) with its four teams already in finishing order.
export type GroupStageGroup = {
  group: string;
  teams: GroupStageTeam[];
};

// All 12 groups, each team's row tinted green for the top two (who advance) and
// gold for any nation the current manager drafted (marked ★ so they're spottable
// at a glance). Mirrors the group-card styling in bracket/BracketEditor.tsx.
export default function DraftGroupStage({
  groups,
  meTeamIds,
}: {
  groups: GroupStageGroup[];
  meTeamIds: number[];
}) {
  const mine = new Set(meTeamIds);
  // Any results in yet? (Used only to pick the header microcopy.)
  const hasResults = groups.some((g) => g.teams.some((t) => t.pts != null));

  if (groups.length === 0) {
    return (
      <div className="glass rounded-3xl p-6 text-center text-sm text-chalk-dim">
        <Ball size={14} className="mr-1 inline-block align-[-2px]" />
        Group draw hasn&apos;t been loaded yet.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-4 sm:p-5"
    >
      <header className="mb-3">
        <h2 className="font-display text-xl text-chalk">Group stage</h2>
        <p className="mt-0.5 text-xs text-chalk-dim">
          {hasResults ? "Live standings · t" : "T"}op 2 of each group advance. Your nations marked{" "}
          <span className="text-gold">★</span>.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.group} className="glass rounded-2xl p-3">
            <h3 className="mb-2 font-display text-base text-gold">Group {g.group}</h3>

            <ol className="space-y-1">
              {g.teams.map((t, i) => {
                const advances = i < 2;
                const isMine = mine.has(t.id);
                return (
                  <li
                    key={t.id}
                    className={`relative flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                      isMine ? "ring-1 ring-gold/70 " : ""
                    }${advances ? "bg-grass/15" : "bg-night/5"}`}
                  >
                    {isMine && (
                      <span aria-hidden className="absolute inset-y-1 left-0 w-1 rounded-full bg-gold" />
                    )}
                    <span className="w-4 shrink-0 text-center font-display text-xs text-chalk-dim">
                      {i + 1}
                    </span>
                    <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={18} />
                    <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
                      <span className={`truncate text-sm ${isMine ? "font-semibold text-gold" : "text-chalk"}`}>
                        {t.name}
                      </span>
                      {isMine && (
                        <span className="shrink-0 text-[11px] text-gold" title="Your drafted nation">
                          ★
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-display text-xs tabular-nums text-chalk-dim">
                      {t.pts != null ? (
                        <>
                          {t.pts}
                          <span className="ml-0.5 text-[9px] uppercase tracking-wide">pts</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
