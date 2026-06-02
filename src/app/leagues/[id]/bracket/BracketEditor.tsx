"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import type { Team } from "@/lib/types";
import { saveBracket } from "./actions";
import { burst, celebrate } from "@/lib/confetti";
import { goalCelebration } from "@/lib/goal";
import GameButton from "@/components/GameButton";
import Flag from "@/components/Flag";

type KnockoutStage = "round_of_16" | "quarter" | "semi" | "final";
type Knockout = Record<KnockoutStage, number[]>;

const STAGES: { key: KnockoutStage; label: string; max: number }[] = [
  { key: "round_of_16", label: "Round of 16", max: 16 },
  { key: "quarter", label: "Quarter-finals", max: 8 },
  { key: "semi", label: "Semi-finals", max: 4 },
  { key: "final", label: "Final", max: 2 },
];

const PREV: Record<KnockoutStage, KnockoutStage | null> = {
  round_of_16: null,
  quarter: "round_of_16",
  semi: "quarter",
  final: "semi",
};

interface Props {
  leagueId: string;
  groups: Record<string, Team[]>;
  initialKnockout: Partial<Knockout>;
  initialChampion: number | null;
  locked: boolean;
}

export default function BracketEditor({
  leagueId,
  groups,
  initialKnockout,
  initialChampion,
  locked,
}: Props) {
  const [standings, setStandings] = useState(groups);
  const [knockout, setKnockout] = useState<Knockout>({
    round_of_16: initialKnockout.round_of_16 ?? [],
    quarter: initialKnockout.quarter ?? [],
    semi: initialKnockout.semi ?? [],
    final: initialKnockout.final ?? [],
  });
  const [champion, setChampion] = useState<number | null>(initialChampion);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const teamsById = useMemo(() => {
    const m = new Map<number, Team>();
    for (const t of Object.values(standings).flat()) m.set(t.id, t);
    return m;
  }, [standings]);

  const allTeams = useMemo(() => Object.values(standings).flat(), [standings]);

  function move(label: string, index: number, dir: -1 | 1) {
    setStandings((prev) => {
      const list = [...prev[label]];
      const target = index + dir;
      if (target < 0 || target >= list.length) return prev;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...prev, [label]: list };
    });
  }

  function poolFor(stage: KnockoutStage): Team[] {
    const prev = PREV[stage];
    if (!prev) return allTeams;
    return knockout[prev].map((id) => teamsById.get(id)).filter(Boolean) as Team[];
  }

  function toggle(stage: KnockoutStage, teamId: number) {
    setKnockout((prev) => {
      const selected = prev[stage].includes(teamId);
      const max = STAGES.find((s) => s.key === stage)!.max;
      const next: Knockout = { ...prev };
      if (selected) {
        const order: KnockoutStage[] = ["round_of_16", "quarter", "semi", "final"];
        const from = order.indexOf(stage);
        for (let i = from; i < order.length; i++) {
          next[order[i]] = next[order[i]].filter((id) => id !== teamId);
        }
        if (champion === teamId) setChampion(null);
      } else {
        if (prev[stage].length >= max) return prev;
        next[stage] = [...prev[stage], teamId];
      }
      return next;
    });
  }

  function pickChampion(id: number | null) {
    setChampion(id);
    if (id != null) {
      celebrate();
      goalCelebration("CHAMPION!");
    }
  }

  function save() {
    setMsg(null);
    const group_standings: Record<string, number[]> = {};
    for (const [label, teams] of Object.entries(standings)) {
      group_standings[label] = teams.map((t) => t.id);
    }
    startTransition(async () => {
      const res = await saveBracket(leagueId, {
        group_standings,
        knockout,
        champion_team_id: champion,
      });
      if (res.ok) {
        burst();
        setMsg("Saved! 🎉");
      } else {
        setMsg(res.error ?? "Error");
      }
    });
  }

  const finalists = knockout.final.map((id) => teamsById.get(id)).filter(Boolean) as Team[];

  // Completeness: each knockout stage filled to its max + a champion chosen.
  const stagesDone = STAGES.filter((s) => knockout[s.key].length === s.max).length;
  const stepsDone = stagesDone + (champion != null ? 1 : 0);
  const totalSteps = STAGES.length + 1;
  const allComplete = stepsDone === totalSteps;

  return (
    <div className="space-y-10 pb-36">
      {/* Group stage */}
      <section className="space-y-3">
        <h2 className="font-display text-xl text-chalk">⚽ Group stage — top 2 advance</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(standings).map(([label, teams]) => (
            <div key={label} className="glass rounded-2xl p-3">
              <h3 className="mb-2 font-display text-sm text-gold">Group {label}</h3>
              <ol className="space-y-1">
                {teams.map((t, i) => (
                  <motion.li
                    key={t.id}
                    layout
                    className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                      i < 2 ? "bg-grass/15" : "bg-night/[0.04]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-4 shrink-0 text-chalk-dim">{i + 1}</span>
                      <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={18} />
                      <span className="truncate text-chalk">{t.name}</span>
                      {i < 2 && <span className="shrink-0 text-xs text-grass">✓</span>}
                    </span>
                    {!locked && (
                      <span className="flex shrink-0 gap-1">
                        <button
                          onClick={() => move(label, i, -1)}
                          disabled={i === 0}
                          className="rounded px-3 py-2 text-lg leading-none text-chalk-dim hover:text-chalk disabled:opacity-20"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => move(label, i, 1)}
                          disabled={i === teams.length - 1}
                          className="rounded px-3 py-2 text-lg leading-none text-chalk-dim hover:text-chalk disabled:opacity-20"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                      </span>
                    )}
                  </motion.li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Knockout funnel */}
      <section className="space-y-5 border-t border-night/10 pt-8">
        <h2 className="font-display text-xl text-chalk">🔥 Knockout — pick who advances</h2>
        {STAGES.map((stage) => {
          const pool = poolFor(stage.key);
          const chosen = knockout[stage.key];
          const complete = chosen.length === stage.max;
          return (
            <div key={stage.key} className="glass rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm text-chalk">{stage.label}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    complete ? "bg-grass/20 text-grass" : "text-chalk-dim"
                  }`}
                >
                  {chosen.length}/{stage.max}
                </span>
              </div>
              {pool.length === 0 ? (
                <p className="text-xs text-chalk-dim">Pick teams in the previous round first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pool.map((t) => {
                    const active = chosen.includes(t.id);
                    const full = chosen.length >= stage.max;
                    return (
                      <motion.button
                        key={t.id}
                        whileTap={{ scale: 0.88 }}
                        onClick={() => toggle(stage.key, t.id)}
                        disabled={locked || (!active && full)}
                        className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-30 ${
                          active
                            ? "border-grass bg-grass text-night glow-grass"
                            : "border-night/10 text-chalk hover:bg-night/5"
                        }`}
                      >
                        <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={16} />
                        {t.name}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Champion */}
        <div className="glass-strong rounded-2xl p-5 text-center">
          <label className="mb-3 block font-display text-lg text-gradient-gold">Champion 🏆</label>
          {finalists.length === 0 ? (
            <p className="text-sm text-chalk-dim">Pick your two finalists first.</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {finalists.map((t) => (
                <motion.button
                  key={t.id}
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => pickChampion(champion === t.id ? null : t.id)}
                  disabled={locked}
                  className={`flex items-center gap-2 rounded-xl border px-5 py-3 font-display text-base transition sm:text-lg ${
                    champion === t.id
                      ? "border-gold bg-gold/15 text-gold glow-gold"
                      : "border-night/10 text-chalk hover:bg-night/5"
                  }`}
                >
                  {champion === t.id && "👑"}
                  <Flag teamId={t.id} logoUrl={t.logo_url} code={t.code} name={t.name} size={26} />
                  {t.name}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </section>

      {!locked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-night/10 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] pr-16 sm:px-6 sm:pr-20">
            <GameButton onClick={save} disabled={pending} variant="gold">
              {pending ? "Saving…" : "💾 Save picks"}
            </GameButton>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                allComplete ? "bg-grass/20 text-grass" : "glass text-chalk-dim"
              }`}
            >
              {allComplete ? "✓ Bracket complete" : `${stepsDone}/${totalSteps} done`}
            </span>
            {msg && <span className="text-sm text-chalk-dim">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
