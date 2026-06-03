"use client";

import type { JSX } from "react";
import Flag from "@/components/Flag";

// A single team as it appears in the bracket. Mirrors the shape the consumer
// already has on hand (id + display name + crest code/logo for <Flag>).
export type BracketTeam = {
  id: number;
  name: string;
  code: string | null;
  logo_url: string | null;
};

// One knockout tie, keyed by its canonical match number (e.g. 104 = the final).
// `home`/`away`/`winner` are team ids (or null when not yet resolved / unpicked).
export type BracketMatch = {
  no: number;
  home: number | null;
  away: number | null;
  winner: number | null;
};

// A round = one column of the bracket. `matches` are in vertical (bracket) order
// so that each later round's match centres between its two feeders.
export type BracketRound = {
  stage: string;
  label: string;
  matches: BracketMatch[];
};

export default function KnockoutBracket({
  rounds,
  teamsById,
  highlightIds,
  onPick,
  locked,
  championNo,
}: {
  rounds: BracketRound[]; // in tournament order: R32 … Final
  teamsById: Record<number, BracketTeam>; // lookup for ids in the matches
  highlightIds?: number[]; // teams to highlight + trace path (favorite / drafted nations)
  onPick?: (matchNo: number, teamId: number) => void; // if given AND !locked → interactive
  locked?: boolean;
  championNo?: number; // canonical no of the final (104) — its winner is crowned
}): JSX.Element {
  const highlight = new Set(highlightIds ?? []);
  const interactive = typeof onPick === "function" && !locked;

  // The crowned team = winner of the final (the round whose match no === championNo,
  // falling back to the last round's last match if no championNo is supplied).
  const championTeamId = (() => {
    if (championNo != null) {
      for (const r of rounds) {
        const m = r.matches.find((x) => x.no === championNo);
        if (m) return m.winner;
      }
      return null;
    }
    const last = rounds[rounds.length - 1]?.matches.at(-1);
    return last?.winner ?? null;
  })();

  // One team row inside a match card. Highlighted teams get the gold trail
  // treatment; the tie's winner gets a grass fill + ✓. Becomes a <button> only
  // when the bracket is interactive and the slot is filled.
  const teamRow = (matchNo: number, teamId: number | null, isWinner: boolean) => {
    if (teamId == null) {
      return (
        <div className="flex min-h-9 items-center rounded-lg border border-dashed border-night/15 px-2 py-1.5 text-xs italic text-chalk-dim">
          TBD
        </div>
      );
    }

    const t = teamsById[teamId];
    const name = t?.name ?? "?";
    const isGold = highlight.has(teamId);
    const canPick = interactive;

    const base =
      "flex min-h-9 w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition";
    const tone = isWinner
      ? "net border-grass bg-grass text-night font-semibold"
      : isGold
        ? "border-gold bg-gold/15 text-gold font-medium"
        : "border-night/10 text-chalk";
    const hover = canPick && !isWinner ? "hover:bg-night/5" : "";

    const inner = (
      <>
        <Flag
          teamId={teamId}
          logoUrl={t?.logo_url ?? null}
          code={t?.code ?? null}
          name={name}
          size={16}
        />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {isWinner && <span className="shrink-0 text-[11px] leading-none">✓</span>}
      </>
    );

    if (canPick) {
      return (
        <button
          type="button"
          onClick={() => onPick!(matchNo, teamId)}
          aria-label={`Pick ${name} to win`}
          className={`${base} ${tone} ${hover}`}
        >
          {inner}
        </button>
      );
    }
    return <div className={`${base} ${tone}`}>{inner}</div>;
  };

  const matchCard = (m: BracketMatch) => {
    // A card sits on the gold trail if either participant is highlighted.
    const onTrail =
      (m.home != null && highlight.has(m.home)) ||
      (m.away != null && highlight.has(m.away));
    const isFinal = championNo != null && m.no === championNo;

    return (
      <div
        key={m.no}
        className={`glass relative overflow-hidden rounded-xl p-1.5 ${
          onTrail ? "ring-1 ring-gold/70" : ""
        } ${isFinal ? "ring-1 ring-gold" : ""}`}
      >
        {/* Gold left-accent bar reinforces a highlighted team's path. */}
        {onTrail && (
          <span
            aria-hidden
            className="absolute inset-y-1 left-0 w-1 rounded-full bg-gold"
          />
        )}
        <div className="space-y-1">
          {teamRow(m.no, m.home, m.winner != null && m.winner === m.home)}
          {teamRow(m.no, m.away, m.winner != null && m.winner === m.away)}
        </div>
      </div>
    );
  };

  const champTeam = championTeamId != null ? teamsById[championTeamId] : null;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch gap-3">
        {rounds.map((round) => (
          <div
            key={round.stage}
            className="flex min-w-[160px] flex-1 flex-col justify-around gap-2"
          >
            <div className="sticky top-0 z-10 mb-1 rounded-lg bg-pitch/80 px-2 py-1 text-center font-display text-[11px] uppercase tracking-wide text-chalk-dim backdrop-blur">
              {round.label}
            </div>
            {round.matches.map((m) => matchCard(m))}
          </div>
        ))}

        {/* Trailing Champion column. */}
        <div className="flex min-w-[160px] flex-col justify-around">
          <div className="sticky top-0 z-10 mb-1 rounded-lg bg-pitch/80 px-2 py-1 text-center font-display text-[11px] uppercase tracking-wide text-gold backdrop-blur">
            Champion
          </div>
          {champTeam ? (
            <div className="glass-strong flex flex-col items-center gap-1.5 rounded-2xl border border-gold bg-gold/15 p-3 text-center text-gold glow-gold">
              <span className="text-lg leading-none">👑</span>
              <Flag
                teamId={champTeam.id}
                logoUrl={champTeam.logo_url}
                code={champTeam.code}
                name={champTeam.name}
                size={28}
              />
              <span className="font-display text-sm leading-tight">{champTeam.name}</span>
            </div>
          ) : (
            <div className="glass flex flex-col items-center gap-1 rounded-2xl border border-dashed border-gold/40 p-3 text-center">
              <span className="text-lg leading-none opacity-60">🏆</span>
              <span className="font-display text-xs uppercase tracking-wide text-chalk-dim">
                Champion
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
