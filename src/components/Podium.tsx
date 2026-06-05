"use client";

import { motion } from "motion/react";
import Flag from "@/components/Flag";
import Trophy from "@/components/art/Trophy";
import { openTeamCard } from "@/components/TeamCard";
import type { BracketTeam } from "@/components/KnockoutBracket";

// The climax of the bracket: a real medal podium for the predicted top three.
// Gold takes the tall centre pedestal (crowned with the trophy), silver and
// bronze flank it on shorter steps. Pure result display — the picking happens in
// the final/3rd-place match cards above it.

type Place = 1 | 2 | 3;

const CFG: Record<
  Place,
  { label: string; ped: string; pad: string; ring: string; grad: string; num: string; flag: number; order: string }
> = {
  // order via flex `order` so the source stays 1-2-3 but renders silver|gold|bronze.
  1: {
    label: "Champion",
    ped: "h-28 sm:h-32",
    pad: "pb-1",
    ring: "ring-gold",
    grad: "from-[#fbe9a8] via-[#e9bd49] to-[#b07d12]",
    num: "text-[#6f4e00]",
    flag: 40,
    order: "order-2",
  },
  2: {
    label: "Runner-up",
    ped: "h-20 sm:h-24",
    pad: "",
    ring: "ring-slate-300",
    grad: "from-[#f4f7fa] via-[#cdd6e0] to-[#93a1b2]",
    num: "text-slate-600",
    flag: 30,
    order: "order-1",
  },
  3: {
    label: "Third place",
    ped: "h-14 sm:h-16",
    pad: "",
    ring: "ring-[#cd7f32]",
    grad: "from-[#f1cda3] via-[#cd7f32] to-[#8a5424]",
    num: "text-[#5e3a16]",
    flag: 30,
    order: "order-3",
  },
};

function Step({ place, team, delay }: { place: Place; team: BracketTeam | null; delay: number }) {
  const c = CFG[place];
  const champ = place === 1;
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center justify-end ${c.order}`}>
      {/* Trophy crowns the champion */}
      {champ && (
        <motion.div
          initial={{ opacity: 0, y: -14, scale: 0.5, rotate: -8 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={{ delay: delay + 0.35, type: "spring", stiffness: 240, damping: 12 }}
          className="mb-0.5"
        >
          <Trophy size={38} />
        </motion.div>
      )}

      {/* Flag medallion — tappable to open the team card */}
      <motion.button
        type="button"
        onClick={() => team && openTeamCard({ teamId: team.id, name: team.name })}
        disabled={!team}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.15, type: "spring", stiffness: 260, damping: 18 }}
        aria-label={team ? `${team.name} — view details` : undefined}
        className={`grid place-items-center rounded-full bg-white/95 p-1 shadow-md ring-2 ${c.ring} ${
          champ ? "glow-gold" : ""
        } ${team ? "cursor-pointer transition hover:brightness-105" : "opacity-60"}`}
      >
        {team ? (
          <Flag teamId={team.id} logoUrl={team.logo_url} code={team.code} name={team.name} size={c.flag} />
        ) : (
          <span
            className="grid place-items-center font-display text-chalk-dim"
            style={{ width: c.flag, height: c.flag }}
          >
            ?
          </span>
        )}
      </motion.button>

      {/* Name */}
      <span
        className={`mt-1 max-w-full truncate px-0.5 text-center ${
          champ ? "font-display text-sm text-gradient-gold sm:text-base" : "text-xs font-semibold text-chalk"
        }`}
      >
        {team?.name ?? "—"}
      </span>

      {/* Pedestal — rises into place */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        transition={{ delay, type: "spring", stiffness: 180, damping: 22 }}
        className="mt-1.5 w-full origin-bottom"
      >
        <div
          className={`relative ${c.ped} ${c.pad} flex w-full flex-col items-center justify-end overflow-hidden rounded-t-xl bg-gradient-to-b ${c.grad} shadow-[0_8px_20px_-6px_rgba(15,23,42,0.5)] ${
            champ ? "ring-1 ring-gold/60" : ""
          }`}
        >
          {/* top highlight lip */}
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-white/45" />
          <span aria-hidden className="absolute inset-y-0 left-0 w-2 bg-white/15" />
          <span className={`font-display text-3xl leading-none ${c.num} drop-shadow-sm sm:text-4xl`}>{place}</span>
          <span className={`mt-0.5 text-[8px] font-bold uppercase tracking-[0.12em] ${c.num} opacity-80 sm:text-[9px]`}>
            {c.label}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

export default function Podium({
  champion,
  runnerUp,
  third,
}: {
  champion: BracketTeam | null;
  runnerUp: BracketTeam | null;
  third: BracketTeam | null;
}) {
  return (
    <div className="glass-strong relative mx-auto max-w-sm overflow-hidden rounded-2xl p-4 pt-3">
      {/* spotlight behind the champion */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-gold/25 blur-3xl"
      />
      <p className="relative mb-3 text-center font-display text-[11px] uppercase tracking-[0.2em] text-chalk-dim">
        Predicted podium
      </p>
      <div className="relative flex items-end gap-2 sm:gap-3">
        <Step place={2} team={runnerUp} delay={0.05} />
        <Step place={1} team={champion} delay={0.18} />
        <Step place={3} team={third} delay={0.1} />
      </div>
      {!champion && (
        <p className="relative mt-3 text-center text-[11px] uppercase tracking-wide text-chalk-dim">
          Win the Final to crown your champion
        </p>
      )}
    </div>
  );
}
