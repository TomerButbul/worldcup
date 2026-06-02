"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { MatchScore, MatchStage } from "@/lib/types";
import { computeGroupTables, type MatchRow } from "@/lib/scoring-core";
import { KNOCKOUT_TEMPLATE, buildBracket, stageOf, type SlotRef } from "@/lib/bracket-core";
import { saveBracket } from "./actions";
import { celebrate } from "@/lib/confetti";
import { goalCelebration } from "@/lib/goal";
import GameButton from "@/components/GameButton";
import Flag from "@/components/Flag";

export type EditorTeam = { id: number; name: string; code: string | null; logo_url: string | null };
export type GroupMatch = { id: number; group: string; home: EditorTeam; away: EditorTeam };

type Score = { h: number | null; a: number | null };
type SaveState = "idle" | "saving" | "saved" | "error";

const STAGE_LABELS: Record<string, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarter-finals",
  semi: "Semi-finals",
  final: "Final",
};
const STAGE_ORDER: MatchStage[] = ["round_of_32", "round_of_16", "quarter", "semi", "final"];

export default function BracketEditor({
  leagueId,
  groupMatches,
  fifaRank,
  initialScores,
  initialKnockout,
  locked,
}: {
  leagueId: string;
  groupMatches: GroupMatch[];
  fifaRank: Record<number, number>;
  initialScores: Record<string, MatchScore>;
  initialKnockout: Record<string, number>;
  initialChampion: number | null;
  locked: boolean;
}) {
  const [scores, setScores] = useState<Record<number, Score>>(() => {
    const out: Record<number, Score> = {};
    for (const [id, s] of Object.entries(initialScores)) out[Number(id)] = { h: s.h, a: s.a };
    return out;
  });
  const [knockout, setKnockout] = useState<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    for (const [no, w] of Object.entries(initialKnockout)) out[Number(no)] = w;
    return out;
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // --- Static lookups ------------------------------------------------------
  const fifaRankMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const [id, r] of Object.entries(fifaRank)) m.set(Number(id), r);
    return m;
  }, [fifaRank]);

  const teamsById = useMemo(() => {
    const m = new Map<number, EditorTeam>();
    for (const gm of groupMatches) {
      m.set(gm.home.id, gm.home);
      m.set(gm.away.id, gm.away);
    }
    return m;
  }, [groupMatches]);

  const groupsOrder = useMemo(() => {
    const set = new Set<string>();
    for (const gm of groupMatches) set.add(gm.group);
    return [...set].sort();
  }, [groupMatches]);

  const matchesByGroup = useMemo(() => {
    const m = new Map<string, GroupMatch[]>();
    for (const gm of groupMatches) {
      if (!m.has(gm.group)) m.set(gm.group, []);
      m.get(gm.group)!.push(gm);
    }
    return m;
  }, [groupMatches]);

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

  // --- Derived bracket (same pure functions the scoring engine uses) -------
  const predictedRows: MatchRow[] = useMemo(
    () =>
      groupMatches.map((gm) => {
        const s = scores[gm.id];
        const filled = !!s && s.h != null && s.a != null;
        return {
          id: gm.id,
          stage: "group" as MatchStage,
          group_label: gm.group,
          status: filled ? "finished" : "scheduled",
          home_team_id: gm.home.id,
          away_team_id: gm.away.id,
          home_goals: filled ? s!.h : null,
          away_goals: filled ? s!.a : null,
        };
      }),
    [groupMatches, scores],
  );

  const tables = useMemo(
    () => computeGroupTables(predictedRows, fifaRankMap),
    [predictedRows, fifaRankMap],
  );

  const allGroupsComplete = groupsOrder.length > 0 && groupsOrder.every((g) => tables[g]);

  const built = useMemo(() => buildBracket(tables, fifaRankMap), [tables, fifaRankMap]);

  // Resolve each knockout match's two participants in tournament order, and the
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
          const g = built.annex[s.match];
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
  }, [tables, built, knockout, KO_ORDER]);

  const champion = eff[104] ?? null;

  // --- Progress ------------------------------------------------------------
  const scoredCount = useMemo(
    () => Object.values(scores).filter((s) => s.h != null && s.a != null).length,
    [scores],
  );
  const totalMatches = groupMatches.length;
  const groupsDone = groupsOrder.filter((g) => tables[g]).length;
  const koPicked = KO_ORDER.filter((no) => eff[no] != null).length;
  const koTotal = KO_ORDER.length;
  const fullyComplete = scoredCount === totalMatches && koPicked === koTotal && champion != null;

  // --- Save (debounced autosave + manual) ----------------------------------
  const buildPayload = useCallback(() => {
    const group_scores: Record<string, MatchScore> = {};
    for (const [id, s] of Object.entries(scores)) {
      if (s.h != null && s.a != null) group_scores[id] = { h: s.h, a: s.a };
    }
    const ko: Record<string, number> = {};
    for (const no of KO_ORDER) if (eff[no] != null) ko[String(no)] = eff[no];
    return { group_scores, knockout: ko, champion_team_id: champion };
  }, [scores, eff, champion, KO_ORDER]);

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

  // Debounce: save 1s after the user stops editing scores or picks.
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
  }, [scores, knockout, locked, saveNow]);

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
  const setScore = useCallback(
    (matchId: number, side: "h" | "a", raw: string) => {
      if (locked) return;
      setScores((prev) => {
        const cur = prev[matchId] ?? { h: null, a: null };
        let v: number | null = null;
        if (raw !== "") {
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n)) v = Math.max(0, Math.min(99, n));
        }
        return { ...prev, [matchId]: { ...cur, [side]: v } };
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

  // Standings for a group: accurate FIFA order once complete, else a provisional
  // points/GD/GF preview as scores come in.
  const displayStanding = useCallback(
    (g: string): { team: EditorTeam; pts: number; gd: number; gf: number; played: number }[] => {
      const t = tables[g];
      if (t) {
        return t.order.map((id) => {
          const st = t.stats.get(id)!;
          return { team: teamsById.get(id)!, pts: st.pts, gd: st.gd, gf: st.gf, played: 3 };
        });
      }
      const stat = new Map<number, { pts: number; gd: number; gf: number; played: number }>();
      const ensure = (id: number) => {
        if (!stat.has(id)) stat.set(id, { pts: 0, gd: 0, gf: 0, played: 0 });
      };
      for (const gm of matchesByGroup.get(g) ?? []) {
        ensure(gm.home.id);
        ensure(gm.away.id);
        const s = scores[gm.id];
        if (!s || s.h == null || s.a == null) continue;
        const h = stat.get(gm.home.id)!;
        const a = stat.get(gm.away.id)!;
        h.gf += s.h;
        a.gf += s.a;
        h.gd += s.h - s.a;
        a.gd += s.a - s.h;
        h.played += 1;
        a.played += 1;
        if (s.h > s.a) h.pts += 3;
        else if (s.h < s.a) a.pts += 3;
        else {
          h.pts += 1;
          a.pts += 1;
        }
      }
      return [...stat.entries()]
        .map(([id, st]) => ({ team: teamsById.get(id)!, ...st }))
        .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.name.localeCompare(y.team.name));
    },
    [tables, teamsById, matchesByGroup, scores],
  );

  const scoreBox = (matchId: number, side: "h" | "a") => {
    const v = scores[matchId]?.[side];
    return (
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        disabled={locked}
        value={v ?? ""}
        onChange={(e) => setScore(matchId, side, e.target.value)}
        aria-label={side === "h" ? "Home goals" : "Away goals"}
        className="h-9 w-9 rounded-lg border border-night/10 bg-white text-center text-sm tabular-nums text-chalk outline-none focus:border-grass focus:ring-2 focus:ring-grass/30 disabled:opacity-60"
      />
    );
  };

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

  return (
    <div className="space-y-8 pb-28">
      {/* Progress */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-chalk">
            <span className="font-display text-gold">{scoredCount}</span>
            <span className="text-chalk-dim">/{totalMatches} scorelines</span>
          </span>
          <span className="text-chalk">
            <span className="font-display text-gold">{groupsDone}</span>
            <span className="text-chalk-dim">/{groupsOrder.length} groups</span>
          </span>
          <span className="text-chalk">
            <span className="font-display text-gold">{koPicked}</span>
            <span className="text-chalk-dim">/{koTotal} knockout picks</span>
          </span>
          <span className="text-chalk">
            {champion ? `🏆 ${teamsById.get(champion)?.name ?? ""}` : "🏆 —"}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-night/10">
          <motion.div
            className="h-full rounded-full bg-grass"
            initial={false}
            animate={{ width: `${(scoredCount / Math.max(1, totalMatches)) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
      </div>

      {/* Group stage */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl text-chalk">⚽ Group stage — predict every scoreline</h2>
          <p className="text-sm text-chalk-dim">
            Top 2 of each group advance, plus the 8 best third-placed teams. Your bracket builds itself
            from these results.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groupsOrder.map((g) => {
            const gms = matchesByGroup.get(g) ?? [];
            const standing = displayStanding(g);
            const complete = !!tables[g];
            return (
              <div key={g} className="glass rounded-2xl p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-sm text-gold">Group {g}</h3>
                  {complete && <span className="text-xs text-grass">✓ complete</span>}
                </div>

                <div className="space-y-1.5">
                  {gms.map((gm) => (
                    <div key={gm.id} className="flex items-center gap-1.5">
                      <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
                        <span className="truncate text-xs text-chalk">{gm.home.name}</span>
                        <Flag teamId={gm.home.id} logoUrl={gm.home.logo_url} code={gm.home.code} name={gm.home.name} size={16} />
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {scoreBox(gm.id, "h")}
                        <span className="text-xs text-chalk-dim">:</span>
                        {scoreBox(gm.id, "a")}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <Flag teamId={gm.away.id} logoUrl={gm.away.logo_url} code={gm.away.code} name={gm.away.name} size={16} />
                        <span className="truncate text-xs text-chalk">{gm.away.name}</span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Standings preview */}
                <ol className="mt-3 space-y-1 border-t border-night/10 pt-2">
                  {standing.map((row, i) => (
                    <li
                      key={row.team.id}
                      className={`flex items-center gap-2 rounded px-1.5 py-1 text-xs ${
                        i < 2 ? "bg-grass/15" : i === 2 ? "bg-gold/10" : ""
                      }`}
                    >
                      <span className="w-3 shrink-0 text-chalk-dim">{i + 1}</span>
                      <Flag teamId={row.team.id} logoUrl={row.team.logo_url} code={row.team.code} name={row.team.name} size={14} />
                      <span className="min-w-0 flex-1 truncate text-chalk">{row.team.name}</span>
                      {i < 2 && <span className="shrink-0 text-grass">✓</span>}
                      {i === 2 && <span className="shrink-0 text-[10px] text-gold">3rd</span>}
                      <span className="shrink-0 tabular-nums text-chalk-dim">{row.pts}p</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      {/* Knockout */}
      <section className="space-y-4 border-t border-night/10 pt-6">
        <div>
          <h2 className="font-display text-xl text-chalk">🔥 Knockout bracket</h2>
          <p className="text-sm text-chalk-dim">
            {allGroupsComplete
              ? "Tap the team you think wins each tie. Winners advance automatically."
              : "Finish predicting all group scorelines to reveal your bracket."}
          </p>
        </div>

        {!allGroupsComplete ? (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-sm text-chalk-dim">
              {groupsDone}/{groupsOrder.length} groups complete
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-night/10">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{ width: `${(groupsDone / Math.max(1, groupsOrder.length)) * 100}%` }}
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
              <p className="mb-2 font-display text-lg text-gradient-gold">Your champion 🏆</p>
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
            <GameButton
              onClick={() => void saveNow(buildPayload())}
              disabled={saveState === "saving"}
              variant="gold"
            >
              {saveState === "saving" ? "Saving…" : "💾 Save"}
            </GameButton>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${saveBadge.cls}`}>
              {saveBadge.text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
