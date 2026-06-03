"use client";

import { Fragment, useState, type JSX } from "react";
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

// A round = one phase of the bracket. `matches` are in vertical bracket order.
export type BracketRound = {
  stage: string;
  label: string;
  matches: BracketMatch[];
};

const SHORT_LABEL: Record<string, string> = {
  round_of_32: "R32",
  round_of_16: "R16",
  quarter: "QF",
  semi: "SF",
  final: "Final",
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

  // Two ways to read the same bracket:
  //  • "rounds" — paged, one phase at a time (best for picking on mobile)
  //  • "tree"   — a compact connected bracket from R16 → Final (the big picture)
  const [view, setView] = useState<"rounds" | "tree">("rounds");

  // Round-by-round paging — one phase at a time, no horizontal scroll.
  const [active, setActive] = useState(0);
  const safeActive = Math.max(0, Math.min(active, rounds.length - 1));
  const round = rounds[safeActive];
  const isFinalRound = safeActive === rounds.length - 1;

  // The full-bracket tree starts at R16 (a clean 8→4→2→1 binary tree); R32 has
  // too many ties to fit, so it stays in the paged view.
  const treeRounds = rounds.filter((r) => r.stage !== "round_of_32");

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
    return rounds[rounds.length - 1]?.matches.at(-1)?.winner ?? null;
  })();

  // Does a round contain any highlighted (favorite / drafted) team? Drives the
  // gold ★ on the round chips, so the chips themselves trace the team's path.
  const roundHasHighlight = (r: BracketRound) =>
    highlight.size > 0 &&
    r.matches.some(
      (m) => (m.home != null && highlight.has(m.home)) || (m.away != null && highlight.has(m.away)),
    );

  // 3-letter code for the compact tree cells (ARG, BRA…), falling back to name.
  const codeOf = (teamId: number | null): string => {
    if (teamId == null) return "—";
    const t = teamsById[teamId];
    if (!t) return "—";
    return (t.code ?? t.name.slice(0, 3)).toUpperCase();
  };

  // One team row inside a paged match card. Highlighted teams get the gold trail
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
      "flex min-h-9 w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-sm transition";
    const tone = isWinner
      ? "net border-grass bg-grass text-night font-semibold"
      : isGold
        ? "border-gold bg-gold/15 text-gold font-medium"
        : "border-night/10 text-chalk";
    const hover = canPick && !isWinner ? "hover:bg-night/5" : "";

    const inner = (
      <>
        <Flag teamId={teamId} logoUrl={t?.logo_url ?? null} code={t?.code ?? null} name={name} size={18} />
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
    const onTrail =
      (m.home != null && highlight.has(m.home)) || (m.away != null && highlight.has(m.away));
    const isFinal = championNo != null && m.no === championNo;
    return (
      <div
        key={m.no}
        className={`glass relative overflow-hidden rounded-xl p-2 ${onTrail ? "ring-1 ring-gold/70" : ""} ${
          isFinal ? "ring-1 ring-gold" : ""
        }`}
      >
        {onTrail && <span aria-hidden className="absolute inset-y-1 left-0 w-1 rounded-full bg-gold" />}
        <div className="space-y-1">
          {teamRow(m.no, m.home, m.winner != null && m.winner === m.home)}
          {teamRow(m.no, m.away, m.winner != null && m.winner === m.away)}
        </div>
      </div>
    );
  };

  // --- Compact tree cells --------------------------------------------------
  const treeTeam = (teamId: number | null, isWinner: boolean) => {
    const t = teamId != null ? teamsById[teamId] : null;
    const isGold = teamId != null && highlight.has(teamId);
    const tone = isWinner ? "font-bold text-grass" : isGold ? "font-semibold text-gold" : "text-chalk";
    return (
      <div className={`flex items-center gap-1 ${tone}`}>
        {t ? (
          <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={14} />
        ) : (
          <span className="inline-block h-3.5 w-3.5 rounded-full bg-night/10" />
        )}
        <span className="w-8 truncate">{codeOf(teamId)}</span>
        {isWinner && <span className="text-[8px] leading-none">✓</span>}
      </div>
    );
  };

  const treeCard = (m: BracketMatch) => {
    const onTrail =
      (m.home != null && highlight.has(m.home)) || (m.away != null && highlight.has(m.away));
    return (
      <div
        key={m.no}
        className={`rounded-md border bg-white/85 px-1.5 py-0.5 shadow-sm ${onTrail ? "border-gold ring-1 ring-gold/40" : "border-night/10"}`}
      >
        {treeTeam(m.home, m.winner != null && m.winner === m.home)}
        <div className="my-0.5 h-px bg-night/10" />
        {treeTeam(m.away, m.winner != null && m.winner === m.away)}
      </div>
    );
  };

  const champTeam = championTeamId != null ? teamsById[championTeamId] : null;
  const pickedInRound = round?.matches.filter((m) => m.winner != null).length ?? 0;
  const prevRound = rounds[safeActive - 1];
  const nextRound = rounds[safeActive + 1];

  if (!round) return <div className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">No bracket yet.</div>;

  return (
    <div className="space-y-3">
      {/* View toggle: paged picker ⟷ full connected bracket. */}
      {treeRounds.length >= 2 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-xl bg-night/5 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setView("rounds")}
              className={`rounded-lg px-3 py-1 transition ${view === "rounds" ? "bg-gold text-night glow-gold" : "text-chalk-dim hover:text-chalk"}`}
            >
              Step through
            </button>
            <button
              type="button"
              onClick={() => setView("tree")}
              className={`rounded-lg px-3 py-1 transition ${view === "tree" ? "bg-gold text-night glow-gold" : "text-chalk-dim hover:text-chalk"}`}
            >
              Full bracket
            </button>
          </div>
        </div>
      )}

      {view === "tree" ? (
        /* ----------------------- FULL BRACKET (R16 → Final) ----------------------- */
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] text-chalk-dim">
            <span className="font-semibold text-chalk">Round of 16 → Final</span>
            {highlight.size > 0 && <span className="text-gold">★ = your path</span>}
          </div>
          <div className="overflow-x-auto pb-1">
            {/* mx-auto centres the tree when the screen is wide (landscape); it
                scrolls when narrow. Fixed height keeps justify-around spacing
                uniform so the connector elbows land dead-on the feeder cards. */}
            <div className="mx-auto flex h-[348px] w-max items-stretch text-[10px] leading-none">
              {treeRounds.map((r, ri) => (
                <Fragment key={r.stage}>
                  {/* round column */}
                  <div className="flex w-[62px] flex-col px-0.5">
                    <div className="mb-1 text-center font-display text-[9px] uppercase tracking-wide text-chalk-dim">
                      {SHORT_LABEL[r.stage] ?? r.label}
                    </div>
                    <div className="flex flex-1 flex-col justify-around">
                      {r.matches.map((m) => treeCard(m))}
                    </div>
                  </div>
                  {/* connector: one ⊐ elbow per next-round tie, middle 50% of its slot */}
                  {ri < treeRounds.length - 1 && (
                    <div className="flex w-3 flex-col">
                      <div className="mb-1 text-[9px]" aria-hidden>
                        &nbsp;
                      </div>
                      <div className="flex flex-1 flex-col">
                        {treeRounds[ri + 1].matches.map((_, k) => (
                          <div key={k} className="flex flex-1 flex-col">
                            <div className="flex-1" />
                            <div className="flex-[2] rounded-r-sm border-y border-r border-night/30" />
                            <div className="flex-1" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}

              {/* Final → champion connector (straight line) */}
              <div className="flex w-3 flex-col">
                <div className="mb-1 text-[9px]" aria-hidden>
                  &nbsp;
                </div>
                <div className="flex flex-1 items-center">
                  <div className="h-px w-full bg-night/30" />
                </div>
              </div>

              {/* champion */}
              <div className="flex w-[64px] flex-col px-0.5">
                <div className="mb-1 text-center font-display text-[9px] uppercase tracking-wide text-gold">
                  Champ
                </div>
                <div className="flex flex-1 flex-col justify-center">
                  {champTeam ? (
                    <div className="flex flex-col items-center gap-0.5 rounded-md border border-gold bg-gold/15 px-1 py-2 text-center text-gold glow-gold">
                      <span className="text-sm leading-none">👑</span>
                      <Flag teamId={champTeam.id} logoUrl={champTeam.logo_url} code={champTeam.code} name={champTeam.name} size={20} />
                      <span className="font-display text-[10px] leading-none">{codeOf(championTeamId)}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-gold/40 px-1 py-3 text-center text-chalk-dim">
                      <span className="text-base leading-none opacity-60">🏆</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* --------------------------- PAGED, ROUND BY ROUND --------------------------- */
        <>
          {/* Round phase nav — gold ★ marks where a highlighted team is in play. */}
          <div className="flex flex-wrap gap-1.5">
            {rounds.map((r, i) => {
              const isActive = i === safeActive;
              const fav = roundHasHighlight(r);
              const allPicked = r.matches.length > 0 && r.matches.every((m) => m.winner != null);
              return (
                <button
                  key={r.stage}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={r.label}
                  aria-current={isActive}
                  className={`relative flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-display text-xs transition ${
                    isActive
                      ? "bg-gold text-night glow-gold"
                      : allPicked
                        ? "bg-grass/15 text-grass hover:bg-grass/25"
                        : "bg-night/5 text-chalk-dim hover:bg-night/10"
                  }`}
                >
                  {SHORT_LABEL[r.stage] ?? r.label}
                  {fav && (
                    <span className={`text-[9px] leading-none ${isActive ? "text-night" : "text-gold"}`}>★</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active round header */}
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-base text-gold">{round.label}</h3>
            <span className="text-xs tabular-nums text-chalk-dim">
              {pickedInRound}/{round.matches.length}
            </span>
          </div>

          {/* Matches — vertical, no horizontal scroll. */}
          <div
            className={`mx-auto grid gap-2 ${
              round.matches.length === 1 ? "max-w-sm" : "max-w-2xl sm:grid-cols-2"
            }`}
          >
            {round.matches.map((m) => matchCard(m))}
          </div>

          {/* Champion reveal on the final phase. */}
          {isFinalRound && (
            <div className="pt-1">
              {champTeam ? (
                <div className="glass-strong mx-auto flex max-w-sm flex-col items-center gap-1.5 rounded-2xl border border-gold bg-gold/15 p-4 text-center text-gold glow-gold">
                  <span className="text-xl leading-none">👑</span>
                  <Flag teamId={champTeam.id} logoUrl={champTeam.logo_url} code={champTeam.code} name={champTeam.name} size={32} />
                  <span className="font-display text-lg leading-tight">{champTeam.name}</span>
                  <span className="text-[11px] uppercase tracking-wide text-gold/80">Champion</span>
                </div>
              ) : (
                <div className="glass mx-auto flex max-w-sm flex-col items-center gap-1 rounded-2xl border border-dashed border-gold/40 p-4 text-center">
                  <span className="text-xl leading-none opacity-60">🏆</span>
                  <span className="font-display text-xs uppercase tracking-wide text-chalk-dim">
                    Win the Final to crown a champion
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Phase nav */}
          <div className="flex items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => setActive(safeActive - 1)}
              disabled={!prevRound}
              className="rounded-lg px-3 py-1.5 text-chalk-dim transition hover:bg-night/5 disabled:opacity-30"
            >
              ← {prevRound ? prevRound.label : ""}
            </button>
            <button
              type="button"
              onClick={() => setActive(safeActive + 1)}
              disabled={!nextRound}
              className="rounded-lg px-3 py-1.5 font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-30"
            >
              {nextRound ? `${nextRound.label} →` : ""}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
