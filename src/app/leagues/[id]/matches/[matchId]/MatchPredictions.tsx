"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import Flag from "@/components/Flag";
import { type PredictionRow } from "@/lib/matchPredictions";

export type { PredictionRow };

type Team = { id: number; name: string; code: string | null; logo_url: string | null };

// Everyone's call for one match. Each manager sits under the team they backed to
// win (home / away), with draws in their own section. The chip shows just the
// manager's name — tap it to open a modal with their exact scoreline + goal
// scorers (faces + names), so the at-a-glance split stays clean.
export default function MatchPredictions({
  home,
  away,
  rows,
}: {
  home: Team | null;
  away: Team | null;
  rows: PredictionRow[];
}) {
  const [open, setOpen] = useState<PredictionRow | null>(null);

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
  const scoreOf = (r: PredictionRow) =>
    r.homeGoals != null && r.awayGoals != null ? `${r.homeGoals}–${r.awayGoals}` : "—";

  const chip = (r: PredictionRow) => (
    <li key={r.userId}>
      <button
        type="button"
        onClick={() => setOpen(r)}
        className={`flex w-full items-center gap-1.5 rounded-xl bg-night/5 px-2 py-1.5 text-left transition hover:bg-night/10 ${
          r.isMe ? "ring-1 ring-gold/50" : ""
        }`}
      >
        <Avatar url={r.avatarUrl} name={r.name} size={22} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-chalk">
          {r.name}
          {r.isMe && <span className="font-bold text-gold"> (you)</span>}
        </span>
        <span className="shrink-0 rounded bg-night/10 px-1.5 font-display text-xs tabular-nums text-chalk">{scoreOf(r)}</span>
        {r.points != null && (
          <span className={`shrink-0 text-[10px] font-bold ${r.points > 0 ? "text-grass" : "text-chalk-dim"}`}>
            +{r.points}
          </span>
        )}
        <span className="shrink-0 text-[10px] text-chalk-dim">›</span>
      </button>
    </li>
  );

  const column = (team: Team | null, backers: PredictionRow[], tint: string) => (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        {team && <Flag teamId={team.id} logoUrl={team.logo_url} code={team.code} name={team.name} size={20} />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-chalk">
          {team?.name ?? "—"} <span className="text-[11px] font-normal text-chalk-dim">to win</span>
        </span>
        <span className={`font-display text-sm ${tint}`}>{backers.length}</span>
      </div>
      {backers.length ? (
        <ul className="space-y-1.5">{backers.map(chip)}</ul>
      ) : (
        <p className="text-center text-[11px] text-chalk-dim">—</p>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* At-a-glance split bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-night/10">
        <div className="bg-grass" style={{ width: `${pct(homeBackers.length)}%` }} />
        <div className="bg-night/30" style={{ width: `${pct(drawBackers.length)}%` }} />
        <div className="bg-sky-500" style={{ width: `${pct(awayBackers.length)}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {column(home, homeBackers, "text-grass")}
        {column(away, awayBackers, "text-sky-500")}
      </div>

      {drawBackers.length > 0 && (
        <div className="rounded-2xl border border-night/10 bg-night/[0.03] p-3">
          <p className="mb-2 flex items-center justify-center gap-1.5">
            <span className="rounded-full bg-night/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-chalk">
              Draw
            </span>
            <span className="font-display text-sm text-chalk">{drawBackers.length}</span>
          </p>
          <ul className="mx-auto grid max-w-md grid-cols-2 gap-1.5 sm:grid-cols-3">{drawBackers.map(chip)}</ul>
        </div>
      )}

      {open && <PredictionModal row={open} home={home} away={away} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PredictionModal({
  row,
  home,
  away,
  onClose,
}: {
  row: PredictionRow;
  home: Team | null;
  away: Team | null;
  onClose: () => void;
}) {
  const score = row.homeGoals != null && row.awayGoals != null ? `${row.homeGoals}–${row.awayGoals}` : "—";
  const isDraw = row.homeGoals != null && row.homeGoals === row.awayGoals;
  const penTeam =
    row.penWinnerTeamId == null
      ? null
      : row.penWinnerTeamId === home?.id
        ? home
        : row.penWinnerTeamId === away?.id
          ? away
          : null;
  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-night/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-strong w-full max-w-xs rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2">
          <Avatar url={row.avatarUrl} name={row.name} size={26} />
          <span className="font-display text-lg text-chalk">
            {row.name}
            {row.isMe && <span className="text-gold"> (you)</span>}
          </span>
        </div>
        <p className="mt-0.5 text-center text-[11px] uppercase tracking-wide text-chalk-dim">predicts</p>

        <div className="mt-2 flex items-center justify-center gap-3">
          {home && <Flag teamId={home.id} logoUrl={home.logo_url} code={home.code} name={home.name} size={26} />}
          <span className="font-display text-4xl tabular-nums text-gradient-gold">{score}</span>
          {away && <Flag teamId={away.id} logoUrl={away.logo_url} code={away.code} name={away.name} size={26} />}
        </div>
        {isDraw && (
          <p className="mt-1 text-center text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">Draw</p>
        )}
        {penTeam && <p className="mt-1 text-center text-xs text-chalk-dim">🥅 {penTeam.name} win on penalties</p>}

        {row.scorers.length > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">
              Goal scorers
            </p>
            {[home, away].map((team) => {
              const ts = team ? row.scorers.filter((s) => s.teamId === team.id) : [];
              if (!team || ts.length === 0) return null;
              return (
                <div key={team.id}>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-chalk">
                    <Flag teamId={team.id} logoUrl={team.logo_url} code={team.code} name={team.name} size={16} />
                    {team.name}
                  </p>
                  <ul className="space-y-1.5">
                    {ts.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg bg-night/5 px-2 py-1">
                        <Avatar url={s.photo} name={s.name} size={28} />
                        <span className="min-w-0 flex-1 truncate text-sm text-chalk">{s.name}</span>
                        {s.count > 1 && <span className="shrink-0 text-xs font-bold text-gold">×{s.count}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-center text-xs text-chalk-dim">No goal scorers picked.</p>
        )}

        {row.points != null && <p className="mt-3 text-center text-sm font-bold text-grass">+{row.points} pts</p>}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-night transition hover:brightness-110"
        >
          Close
        </button>
      </div>
    </div>
  );
}
