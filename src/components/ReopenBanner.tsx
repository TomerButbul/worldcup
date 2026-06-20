"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// One-time, dismissible home-page announcement: the bracket re-open window. The
// dismissal is remembered per-device in localStorage so it never nags twice. Bump
// the KEY if a future announcement should re-show to everyone.
const KEY = "announce:bracket-reopen-2026";

export default function ReopenBanner() {
  // Start hidden so SSR and the first client render agree (no hydration flash);
  // reveal on mount only if this device hasn't dismissed it yet.
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode / storage disabled — just hide for this view */
    }
    setShow(false);
  };

  return (
    <div className="glass-strong flex items-start justify-between gap-3 rounded-2xl border border-gold/30 p-4">
      <Link href="/bracket" className="min-w-0 flex-1">
        <p className="font-display text-base text-gold">⚽ Your bracket is open to re-pick!</p>
        <p className="mt-0.5 text-sm text-chalk-dim">
          Redo your Round of 32 — free until Sunday night. Your group order still builds your bracket.{" "}
          <span className="font-semibold text-grass">Re-pick now →</span>
        </p>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-chalk-dim transition hover:bg-night/5 hover:text-chalk"
      >
        ✕
      </button>
    </div>
  );
}
