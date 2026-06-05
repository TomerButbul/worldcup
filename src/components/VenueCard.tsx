"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import Ball from "@/components/art/Ball";
import { resolveVenue, type VenueInfo } from "@/lib/venues";

// Single global "one venue card open at a time" store — mirrors TeamCard /
// PlayerCard so the modal portals to <body> and escapes any transformed card.
let current: VenueInfo | null = null;
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
export function openVenueCard(v: VenueInfo) {
  current = v;
  emit();
}
function closeVenueCard() {
  current = null;
  emit();
}

// Tap-to-open wrapper for a synced fixture venue (id/name/city). Renders nothing
// when there's no venue, so callers can drop it in unconditionally.
export function VenueButton({
  venue,
  className,
  children,
}: {
  venue: { id?: number | null; name?: string | null; city?: string | null } | null | undefined;
  className?: string;
  children: ReactNode;
}) {
  const info = resolveVenue(venue);
  if (!info) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openVenueCard(info);
      }}
    >
      {children}
    </button>
  );
}

// Mounted once (root layout). Renders the single modal via a portal to <body>.
export function VenueCardHost() {
  const v = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {v && <VenueCardModal key={`${v.id}-${v.name}`} v={v} onClose={closeVenueCard} />}
    </AnimatePresence>,
    document.body,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-night/[0.04] p-3 text-center">
      <p className="font-display text-lg leading-tight text-chalk">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-chalk-dim">{label}</p>
    </div>
  );
}

function VenueCardModal({ v, onClose }: { v: VenueInfo; onClose: () => void }) {
  const [imgOk, setImgOk] = useState(true);

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

  const showImg = !!v.image && imgOk;
  const place = [v.city, v.country].filter(Boolean).join(", ");

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
        className="glass-strong max-h-[92vh] w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl"
      >
        {/* Hero photo (or a styled fallback when the venue image is missing). */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-grass/70 via-grass/45 to-electric/40">
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.image!}
              alt={v.name}
              className="h-full w-full object-cover"
              onError={() => setImgOk(false)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center opacity-80">
              <Ball size={56} />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-night/50 px-3 py-1.5 text-base text-white backdrop-blur transition hover:bg-night/70"
          >
            ✕
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/85 to-transparent p-4 pt-10">
            <p className="font-display text-2xl leading-tight text-white drop-shadow">{v.name}</p>
            {place && <p className="text-sm text-white/85">{place}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 p-4 sm:p-5">
          {v.capacity != null && <Stat label="Capacity" value={v.capacity.toLocaleString("en-US")} />}
          {v.city && <Stat label="City" value={v.city} />}
          {v.country && <Stat label="Country" value={v.country} />}
          <Stat label="2026 World Cup" value="Host venue" />
        </div>
      </motion.div>
    </motion.div>
  );
}
