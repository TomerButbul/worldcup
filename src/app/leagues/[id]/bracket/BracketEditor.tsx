"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { MatchStage } from "@/lib/types";
import type { GroupStat, GroupTable } from "@/lib/scoring-core";
import { KNOCKOUT_TEMPLATE, buildBracketFromOrder, stageOf, type SlotRef } from "@/lib/bracket-core";
import { saveBracket } from "./actions";
import { celebrate } from "@/lib/confetti";
import { goalCelebration } from "@/lib/goal";
import Flag from "@/components/Flag";
import Ball from "@/components/art/Ball";
import Trophy from "@/components/art/Trophy";

export type EditorTeam = {
  id: number;
  name: string;
  code: string | null;
  logo_url: string | null;
  fifa_rank: number | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const STAGE_LABELS: Record<string, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarter-finals",
  semi: "Semi-finals",
  final: "Final",
};
const STAGE_ORDER: MatchStage[] = ["round_of_32", "round_of_16", "quarter", "semi", "final"];

const MAX_THIRDS = 8;

export default function BracketEditor({
  leagueId,
  groups,
  fifaRank,
  initialOrder,
  initialThirds,
  initialKnockout,
  locked,
}: {
  leagueId: string;
  groups: Record<string, EditorTeam[]>; // group label → its 4 teams (any order)
  fifaRank: Record<number, number>;
  initialOrder: Record<string, number[]>;
  initialThirds: string[];
  initialKnockout: Record<string, number>;
  initialChampion: number | null;
  locked: boolean;
}) {
  // --- Static lookups ------------------------------------------------------
  const groupsOrder = useMemo(() => Object.keys(groups).sort(), [groups]);

  const teamsById = useMemo(() => {
    const m = new Map<number, EditorTeam>();
    for (const list of Object.values(groups)) for (const t of list) m.set(t.id, t);
    return m;
  }, [groups]);

  // Better FIFA rank (lower number) sorts first; nulls last. Falls back to name.
  const rankOf = useCallback(
    (id: number) => fifaRank[id] ?? Number.MAX_SAFE_INTEGER,
    [fifaRank],
  );

  // --- State ---------------------------------------------------------------
  // Seed each group's order from a saved 4-team order; otherwise default by FIFA
  // rank (best team 1st). Drop any saved ids no longer in the group, then append
  // any missing teams so every seeded order is a complete, valid permutation.
  const [order, setOrder] = useState<Record<string, number[]>>(() => {
    const out: Record<string, number[]> = {};
    for (const g of Object.keys(groups)) {
      const teamIds = groups[g].map((t) => t.id);
      const idSet = new Set(teamIds);
      const saved = initialOrder[g]?.filter((id) => idSet.has(id)) ?? [];
      const seen = new Set(saved);
      const rest = teamIds
        .filter((id) => !seen.has(id))
        .sort((a, b) => rankOf(a) - rankOf(b) || (teamsById.get(a)?.name ?? "").localeCompare(teamsById.get(b)?.name ?? ""));
      out[g] = saved.length === 4 ? saved : [...saved, ...rest];
    }
    return out;
  });

  const [thirds, setThirds] = useState<string[]>(() =>
    initialThirds.filter((g) => groups[g] != null).slice(0, MAX_THIRDS),
  );

  const [knockout, setKnockout] = useState<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    for (const [no, w] of Object.entries(initialKnockout)) out[Number(no)] = w;
    return out;
  });

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>(() => groupsOrder[0] ?? "A");

  const KO_ORDER = useMemo(
    () => Object.keys(KNOCKOUT_TEMPLATE).map(Number).sort((a, b) => a - b),
    [],
  );

  const koRounds = useMemo(() => {
    const byStage = new Map<MatchStage, number[]>();
    for (const no of KO_ORDER) {
      const st = stageOf(no);
      if (!byStage.has(st)) byStage.set(st, []);
      byStage.get(st)!.push(no);
    }
    return STAGE_ORDER.filter((s) => byStage.has(s)).map((s) => ({
      stage: s,
      label: STAGE_LABELS[s],
      matches: byStage.get(s)!,
    }));
  }, [KO_ORDER]);

  // --- Derived bracket -----------------------------------------------------
  // Predicted tables straight from the manager's order (no scorelines → empty
  // stats). Annex C only resolves the thirds when exactly 8 groups are chosen.
  const tables = useMemo(() => {
    const out: Record<string, GroupTable> = {};
    for (const g of Object.keys(order)) {
      out[g] = { order: order[g], stats: new Map<number, GroupStat>() };
    }
    return out;
  }, [order]);

  const annex = useMemo(() => buildBracketFromOrder(order, thirds).annex, [order, thirds]);

  // Resolve each knockout match's two participants in tournament order, plus the
  // validated winner picks (`eff`) — a stored pick is dropped automatically once
  // an upstream edit makes it no longer one of the match's two teams.
  const { koParticipants, eff } = useMemo(() => {
    const eff: Record<number, number> = {};
    const koParticipants: Record<number, { home: number | null; away: number | null }> = {};
    const resolve = (s: SlotRef): number | null => {
      switch (s.kind) {
        case "winner":
          return tables[s.group]?.order[0] ?? null;
        case "runner":
          return tables[s.group]?.order[1] ?? null;
        case "third": {
          const g = annex[s.match];
          return g ? tables[g]?.order[2] ?? null : null;
        }
        case "matchWinner":
          return eff[s.match] ?? null;
        default:
          return null;
      }
    };
    for (const no of KO_ORDER) {
      const tpl = KNOCKOUT_TEMPLATE[no];
      const home = resolve(tpl.home);
      const away = resolve(tpl.away);
      koParticipants[no] = { home, away };
      const pick = knockout[no];
      if (pick != null && (pick === home || pick === away)) eff[no] = pick;
    }
    return { koParticipants, eff };
  }, [tables, annex, knockout, KO_ORDER]);

  const champion = eff[104] ?? null;
  const thirdsResolved = thirds.length === MAX_THIRDS;
  const bracketReady = thirdsResolved;

  // --- Progress ------------------------------------------------------------
  // Every group is ordered the moment it's seeded, so this is always all 12.
  const groupsOrdered = groupsOrder.filter((g) => order[g]?.length === 4).length;
  const koPicked = KO_ORDER.filter((no) => eff[no] != null).length;
  const koTotal = KO_ORDER.length;
  const fullyComplete =
    groupsOrdered === groupsOrder.length && thirdsResolved && koPicked === koTotal && champion != null;

  // --- Save (debounced autosave) -------------------------------------------
  const buildPayload = useCallback(() => {
    const ko: Record<string, number> = {};
    for (const no of KO_ORDER) if (eff[no] != null) ko[String(no)] = eff[no];
    return {
      group_order: order,
      third_qualifiers: thirds,
      knockout: ko,
      champion_team_id: champion,
    };
  }, [order, thirds, eff, champion, KO_ORDER]);

  const payloadRef = useRef(buildPayload);
  useEffect(() => {
    payloadRef.current = buildPayload;
  }, [buildPayload]);

  const saveNow = useCallback(
    async (payload: ReturnType<typeof buildPayload>) => {
      setSaveState("saving");
      setErrMsg(null);
      const res = await saveBracket(leagueId, payload);
      if (res.ok) setSaveState("saved");
      else {
        setSaveState("error");
        setErrMsg(res.error ?? "Save failed");
      }
    },
    [leagueId],
  );

  // Debounce: save 1s after the user stops reordering / toggling / picking.
  const firstRun = useRef(true);
  useEffect(() => {
    if (locked) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(() => void saveNow(payloadRef.current()), 1000);
    return () => clearTimeout(t);
  }, [order, thirds, knockout, locked, saveNow]);

  // Champion celebration on first pick of the final winner.
  const prevChampion = useRef<number | null>(champion);
  useEffect(() => {
    if (champion != null && champion !== prevChampion.current) {
      celebrate();
      goalCelebration("CHAMPION!");
    }
    prevChampion.current = champion;
  }, [champion]);

  // --- Handlers ------------------------------------------------------------
  const move = useCallback(
    (g: string, from: number, to: number) => {
      if (locked) return;
      setOrder((prev) => {
        const list = prev[g];
        if (!list || to < 0 || to >= list.length) return prev;
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...prev, [g]: next };
      });
    },
    [locked],
  );

  const toggleThird = useCallback(
    (g: string) => {
      if (locked) return;
      setThirds((prev) => {
        if (prev.includes(g)) return prev.filter((x) => x !== g);
        if (prev.length >= MAX_THIRDS) return prev; // enforce max 8
        return [...prev, g];
      });
    },
    [locked],
  );

  const pickWinner = useCallback(
    (matchNo: number, teamId: number | null) => {
      if (locked || teamId == null) return;
      setKnockout((prev) => {
        if (prev[matchNo] === teamId) {
          const next = { ...prev };
          delete next[matchNo];
          return next;
        }
        return { ...prev, [matchNo]: teamId };
      });
    },
    [locked],
  );

  // --- Render helpers ------------------------------------------------------
  const teamChip = (teamId: number | null, selected: boolean, onClick: () => void) => {
    const t = teamId != null ? teamsById.get(teamId) : null;
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={locked || teamId == null}
        className={`flex min-h-10 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition disabled:cursor-not-allowed ${
          selected
            ? "border-grass bg-grass text-night glow-grass"
            : teamId == null
              ? "border-dashed border-night/15 text-chalk-dim"
              : "border-night/10 text-chalk hover:bg-night/5"
        }`}
      >
        {t ? (
          <>
            <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={18} />
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            {selected && <span className="shrink-0 text-xs">✓</span>}
          </>
        ) : (
          <span className="text-xs italic">TBD</span>
        )}
      </button>
    );
  };

  const saveBadge =
    saveState === "saving"
      ? { text: "Saving…", cls: "glass text-chalk-dim" }
      : saveState === "saved"
        ? { text: "✓ Saved", cls: "bg-grass/20 text-grass" }
        : saveState === "error"
          ? { text: `⚠ ${errMsg ?? "Save failed"}`, cls: "bg-red-500/15 text-red-600" }
          : { text: fullyComplete ? "✓ Bracket complete" : "Autosaves as you go", cls: "glass text-chalk-dim" };

  // The twelve predicted third-placed teams (each group's order[2]).
  const thirdTeams = useMemo(
    () =>
      groupsOrder
        .map((g) => ({ group: g, teamId: order[g]?.[2] ?? null }))
        .filter((x): x is { group: string; teamId: number } => x.teamId != null),
    [groupsOrder, order],
  );

  return (
    <div className="space-y-8 pb-28">
      {/* Intro / progress */}
      <div className="glass rounded-2xl p-4">
        <p className="mb-3 text-sm text-chalk-dim">
          Order each group, pick the 8 best third-place teams, then your knockout bracket builds
          itself. Match scores are predicted live during the tournament.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-chalk">
            <span className="font-display text-gold">{groupsOrdered}</span>
            <span className="text-chalk-dim">/{groupsOrder.length} groups ordered</span>
          </span>
          <span className="text-chalk">
            <span className="font-display text-gold">{thirds.length}</span>
            <span className="text-chalk-dim">/{MAX_THIRDS} third-place teams</span>
          </span>
          <span className="text-chalk">
            <span className="font-display text-gold">{koPicked}</span>
            <span className="text-chalk-dim">/{koTotal} knockout picks</span>
          </span>
          <span className="text-chalk">
            <Trophy size={18} className="mr-1 inline-block align-[-3px]" />
            {champion ? (teamsById.get(champion)?.name ?? "") : "—"}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-night/10">
          <motion.div
            className="h-full rounded-full bg-grass"
            initial={false}
            animate={{ width: `${(koPicked / Math.max(1, koTotal)) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
      </div>

      {/* Group stage — predict the table */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-xl text-chalk">
            <Ball size={18} />Group stage — predict the table
          </h2>
          <p className="text-sm text-chalk-dim">
            Order each group&apos;s four teams 1 → 4. The top two advance; the third may sneak
            through as one of the eight best third-placed teams.
          </p>
        </div>

        {/* Group nav — jump anywhere; gold = current. */}
        <div className="flex flex-wrap gap-1.5">
          {groupsOrder.map((g) => {
            const active = g === activeGroup;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setActiveGroup(g)}
                aria-label={`Group ${g}`}
                className={`flex h-9 w-9 items-center justify-center rounded-lg font-display text-sm transition ${
                  active ? "bg-gold text-night glow-gold" : "bg-night/5 text-chalk-dim hover:bg-night/10"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>

        {/* One group at a time — ordered list with up/down reorder. */}
        {(() => {
          const g = activeGroup;
          const list = order[g] ?? [];
          const idx = groupsOrder.indexOf(g);
          const prevG = groupsOrder[idx - 1];
          const nextG = groupsOrder[idx + 1];
          return (
            <motion.div key={g} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-base text-gold">Group {g}</h3>
                <span className="text-xs text-chalk-dim">Top 2 advance · 3rd may qualify</span>
              </div>

              <ol className="space-y-1.5">
                {list.map((teamId, i) => {
                  const t = teamsById.get(teamId);
                  if (!t) return null;
                  return (
                    <motion.li
                      key={teamId}
                      layout
                      className={`flex items-center gap-2 rounded-xl px-2 py-2 ${
                        i < 2 ? "bg-grass/15" : i === 2 ? "bg-gold/10" : "bg-night/5"
                      }`}
                    >
                      <span className="w-4 shrink-0 text-center font-display text-sm text-chalk-dim">{i + 1}</span>
                      <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={18} />
                      <span className="min-w-0 flex-1 truncate text-sm text-chalk">{t.name}</span>
                      {i < 2 && (
                        <span className="shrink-0 rounded-full bg-grass/20 px-2 py-0.5 text-[10px] font-semibold text-grass">
                          advances
                        </span>
                      )}
                      {i === 2 && (
                        <span className="shrink-0 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold">
                          3rd — playoff?
                        </span>
                      )}
                      <span className="flex shrink-0 flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={locked || i === 0}
                          onClick={() => move(g, i, i - 1)}
                          aria-label={`Move ${t.name} up`}
                          className="flex h-5 w-7 items-center justify-center rounded bg-night/10 text-xs leading-none text-chalk transition hover:bg-night/20 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={locked || i === list.length - 1}
                          onClick={() => move(g, i, i + 1)}
                          aria-label={`Move ${t.name} down`}
                          className="flex h-5 w-7 items-center justify-center rounded bg-night/10 text-xs leading-none text-chalk transition hover:bg-night/20 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </span>
                    </motion.li>
                  );
                })}
              </ol>

              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => prevG && setActiveGroup(prevG)}
                  disabled={!prevG}
                  className="rounded-lg px-3 py-1.5 text-chalk-dim transition hover:bg-night/5 disabled:opacity-30"
                >
                  ← {prevG ? `Group ${prevG}` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => nextG && setActiveGroup(nextG)}
                  disabled={!nextG}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition disabled:opacity-30 ${nextG ? "bg-grass text-night" : "text-gold hover:bg-gold/10"}`}
                >
                  {nextG ? `Group ${nextG}` : "All groups ✓"} →
                </button>
              </div>
            </motion.div>
          );
        })()}
      </section>

      {/* Best third-placed teams */}
      <section className="space-y-3 border-t border-night/10 pt-6">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-xl text-chalk">
            <Ball size={18} />Best third-placed teams
          </h2>
          <p className="text-sm text-chalk-dim">
            Eight of the twelve third-placed teams advance. Tap to send a group&apos;s 3rd through —{" "}
            <span className={thirdsResolved ? "text-grass" : "text-gold"}>
              {thirds.length}/{MAX_THIRDS} third-place teams
            </span>
            .
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {thirdTeams.map(({ group: g, teamId }) => {
            const t = teamsById.get(teamId);
            if (!t) return null;
            const selected = thirds.includes(g);
            const atMax = !selected && thirds.length >= MAX_THIRDS;
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleThird(g)}
                disabled={locked || atMax}
                aria-pressed={selected}
                className={`flex min-h-10 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition disabled:cursor-not-allowed ${
                  selected
                    ? "border-gold bg-gold/15 text-gold glow-gold"
                    : atMax
                      ? "border-dashed border-night/15 text-chalk-dim opacity-50"
                      : "border-night/10 text-chalk hover:bg-night/5"
                }`}
              >
                <span className="shrink-0 font-display text-xs text-chalk-dim">{g}</span>
                <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={18} />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {selected && <span className="shrink-0 text-xs">✓</span>}
              </button>
            );
          })}
        </div>

        {!thirdsResolved && (
          <p className="rounded-xl bg-gold/10 px-3 py-2 text-xs text-gold">
            Pick exactly {MAX_THIRDS} third-place teams to lock in the eight third-place slots and
            reveal the full Round of 32.
          </p>
        )}
      </section>

      {/* Knockout */}
      <section className="space-y-4 border-t border-night/10 pt-6">
        <div>
          <h2 className="font-display text-xl text-chalk">🔥 Knockout bracket</h2>
          <p className="text-sm text-chalk-dim">
            {bracketReady
              ? "Tap the team you think wins each tie. Winners advance automatically."
              : "Choose your eight best third-placed teams to reveal the full bracket."}
          </p>
        </div>

        {!bracketReady ? (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-sm text-chalk-dim">
              {thirds.length}/{MAX_THIRDS} third-place teams chosen
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-night/10">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{ width: `${(thirds.length / MAX_THIRDS) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {koRounds.map((round) => (
              <div key={round.stage}>
                <h3 className="mb-2 font-display text-sm text-chalk">{round.label}</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {round.matches.map((no) => {
                    const { home, away } = koParticipants[no];
                    const pick = eff[no] ?? null;
                    const isFinal = no === 104;
                    return (
                      <div
                        key={no}
                        className={`glass space-y-1 rounded-xl p-2 ${isFinal ? "ring-1 ring-gold" : ""}`}
                      >
                        {teamChip(home, pick != null && pick === home, () => pickWinner(no, home))}
                        {teamChip(away, pick != null && pick === away, () => pickWinner(no, away))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Champion */}
            <div className="glass-strong rounded-2xl p-5 text-center">
              <p className="mb-2 flex items-center justify-center gap-1.5 font-display text-lg text-gradient-gold">
                Your champion <Trophy size={18} />
              </p>
              {champion != null ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-3 rounded-xl border border-gold bg-gold/15 px-5 py-3 font-display text-xl text-gold glow-gold"
                >
                  <span>👑</span>
                  <Flag
                    teamId={champion}
                    logoUrl={teamsById.get(champion)?.logo_url ?? null}
                    code={teamsById.get(champion)?.code ?? null}
                    name={teamsById.get(champion)?.name ?? "?"}
                    size={28}
                  />
                  {teamsById.get(champion)?.name}
                </motion.div>
              ) : (
                <p className="text-sm text-chalk-dim">Pick the winner of the final to crown your champion.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Sticky save bar */}
      {!locked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-night/10 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-16 sm:px-6 sm:pr-20">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${saveBadge.cls}`}>
              {saveBadge.text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
