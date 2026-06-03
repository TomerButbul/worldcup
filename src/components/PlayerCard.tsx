"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  birth_date: string | null;
  injured: boolean | null;
  photo_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  team: { id: number; name: string; logo_url: string | null; code: string | null } | null;
  stats: { apps: number; minutes: number; goals: number; assists: number; yellow: number; red: number };
  club: {
    name: string | null;
    league: string | null;
    apps: number;
    goals: number;
    assists: number;
    rating: number | null;
  } | null;
};

const POS_SHORT: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DF",
  Midfielder: "MF",
  Attacker: "FW",
};

function fmtDob(d: string) {
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? d
    : t.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// --- Single global "one card open at a time" store -------------------------
// Per-button local state let several cards open at once AND nested the modal
// inside transformed pitch chips (so `position: fixed` was trapped, tiny). A
// single shared request + a portaled host fixes both.
type CardReq = { playerId: number; name?: string; detailPos?: string };
let current: CardReq | null = null;
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
function getSnapshot() {
  return current;
}
function openPlayerCard(req: CardReq) {
  current = req;
  emit();
}
function closePlayerCard() {
  current = null;
  emit();
}

// Wrap any chip / name in this to make it tap-to-open the player's profile.
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
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openPlayerCard({ playerId, name, detailPos });
      }}
    >
      {children}
    </button>
  );
}

// Mounted once (root layout). Renders the single modal via a portal to <body>,
// escaping the transformed pitch containers so it's a true full-screen overlay.
export function PlayerCardHost() {
  const req = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (typeof document === "undefined") return null; // SSR: portal target absent
  return createPortal(
    <AnimatePresence>
      {req && <PlayerCardModal key={req.playerId} req={req} onClose={closePlayerCard} />}
    </AnimatePresence>,
    document.body,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-night/5 p-3 text-center">
      <p className="truncate font-display text-lg text-chalk">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-chalk-dim">{label}</p>
    </div>
  );
}

function PlayerCardModal({ req, onClose }: { req: CardReq; onClose: () => void }) {
  const { playerId, name: fallbackName, detailPos } = req;
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    // Re-keyed per playerId in the host, so each player gets a fresh instance —
    // no need to reset state synchronously here.
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
  const noStats =
    !!p && p.stats.apps + p.stats.goals + p.stats.assists + p.stats.yellow + p.stats.red === 0;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-night/80 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl sm:p-7"
      >
        <div className="-mr-1 -mt-1 mb-1 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-night/10 px-3 py-1.5 text-base text-chalk-dim transition hover:text-chalk"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <PlayerAvatar playerId={playerId} name={name} size={96} className="border-4 border-white/80 shadow-lg" />
          <p className="mt-3 font-display text-2xl text-chalk">{name}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-chalk-dim">
            {badge && <span className="rounded-lg bg-gold/20 px-2.5 py-1 font-semibold text-gold">{badge}</span>}
            {p?.number != null && <span className="tabular-nums">#{p.number}</span>}
            {p?.team && (
              <span className="flex items-center gap-1.5">
                <Flag teamId={p.team.id} logoUrl={p.team.logo_url} code={p.team.code} name={p.team.name} size={18} />
                <span>{p.team.name}</span>
              </span>
            )}
            {p?.injured && (
              <span className="rounded-lg bg-red-500/20 px-2 py-1 font-semibold text-red-600">🚑 Injured</span>
            )}
          </div>
        </div>

        {err ? (
          <p className="mb-4 mt-8 text-center text-sm text-chalk-dim">Couldn&apos;t load this player.</p>
        ) : !p ? (
          <p className="mb-4 mt-8 text-center text-sm text-chalk-dim">Loading…</p>
        ) : (
          <div className="mt-6 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Age" value={p.age != null ? String(p.age) : "—"} />
              <Stat label="Height" value={p.height_cm != null ? `${p.height_cm}cm` : "—"} />
              <Stat label="Weight" value={p.weight_kg != null ? `${p.weight_kg}kg` : "—"} />
            </div>
            <p className="pt-1 text-center text-[11px] font-semibold uppercase tracking-wider text-chalk-dim">
              Tournament
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Apps" value={String(p.stats.apps)} />
              <Stat label="Goals" value={`⚽ ${p.stats.goals}`} />
              <Stat label="Assists" value={`🅰️ ${p.stats.assists}`} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Minutes" value={`${p.stats.minutes}'`} />
              <Stat label="Yellow" value={`🟨 ${p.stats.yellow}`} />
              <Stat label="Red" value={`🟥 ${p.stats.red}`} />
            </div>
            {p.club && (
              <>
                <p className="pt-1 text-center text-[11px] font-semibold uppercase tracking-wider text-chalk-dim">
                  Club · 25/26
                </p>
                {(p.club.name || p.club.league) && (
                  <p className="text-center text-xs font-semibold text-chalk">
                    {[p.club.name, p.club.league].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="grid grid-cols-4 gap-2">
                  <Stat label="Apps" value={String(p.club.apps)} />
                  <Stat label="Goals" value={String(p.club.goals)} />
                  <Stat label="Assists" value={String(p.club.assists)} />
                  <Stat label="Rating" value={p.club.rating != null ? p.club.rating.toFixed(1) : "—"} />
                </div>
              </>
            )}
            {(p.nationality || p.birth_date) && (
              <p className="pt-1 text-center text-sm text-chalk-dim">
                {p.nationality ? `🌍 ${p.nationality}` : ""}
                {p.nationality && p.birth_date ? " · " : ""}
                {p.birth_date ? `🎂 ${fmtDob(p.birth_date)}` : ""}
              </p>
            )}
            {noStats && (
              <p className="text-center text-xs text-chalk-dim">No tournament stats yet — kicks off Jun 11.</p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
