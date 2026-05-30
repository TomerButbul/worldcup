"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import type { Player } from "@/lib/types";
import { savePrediction } from "./actions";
import { burst } from "@/lib/confetti";
import Flag from "@/components/Flag";
import PlayerAvatar from "@/components/PlayerAvatar";

export interface MatchCardData {
  id: number;
  stage: string;
  kickoff_at: string;
  status: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string;
  awayName: string;
  homeGoalsActual: number | null;
  awayGoalsActual: number | null;
}

interface Props {
  leagueId: string;
  match: MatchCardData;
  homePlayers: Player[];
  awayPlayers: Player[];
  initial: { home_goals: number; away_goals: number; scorer_ids: number[] } | null;
}

const STAGE_LABEL: Record<string, string> = {
  group: "Group Stage",
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarter-final",
  semi: "Semi-final",
  third_place: "Third place",
  final: "Final",
};

export default function MatchCard({ leagueId, match, homePlayers, awayPlayers, initial }: Props) {
  const locked = new Date(match.kickoff_at).getTime() <= Date.now();
  const [home, setHome] = useState(initial?.home_goals ?? 0);
  const [away, setAway] = useState(initial?.away_goals ?? 0);
  const [scorers, setScorers] = useState<number[]>(initial?.scorer_ids ?? []);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const kickoff = new Date(match.kickoff_at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const live = match.status === "live";
  const allPlayers = [...homePlayers, ...awayPlayers];
  const playerName = (id: number) => allPlayers.find((p) => p.id === id)?.name ?? `#${id}`;

  function toggleScorer(id: number) {
    setScorers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function step(setter: (fn: (n: number) => number) => void, delta: number) {
    setter((n) => Math.max(0, n + delta));
  }

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await savePrediction(leagueId, match.id, home, away, scorers);
      if (res.ok) {
        burst();
        setMsg("Saved! 🎉");
      } else {
        setMsg(res.error ?? "Error");
      }
    });
  }

  return (
    <motion.div layout className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-chalk-dim">
        <span className="font-display text-gold">{STAGE_LABEL[match.stage] ?? match.stage}</span>
        <span className="flex items-center gap-2">
          {live && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-red-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
            </span>
          )}
          {kickoff}
        </span>
      </div>

      <div className="flex items-center justify-center gap-4 text-center">
        <span className="flex flex-1 items-center justify-end gap-2 font-semibold text-chalk">
          {match.homeName}
          <Flag teamId={match.homeTeamId} name={match.homeName} size={28} />
        </span>

        {locked ? (
          <span className="rounded-xl bg-black/30 px-4 py-2 font-display text-xl text-chalk">
            {match.status === "finished" || live
              ? `${match.homeGoalsActual ?? 0} – ${match.awayGoalsActual ?? 0}`
              : "vs"}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <Stepper value={home} onDec={() => step(setHome, -1)} onInc={() => step(setHome, 1)} />
            <span className="text-chalk-dim">–</span>
            <Stepper value={away} onDec={() => step(setAway, -1)} onInc={() => step(setAway, 1)} />
          </div>
        )}

        <span className="flex flex-1 items-center justify-start gap-2 font-semibold text-chalk">
          <Flag teamId={match.awayTeamId} name={match.awayName} size={28} />
          {match.awayName}
        </span>
      </div>

      {locked ? (
        <div className="mt-3 text-center text-xs text-chalk-dim">
          {initial ? (
            <>
              Your pick: <span className="text-chalk">{initial.home_goals}–{initial.away_goals}</span>
              {initial.scorer_ids.length > 0 && <> · {initial.scorer_ids.map(playerName).join(", ")}</>}
            </>
          ) : (
            <span>🔒 Locked — no prediction made</span>
          )}
        </div>
      ) : (
        <>
          {allPlayers.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-chalk-dim">⚽ Goal scorers</p>
              <div className="flex flex-wrap gap-1.5">
                {allPlayers.map((p) => (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => toggleScorer(p.id)}
                    className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition ${
                      scorers.includes(p.id)
                        ? "border-grass bg-grass text-night"
                        : "border-white/15 text-chalk hover:bg-white/10"
                    }`}
                  >
                    <PlayerAvatar playerId={p.id} name={p.name} size={20} />
                    {p.name}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={save}
              disabled={pending}
              className="rounded-xl bg-grass px-4 py-1.5 text-sm font-semibold text-night glow-grass transition hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </motion.button>
            {msg && <span className="text-xs text-chalk-dim">{msg}</span>}
          </div>
        </>
      )}
    </motion.div>
  );
}

function Stepper({ value, onDec, onInc }: { value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <button onClick={onInc} className="text-chalk-dim hover:text-chalk" aria-label="Increase">
        ▲
      </button>
      <span className="w-9 rounded-lg bg-black/30 py-1 text-center font-display text-lg text-chalk">
        {value}
      </span>
      <button onClick={onDec} className="text-chalk-dim hover:text-chalk" aria-label="Decrease">
        ▼
      </button>
    </div>
  );
}
