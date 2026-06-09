"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { INVITATIONAL_NAME, PRIZE_LABEL } from "@/lib/contest";

// One-time, dismissible announcement pinned to the TOP of Home. Mount-gated so the
// server render and the first client render both produce nothing (no hydration
// mismatch); after mount we reveal it unless this browser already dismissed it.
// WHETHER this renders at all is decided server-side by the dashboard (admins always,
// everyone once INVITATIONAL_BANNER_ENABLED is flipped on) — this just handles the
// per-browser dismiss.
const KEY = "tc_inv_banner_v1";

export default function InvitationalBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "dismissed") setShow(true);
    } catch {
      setShow(true); // storage blocked → still show the announcement
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "dismissed");
    } catch {
      /* ignore — worst case it shows again next visit */
    }
    setShow(false);
  }

  return (
    <div className="relative mb-4 flex items-center gap-3 overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/20 via-gold/10 to-transparent px-4 py-3 sm:mb-6">
      <span className="pointer-events-none absolute -top-16 left-6 h-32 w-32 rounded-full bg-gold/20 blur-3xl" />
      <span className="relative text-2xl">🏆</span>
      <div className="relative min-w-0 flex-1">
        <p className="text-sm font-semibold text-chalk">
          New — {INVITATIONAL_NAME}
        </p>
        <p className="text-xs text-chalk-dim">
          Invite a friend. Best bracket wins {PRIZE_LABEL}.
        </p>
      </div>
      <Link
        href="/invitational"
        className="text-night relative shrink-0 rounded-xl bg-gradient-to-b from-gold-bright to-gold px-3.5 py-2 text-sm font-semibold glow-gold shine transition hover:brightness-105"
      >
        Enter →
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="relative shrink-0 rounded-lg p-1 text-chalk-dim transition hover:bg-night/10 hover:text-chalk"
      >
        <svg
          viewBox="0 0 20 20"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </div>
  );
}
