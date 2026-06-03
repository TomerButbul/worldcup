"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import Flag from "@/components/Flag";
import Ball from "@/components/art/Ball";

type Team = { id: number; name: string; code: string | null; logo_url: string | null };

export type PredictionRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  penWinnerTeamId: number | null;
  scorerNames: string[];
  points: number | null;
  isMe: boolean;
};

// Everyone's call for one match — managers sorted onto the SIDE of the team they
// backed (home left, away right; draws in the middle for group games). Tap a
// manager to reveal their exact scoreline + goal-scorer picks, so the split
// stays clean at a glance.
export default function MatchPredictions({
  home,
  away,
  rows,
}: {
  home: Team | null;
  away: Team | null;
  rows: PredictionRow[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  const outcomeOf = (r: PredictionRow): "home" | "away" | "draw" => {
    if (r.homeGoals == null || r.awayGoals == null) return "draw";
    if (r.homeGoals > r.awayGoals) return "home";
    if (r.homeGoals < r.awayGoals) return "away";
    if (r.penWinnerTeamId != null && home && away) return r.penWinnerTeamId === home.id ? "home" : "away";
    return "draw";
  };

  const homeBackers = rows.filter((r) => outcomeOf(r) === "home");
  const awayBackers = rows.filter((r) => outcomeOf(r) === "away");
  const drawBackers = rows.filter((r) => outcomeOf(r) === "draw");
  const total = rows.length || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  const teamCode = (id: number | null | undefined) =>
    id == null ? "" : id === home?.id ? home?.code ?? home?.name.slice(0, 3) : away?.code ?? away?.name.slice(0, 3);

  const chip = (r: PredictionRow) => {
    const isOpen = open === r.userId;
    const hasDetail = r.homeGoals != null || r.scorerNames.length > 0;
    return (
      <li key={r.userId} className={`overflow-hidden rounded-xl ${r.isMe ? "bg-grass/10 ring-1 ring-grass/40" : "bg-night/5"}`}>
        <button
          type="button"
          disabled={!hasDetail}
          onClick={() => setOpen(isOpen ? null : r.userId)}
          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left disabled:cursor-default"
        >
          <Avatar url={r.avatarUrl} name={r.name} size={22} />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-chalk">
            {r.name}
            {r.isMe && <span className="text-grass"> · you</span>}
          </span>
          {r.points != null && (
            <span className={`shrink-0 text-[10px] font-bold ${r.points > 0 ? "text-grass" : "text-chalk-dim"}`}>+{r.points}</span>
          )}
          {hasDetail && <span className={`shrink-0 text-[9px] text-chalk-dim transition ${isOpen ? "rotate-180" : ""}`}>▾</span>}
        </button>
        {isOpen && (
          <div className="border-t border-night/5 px-2 py-1.5">
            <span className="font-display text-sm text-chalk">
              {r.homeGoals != null ? `${r.homeGoals}–${r.awayGoals}` : "—"}
            </span>
            {r.penWinnerTeamId != null && (
              <span className="ml-1 text-[11px] text-chalk-dim">🥅 {teamCode(r.penWinnerTeamId)}</span>
            )}
            {r.scorerNames.length > 0 && (
              <p className="mt-0.5 text-[11px] leading-snug text-chalk-dim">
                <Ball size={11} className="mr-0.5 inline-block align-[-1px]" />
                {r.scorerNames.join(", ")}
              </p>
            )}
          </div>
        )}
      </li>
    );
  };

  const sideHeader = (team: Team | null, count: number) => (
    <div className="mb-2 flex items-center gap-1.5">
      {team && <Flag teamId={team.id} logoUrl={team.logo_url} code={team.code} name={team.name} size={20} />}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">{team?.name ?? "—"}</span>
      <span className="font-display text-sm text-gold">{count}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* At-a-glance split bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-night/10">
        <div className="bg-grass" style={{ width: `${pct(homeBackers.length)}%` }} />
        <div className="bg-night/25" style={{ width: `${pct(drawBackers.length)}%` }} />
        <div className="bg-sky-500" style={{ width: `${pct(awayBackers.length)}%` }} />
      </div>

      {/* Managers, sorted onto the side of the team they backed */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div>
          {sideHeader(home, homeBackers.length)}
          <ul className="space-y-1.5">{homeBackers.map(chip)}</ul>
          {homeBackers.length === 0 && <p className="text-center text-[11px] text-chalk-dim">—</p>}
        </div>
        <div>
          {sideHeader(away, awayBackers.length)}
          <ul className="space-y-1.5">{awayBackers.map(chip)}</ul>
          {awayBackers.length === 0 && <p className="text-center text-[11px] text-chalk-dim">—</p>}
        </div>
      </div>

      {/* Draws (group games only) */}
      {drawBackers.length > 0 && (
        <div className="border-t border-night/10 pt-3">
          <p className="mb-2 text-center text-xs font-semibold text-chalk-dim">
            Draw <span className="font-display text-gold">{drawBackers.length}</span>
          </p>
          <ul className="mx-auto grid max-w-md grid-cols-2 gap-1.5 sm:grid-cols-3">{drawBackers.map(chip)}</ul>
        </div>
      )}
    </div>
  );
}
