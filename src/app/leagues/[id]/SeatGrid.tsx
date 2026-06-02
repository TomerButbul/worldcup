"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Avatar from "@/components/Avatar";
import { btnClass, GOLD_GRADIENT } from "@/components/buttonStyles";
import type { DraftMember } from "./draftTypes";

export default function SeatGrid({
  members,
  seatToMember,
  mySeat,
  isOwner,
  busy,
  filledSeats,
  onClaim,
  onAssign,
  onOpen,
}: {
  members: DraftMember[];
  seatToMember: Map<number, DraftMember>;
  mySeat: number | null;
  isOwner: boolean;
  busy: boolean;
  filledSeats: number;
  onClaim: (seat: number) => Promise<boolean>;
  onAssign: (userId: string, seat: number) => Promise<boolean>;
  onOpen: () => Promise<boolean>;
}) {
  const [assigning, setAssigning] = useState<number | null>(null);

  function clickSeat(seat: number) {
    if (busy) return;
    if (isOwner) {
      setAssigning((s) => (s === seat ? null : seat));
      return;
    }
    if (!seatToMember.has(seat)) void onClaim(seat);
  }

  return (
    <div className="space-y-5">
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-xl text-chalk">Take your draft slot</h2>
        <p className="mt-1 text-sm text-chalk-dim">
          {isOwner
            ? "Tap a slot to assign a manager (you can override anytime before kickoff)."
            : mySeat
              ? `You're in slot ${mySeat}. Tap a free slot to move.`
              : "Tap a free slot to claim your draft position."}
        </p>
        <p className="mt-1 text-xs text-chalk-dim">
          Snake order: Pot 1 drafts 1&rarr;16, Pots 2 &amp; 3 draft 16&rarr;1.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 16 }, (_, i) => i + 1).map((seat) => {
            const occ = seatToMember.get(seat);
            const mine = mySeat === seat;
            const selected = assigning === seat;
            return (
              <motion.button
                key={seat}
                layout
                onClick={() => clickSeat(seat)}
                disabled={busy || (!isOwner && !!occ && !mine)}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                  mine
                    ? "border-grass bg-grass/15"
                    : occ
                      ? "border-night/10 bg-night/5"
                      : "border-dashed border-grass/40 hover:border-grass hover:bg-grass/10"
                } ${selected ? "ring-2 ring-gold" : ""} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm ${
                    occ ? "bg-night/10 text-chalk" : "bg-grass/20 text-grass"
                  }`}
                >
                  {seat}
                </span>
                {occ ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Avatar url={occ.avatarUrl} name={occ.name} size={22} />
                    <span className="min-w-0 truncate text-sm font-semibold text-chalk">{occ.name}</span>
                  </span>
                ) : (
                  <span className="text-sm text-chalk-dim">Open</span>
                )}
                {mine && (
                  <span className="ml-auto shrink-0 rounded bg-grass/20 px-1.5 py-0.5 text-[10px] font-bold text-grass">
                    you
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {isOwner && assigning != null && (
        <div className="glass-strong rounded-3xl p-5">
          <h3 className="font-display text-chalk">Assign a manager to slot {assigning}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {members.length === 0 && (
              <p className="text-sm text-chalk-dim">No managers have joined yet.</p>
            )}
            {members.map((m) => (
              <button
                key={m.userId}
                disabled={busy}
                onClick={async () => {
                  const ok = await onAssign(m.userId, assigning);
                  if (ok) setAssigning(null);
                }}
                className="flex items-center gap-2 rounded-full border border-night/10 bg-white px-3 py-1.5 text-sm text-chalk transition hover:border-grass hover:bg-grass/10 disabled:opacity-50"
              >
                <Avatar url={m.avatarUrl} name={m.name} size={20} />
                <span className="max-w-[10rem] truncate">{m.name}</span>
                {m.seat != null && <span className="text-xs text-chalk-dim">(slot {m.seat})</span>}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAssigning(null)}
            className="mt-3 text-sm text-chalk-dim underline hover:text-chalk"
          >
            Cancel
          </button>
        </div>
      )}

      {isOwner && (
        <div className="glass-strong flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5">
          <div>
            <h3 className="font-display text-chalk">Start the draft</h3>
            <p className="text-sm text-chalk-dim">{filledSeats}/16 slots filled.</p>
          </div>
          <button
            onClick={() => void onOpen()}
            disabled={busy || filledSeats !== 16}
            className={btnClass("gold")}
            style={filledSeats === 16 ? { background: GOLD_GRADIENT, boxShadow: "var(--shadow-glow-gold)" } : undefined}
          >
            🚀 Open Draft
          </button>
        </div>
      )}
    </div>
  );
}
