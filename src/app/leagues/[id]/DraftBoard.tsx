"use client";

import { motion, AnimatePresence } from "motion/react";
import Avatar from "@/components/Avatar";
import { DRAFT_POTS, POT_LABELS, TOTAL_PICKS, type Pot } from "@/lib/draft";
import type { DraftMember, PickRow } from "./draftTypes";

export default function DraftBoard({
  picks,
  members,
  pickIndex,
  pot,
  seat,
  onClock,
  isMyTurn,
  isOwner,
  timerEnabled,
  remaining,
  busy,
  onPick,
  onForce,
  onToggleTimer,
}: {
  picks: PickRow[];
  members: DraftMember[];
  pickIndex: number;
  pot: number;
  seat: number;
  onClock: DraftMember | null;
  isMyTurn: boolean;
  isOwner: boolean;
  timerEnabled: boolean;
  remaining: number | null;
  busy: boolean;
  onPick: (slot: number) => Promise<boolean>;
  onForce: (slot: number | null) => Promise<boolean>;
  onToggleTimer: (enabled: boolean) => Promise<boolean>;
}) {
  const teams = DRAFT_POTS[pot as Pot] ?? [];
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const pickBySlot = new Map<number, PickRow>();
  for (const p of picks) if (p.pot === pot) pickBySlot.set(p.slot, p);

  const recent = [...picks].slice(-8).reverse();
  const secs = remaining == null ? null : Math.ceil(remaining);
  const low = secs != null && secs <= 15;
  const clock = secs == null ? null : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const canActOnTeam = isMyTurn || isOwner;

  function clickTeam(slot: number) {
    if (busy || pickBySlot.has(slot)) return;
    if (isMyTurn) void onPick(slot);
    else if (isOwner) void onForce(slot);
  }

  return (
    <div className="space-y-5">
      {/* Spotlight: who's on the clock */}
      <motion.div
        key={pickIndex}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className={`glass-strong rounded-3xl p-5 sm:p-6 ${isMyTurn ? "animate-pulse-glow ring-2 ring-gold" : ""}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-wider text-chalk-dim">On the clock</span>
          <span className="text-xs text-chalk-dim">
            Pick {pickIndex + 1} / {TOTAL_PICKS}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar url={onClock?.avatarUrl} name={onClock?.name ?? "?"} size={56} />
            <div className="min-w-0">
              <p className="truncate font-display text-2xl text-chalk sm:text-3xl">
                {onClock?.name ?? `Slot ${seat}`}
              </p>
              <p className="text-sm text-chalk-dim">
                Slot {seat} · {POT_LABELS[pot as Pot]}
              </p>
            </div>
          </div>

          {secs != null ? (
            <div
              className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-4 font-display text-xl tabular-nums ${
                low ? "border-red-500 text-red-600" : "border-gold text-gold"
              }`}
            >
              {clock}
            </div>
          ) : (
            <span className="shrink-0 text-sm text-chalk-dim">No time limit</span>
          )}
        </div>

        {isMyTurn && (
          <p className="mt-3 rounded-xl bg-gold/15 px-3 py-2 text-center font-display text-gold">
            🎯 YOUR PICK — choose a team below!
          </p>
        )}
      </motion.div>

      {/* Progress bar across the 48 picks */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-night/10">
        <motion.div
          className="h-full rounded-full bg-grass"
          initial={false}
          animate={{ width: `${(pickIndex / TOTAL_PICKS) * 100}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>

      {/* Owner controls */}
      {isOwner && (
        <div className="glass-strong flex flex-wrap items-center gap-2.5 rounded-2xl p-4">
          <span className="text-sm font-semibold text-chalk">Admin</span>
          <button
            onClick={() => void onForce(null)}
            disabled={busy}
            className="rounded-full border border-night/10 bg-white px-3 py-1.5 text-sm text-chalk transition hover:border-grass hover:bg-grass/10 disabled:opacity-50"
          >
            🎲 Force random for slot {seat}
          </button>
          <button
            onClick={() => void onToggleTimer(!timerEnabled)}
            disabled={busy}
            className="rounded-full border border-night/10 bg-white px-3 py-1.5 text-sm text-chalk transition hover:border-grass hover:bg-grass/10 disabled:opacity-50"
          >
            {timerEnabled ? "⏸ Pause timer" : "▶️ Resume timer"}
          </button>
          <span className="text-xs text-chalk-dim">Tap any open team to force it for this slot.</span>
        </div>
      )}

      {/* Team board for the current pot */}
      <div>
        <h2 className="mb-3 font-display text-lg text-chalk">{POT_LABELS[pot as Pot]}</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {teams.map((t, i) => {
            const slot = i + 1;
            const pick = pickBySlot.get(slot);
            const drafter = pick ? memberById.get(pick.user_id) : null;
            const isOpen = !pick;
            return (
              <button
                key={t.name}
                onClick={() => clickTeam(slot)}
                disabled={busy || !isOpen || !canActOnTeam}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  isOpen
                    ? canActOnTeam
                      ? "border-grass/40 hover:border-grass hover:bg-grass/10"
                      : "border-night/10"
                    : "border-night/5 bg-night/5 opacity-70"
                } disabled:cursor-not-allowed`}
              >
                <span className="text-2xl">{t.flag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-chalk">{t.name}</span>
                  {drafter && (
                    <span className="block truncate text-xs text-chalk-dim">→ {drafter.name}</span>
                  )}
                </span>
                {isOpen ? (
                  canActOnTeam && <span className="shrink-0 text-sm text-grass">pick</span>
                ) : (
                  <span className="shrink-0 text-sm">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent picks ticker */}
      {recent.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="mb-2 text-xs uppercase tracking-wider text-chalk-dim">Recent picks</h3>
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {recent.map((p) => {
                const who = memberById.get(p.user_id);
                const team = DRAFT_POTS[p.pot as Pot]?.[p.slot - 1];
                return (
                  <motion.li
                    key={p.pick_no}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-sm text-chalk"
                  >
                    <span className="text-chalk-dim">#{p.pick_no + 1}</span>
                    <span className="text-lg">{team?.flag}</span>
                    <span className="truncate">
                      <span className="font-semibold">{team?.name}</span>
                      <span className="text-chalk-dim"> → {who?.name ?? "?"}</span>
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  );
}
