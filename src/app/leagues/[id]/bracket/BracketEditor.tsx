"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { MatchStage } from "@/lib/types";
import { KNOCKOUT_TEMPLATE, stageOf, resolvePredictedBracket } from "@/lib/bracket-core";
import { saveBracket } from "./actions";
import { celebrate } from "@/lib/confetti";
import { goalCelebration } from "@/lib/goal";
import Flag from "@/components/Flag";
import { TeamCardButton } from "@/components/TeamCard";
import Ball from "@/components/art/Ball";
import Trophy from "@/components/art/Trophy";
import KnockoutBracket, { type BracketRound, type BracketTeam } from "@/components/KnockoutBracket";

export type EditorTeam = {
  id: number;
  name: string;
  code: string | null;
  logo_url: string | null;
  fifa_rank: number | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

// The editor is a guided three-stage flow, each its own "page".
type Step = "groups" | "thirds" | "bracket";
const STEPS: Step[] = ["groups", "thirds", "bracket"];

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
  favoriteTeamId,
  locked,
}: {
  leagueId: string;
  groups: Record<string, EditorTeam[]>; // group label → its 4 teams (any order)
  fifaRank: Record<number, number>;
  initialOrder: Record<string, number[]>;
  initialThirds: string[];
  initialKnockout: Record<string, number>;
  initialChampion: number | null;
  favoriteTeamId: number | null;
  locked: boolean;
}) {
  // --- Static lookups ------------------------------------------------------
  const groupsOrder = useMemo(() => Object.keys(groups).sort(), [groups]);

  const teamsById = useMemo(() => {
    const m = new Map<number, EditorTeam>();
    for (const list of Object.values(groups)) for (const t of list) m.set(t.id, t);
    return m;
  }, [groups]);

  // The visual bracket wants a plain id→team record (id/name/code/logo only).
  const teamsRecord = useMemo(() => {
    const o: Record<number, BracketTeam> = {};
    for (const [id, t] of teamsById)
      o[id] = { id: t.id, name: t.name, code: t.code, logo_url: t.logo_url };
    return o;
  }, [teamsById]);

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
  const [step, setStep] = useState<Step>("groups");

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
  // Resolve every knockout tie's two participants + validated winner picks from
  // the predicted order, chosen thirds, and picks. Shared with the read-only
  // recap (resolvePredictedBracket) so both render identically; a stored pick is
  // dropped automatically once an upstream edit voids it.
  const { koParticipants, eff } = useMemo(() => {
    const { participants, winners } = resolvePredictedBracket(order, thirds, knockout);
    return { koParticipants: participants, eff: winners };
  }, [order, thirds, knockout]);

  const champion = eff[104] ?? null;
  const thirdsResolved = thirds.length === MAX_THIRDS;
  const bracketReady = thirdsResolved;

  // Rounds fed to the visual bracket: resolved participants + validated picks.
  const bracketRounds = useMemo<BracketRound[]>(
    () =>
      koRounds.map((r) => ({
        stage: r.stage,
        label: r.label,
        matches: r.matches.map((no) => ({
          no,
          home: koParticipants[no]?.home ?? null,
          away: koParticipants[no]?.away ?? null,
          winner: eff[no] ?? null,
        })),
      })),
    [koRounds, koParticipants, eff],
  );

  const highlightIds = useMemo(
    () => (favoriteTeamId != null ? [favoriteTeamId] : []),
    [favoriteTeamId],
  );
  const favInBracket =
    favoriteTeamId != null &&
    Object.values(koParticipants).some((m) => m.home === favoriteTeamId || m.away === favoriteTeamId);

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

  // Stage tabs — each is its own "page", clickable to jump anywhere.
  const stepMeta: Record<Step, { n: number; label: string; sub: string; done: boolean }> = {
    groups: { n: 1, label: "Groups", sub: `${groupsOrdered}/${groupsOrder.length}`, done: groupsOrdered === groupsOrder.length },
    thirds: { n: 2, label: "3rd place", sub: `${thirds.length}/${MAX_THIRDS}`, done: thirdsResolved },
    bracket: { n: 3, label: "Bracket", sub: champion != null ? "champion ✓" : `${koPicked}/${koTotal}`, done: champion != null },
  };
  const goStep = (s: Step) => {
    setStep(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Stage stepper */}
      <div className="glass rounded-2xl p-2">
        <div className="flex items-stretch gap-1.5">
          {STEPS.map((s) => {
            const m = stepMeta[s];
            const active = s === step;
            return (
              <button
                key={s}
                type="button"
                onClick={() => goStep(s)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-center transition ${
                  active ? "bg-gold/15 glow-gold" : "hover:bg-night/5"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full font-display text-sm ${
                    active ? "bg-gold text-night" : m.done ? "bg-grass text-night" : "bg-night/10 text-chalk-dim"
                  }`}
                >
                  {m.done && !active ? "✓" : m.n}
                </span>
                <span className={`text-xs font-semibold leading-tight ${active ? "text-gold" : "text-chalk"}`}>{m.label}</span>
                <span className="text-[10px] tabular-nums text-chalk-dim">{m.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================ STEP 1: GROUPS ============================ */}
      {step === "groups" && (
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-xl text-chalk">
              <Ball size={18} />Predict each group&apos;s table
            </h2>
            <p className="text-sm text-chalk-dim">
              Order the four teams 1 → 4. The top two advance; the third may sneak through as one of
              the eight best third-placed teams.
            </p>
          </div>

          {/* Group nav — jump anywhere; gold = current, ★ = your favorite's group. */}
          <div className="flex flex-wrap gap-1.5">
            {groupsOrder.map((g) => {
              const active = g === activeGroup;
              const hasFav = favoriteTeamId != null && (order[g] ?? []).includes(favoriteTeamId);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setActiveGroup(g)}
                  aria-label={`Group ${g}`}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-lg font-display text-sm transition ${
                    active ? "bg-gold text-night glow-gold" : "bg-night/5 text-chalk-dim hover:bg-night/10"
                  }`}
                >
                  {g}
                  {hasFav && !active && (
                    <span className="absolute -right-0.5 -top-0.5 text-[9px] leading-none text-gold">★</span>
                  )}
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
            const isLastGroup = !nextG;
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
                    const isFav = teamId === favoriteTeamId;
                    return (
                      <motion.li
                        key={teamId}
                        layout
                        className={`flex items-center gap-2 rounded-xl px-2 py-2 ${isFav ? "ring-1 ring-gold/70 " : ""}${
                          i < 2 ? "bg-grass/15" : i === 2 ? "bg-gold/10" : "bg-night/5"
                        }`}
                      >
                        <span className="w-4 shrink-0 text-center font-display text-sm text-chalk-dim">{i + 1}</span>
                        <TeamCardButton
                          teamId={t.id}
                          name={t.name}
                          className="flex min-w-0 flex-1 items-center gap-1 truncate text-left text-sm text-chalk transition hover:opacity-80"
                        >
                          <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={18} />
                          <span className="truncate">{t.name}</span>
                          {fifaRank[t.id] != null && (
                            <span className="shrink-0 text-[10px] tabular-nums text-chalk-dim">#{fifaRank[t.id]}</span>
                          )}
                          {isFav && <span className="shrink-0 text-[11px] text-gold" title="Your favorite">★</span>}
                        </TeamCardButton>
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
                  {isLastGroup ? (
                    <button
                      type="button"
                      onClick={() => goStep("thirds")}
                      className="rounded-lg bg-grass px-3 py-1.5 font-semibold text-night transition hover:brightness-105"
                    >
                      Pick 3rd-place teams →
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => nextG && setActiveGroup(nextG)}
                      className="rounded-lg bg-grass px-3 py-1.5 font-semibold text-night transition hover:brightness-105"
                    >
                      Group {nextG} →
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </section>
      )}

      {/* ========================== STEP 2: THIRD PLACE ========================== */}
      {step === "thirds" && (
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-xl text-chalk">
              <Ball size={18} />Best third-placed teams
            </h2>
            <p className="text-sm text-chalk-dim">
              Eight of the twelve third-placed teams advance. Tap to send a group&apos;s 3rd through —{" "}
              <span className={thirdsResolved ? "text-grass" : "text-gold"}>
                {thirds.length}/{MAX_THIRDS} chosen
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
              const isFav = teamId === favoriteTeamId;
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
                        : `${isFav ? "border-gold/50" : "border-night/10"} text-chalk hover:bg-night/5`
                  }`}
                >
                  <span className="shrink-0 font-display text-xs text-chalk-dim">{g}</span>
                  <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={18} />
                  <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
                    <span className="truncate">{t.name}</span>
                    {isFav && <span className="shrink-0 text-[11px] text-gold">★</span>}
                  </span>
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

          <div className="flex items-center justify-between gap-2 text-sm">
            <button
              type="button"
              onClick={() => goStep("groups")}
              className="rounded-lg px-3 py-1.5 text-chalk-dim transition hover:bg-night/5"
            >
              ← Groups
            </button>
            <button
              type="button"
              onClick={() => goStep("bracket")}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                thirdsResolved ? "bg-grass text-night hover:brightness-105" : "bg-night/10 text-chalk-dim"
              }`}
            >
              {thirdsResolved ? "See my bracket →" : "See bracket (incomplete) →"}
            </button>
          </div>
        </section>
      )}

      {/* ============================ STEP 3: BRACKET ============================ */}
      {step === "bracket" && (
        <section className="space-y-4">
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-xl text-chalk">
              <Trophy size={18} />Your knockout bracket
            </h2>
            <p className="text-sm text-chalk-dim">
              {bracketReady
                ? "Tap the team you think wins each tie — winners flow into the next round. Step through the phases, or hit Full bracket to see the whole tree from the R16."
                : "Choose your eight best third-placed teams first to reveal the full bracket."}
            </p>
          </div>

          {favoriteTeamId != null && bracketReady && (
            <p className="flex items-center gap-1.5 rounded-xl bg-gold/10 px-3 py-2 text-xs text-gold">
              <span>★</span>
              {favInBracket
                ? "Gold traces your favorite's path to the final."
                : "Your favorite isn't advancing in your current picks — reorder their group to send them through."}
            </p>
          )}

          {!bracketReady ? (
            <button
              type="button"
              onClick={() => goStep("thirds")}
              className="glass block w-full rounded-2xl p-6 text-center transition hover:bg-night/5"
            >
              <p className="text-sm text-chalk-dim">
                {thirds.length}/{MAX_THIRDS} third-place teams chosen — tap to finish picking
              </p>
              <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-night/10">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: `${(thirds.length / MAX_THIRDS) * 100}%` }}
                />
              </div>
            </button>
          ) : (
            <>
              <KnockoutBracket
                rounds={bracketRounds}
                teamsById={teamsRecord}
                highlightIds={highlightIds}
                onPick={pickWinner}
                locked={locked}
                championNo={104}
              />

              <div className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => goStep("thirds")}
                  className="rounded-lg px-3 py-1.5 text-chalk-dim transition hover:bg-night/5"
                >
                  ← 3rd-place teams
                </button>
                <span className="text-xs text-chalk-dim">
                  {koPicked}/{koTotal} ties picked
                </span>
              </div>
            </>
          )}
        </section>
      )}

      {/* Sticky save bar */}
      {!locked && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.4rem)] z-20 border-t border-b border-night/10 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 pr-16 sm:px-6 sm:pr-20">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${saveBadge.cls}`}>
              {saveBadge.text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
