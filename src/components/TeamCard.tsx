"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import Flag from "@/components/Flag";
import TeamFormation, { type TeamLineup } from "@/app/leagues/[id]/TeamFormation";

type Profile = {
  id: number;
  name: string;
  code: string | null;
  logo_url: string | null;
  group_label: string | null;
  fifa_rank: number | null;
  lineup: (TeamLineup & { official: boolean }) | null;
};

// --- Single global "one team card open at a time" store --------------------
// Mirrors PlayerCard.tsx: a module-level request + a portaled host, so the
// modal escapes any transformed pitch/crest container and is a true overlay.
// The team modal sits at z-[90]; PlayerCard's z-[100] means tapping a player in
// the XI stacks their card cleanly in front of the team card.
type CardReq = { teamId: number; name?: string };
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
function openTeamCard(req: CardReq) {
  current = req;
  emit();
}
function closeTeamCard() {
  current = null;
  emit();
}

// Wrap any crest / nation name in this to make it tap-to-open the team's card.
export function TeamCardButton({
  teamId,
  name,
  className,
  children,
}: {
  teamId: number;
  name?: string;
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
        openTeamCard({ teamId, name });
      }}
    >
      {children}
    </button>
  );
}

// Mounted once (root layout). Renders the single modal via a portal to <body>.
export function TeamCardHost() {
  const req = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (typeof document === "undefined") return null; // SSR: portal target absent
  return createPortal(
    <AnimatePresence>
      {req && <TeamCardModal key={req.teamId} req={req} onClose={closeTeamCard} />}
    </AnimatePresence>,
    document.body,
  );
}

function TeamCardModal({ req, onClose }: { req: CardReq; onClose: () => void }) {
  const { teamId, name: fallbackName } = req;
  const [t, setT] = useState<Profile | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    // Re-keyed per teamId in the host, so each team gets a fresh instance.
    let alive = true;
    fetch(`/api/teams/${teamId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch"))))
      .then((d: Profile) => {
        if (alive) setT(d);
      })
      .catch(() => {
        if (alive) setErr(true);
      });
    return () => {
      alive = false;
    };
  }, [teamId]);

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

  const name = t?.name ?? fallbackName ?? "Team";
  const projected = t?.lineup ? !t.lineup.official : false;

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-night/80 backdrop-blur-sm sm:items-center sm:p-4"
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
          <div className="overflow-hidden rounded-xl border-2 border-white/80 shadow-lg">
            <Flag
              teamId={teamId}
              logoUrl={t?.logo_url}
              code={t?.code}
              name={name}
              w={96}
              h={64}
              fit="cover"
            />
          </div>
          <p className="mt-3 font-display text-2xl text-chalk">{name}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-chalk-dim">
            {t?.group_label && (
              <span className="rounded-lg bg-gold/20 px-2.5 py-1 font-semibold text-gold">
                Group {t.group_label}
              </span>
            )}
            {t?.fifa_rank != null && (
              <span className="rounded-lg bg-night/10 px-2.5 py-1 font-semibold tabular-nums">
                FIFA #{t.fifa_rank}
              </span>
            )}
          </div>
        </div>

        {err ? (
          <p className="mb-4 mt-8 text-center text-sm text-chalk-dim">Couldn&apos;t load this team.</p>
        ) : !t ? (
          <p className="mb-4 mt-8 text-center text-sm text-chalk-dim">Loading…</p>
        ) : (
          <div className="mt-6 space-y-2">
            {/* TeamFormation already wraps each XI player in PlayerCardButton, so
                tapping a player opens their player card (z-[100]) over this one. */}
            <TeamFormation lineup={t.lineup} teamName={name} />
            {projected && (
              <p className="text-center text-[11px] text-chalk-dim">
                Projected XI — official lineup drops ~1h before kickoff.
              </p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
