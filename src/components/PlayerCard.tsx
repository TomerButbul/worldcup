"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import PlayerAvatar from "@/components/PlayerAvatar";
import Flag from "@/components/Flag";

type Profile = {
  id: number;
  name: string;
  position: string | null;
  number: number | null;
  age: number | null;
  nationality: string | null;
  photo_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  team: { id: number; name: string; logo_url: string | null; code: string | null } | null;
  stats: { goals: number; yellow: number; red: number };
};

const POS_SHORT: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DF",
  Midfielder: "MF",
  Attacker: "FW",
};

// Wrap any chip / name in this to make it tap-to-open the player's profile card.
// Self-contained: it owns the open state and lazily fetches /api/players/[id],
// so no rich player data has to be threaded through the surrounding page.
export function PlayerCardButton({
  playerId,
  name,
  detailPos,
  className,
  children,
}: {
  playerId: number;
  name?: string;
  detailPos?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <PlayerCardModal
            playerId={playerId}
            detailPos={detailPos}
            fallbackName={name}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-night/5 p-2 text-center">
      <p className="truncate text-sm font-semibold text-chalk">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-chalk-dim">{label}</p>
    </div>
  );
}

function PlayerCardModal({
  playerId,
  detailPos,
  fallbackName,
  onClose,
}: {
  playerId: number;
  detailPos?: string;
  fallbackName?: string;
  onClose: () => void;
}) {
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/players/${playerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch"))))
      .then((d: Profile) => {
        if (alive) setP(d);
      })
      .catch(() => {
        if (alive) setErr(true);
      });
    return () => {
      alive = false;
    };
  }, [playerId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const name = p?.name ?? fallbackName ?? "Player";
  const broad = p?.position ? (POS_SHORT[p.position] ?? p.position) : null;
  const badge = detailPos || broad;
  const noStats = !!p && p.stats.goals === 0 && p.stats.yellow === 0 && p.stats.red === 0;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-night/70 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="glass-strong w-full max-w-sm rounded-t-3xl p-5 sm:rounded-3xl"
      >
        <div className="flex items-center gap-3">
          <PlayerAvatar playerId={playerId} name={name} size={60} className="border-2 border-white/80 shadow" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl text-chalk">{name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-chalk-dim">
              {badge && (
                <span className="rounded bg-gold/20 px-1.5 py-0.5 font-semibold text-gold">{badge}</span>
              )}
              {p?.number != null && <span className="tabular-nums">#{p.number}</span>}
              {p?.team && (
                <span className="flex min-w-0 items-center gap-1">
                  <Flag teamId={p.team.id} logoUrl={p.team.logo_url} code={p.team.code} name={p.team.name} size={14} />
                  <span className="truncate">{p.team.name}</span>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full bg-night/10 px-2 py-1 text-sm text-chalk-dim hover:text-chalk"
          >
            ✕
          </button>
        </div>

        {err ? (
          <p className="mt-5 text-center text-sm text-chalk-dim">Couldn&apos;t load this player.</p>
        ) : !p ? (
          <p className="mt-5 text-center text-sm text-chalk-dim">Loading…</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Age" value={p.age != null ? String(p.age) : "—"} />
              <Stat label="Height" value={p.height_cm != null ? `${p.height_cm}cm` : "—"} />
              <Stat label="Weight" value={p.weight_kg != null ? `${p.weight_kg}kg` : "—"} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat label="Goals" value={`⚽ ${p.stats.goals}`} />
              <Stat label="Yellow" value={`🟨 ${p.stats.yellow}`} />
              <Stat label="Red" value={`🟥 ${p.stats.red}`} />
            </div>
            {p.nationality && (
              <p className="mt-3 text-center text-[11px] text-chalk-dim">🌍 {p.nationality}</p>
            )}
            {noStats && (
              <p className="mt-1 text-center text-[11px] text-chalk-dim">
                No tournament stats yet — kicks off Jun 11.
              </p>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
