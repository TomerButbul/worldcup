"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { Upfront, Live, Trophy } from "@/components/icons";

// First-open tutorial: shows once (per device) the first time someone opens a
// league, so even existing players get the rundown. Tracked in localStorage so
// it never nags after "Got it". Bump the key to re-show after a big rules change.
const SEEN_KEY = "wc_seen_intro_v1";

type Step = { Icon: ComponentType<{ size?: number }>; title: string; body: string };
const STEPS: Step[] = [
  {
    Icon: Upfront,
    title: "Predict upfront",
    body: "Set the group scorelines — your knockout bracket builds itself — then crown a champion and call the 4 awards.",
  },
  {
    Icon: Live,
    title: "Play live",
    body: "As matches kick off, pick each game's goal scorers; for knockouts, the exact score + who wins on penalties.",
  },
  {
    Icon: Trophy,
    title: "Win 3 crowns",
    body: "Climb three leaderboards — Upfront, Live and Total. Everything auto-saves and locks at kickoff (Jun 11).",
  },
];

export default function LeagueIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY) !== "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time first-visit check
      setOpen(true);
    }
  }, []);

  function close() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-night/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-strong w-full max-w-md rounded-3xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl text-gradient-gold">How this works</h2>
        <p className="mt-1 text-sm text-chalk-dim">Three ways to score — here&apos;s the gist.</p>

        <ul className="mt-4 space-y-3">
          {STEPS.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 shrink-0 text-chalk"><Icon size={22} /></span>
              <span className="min-w-0">
                <span className="block font-semibold text-chalk">{title}</span>
                <span className="block text-xs text-chalk-dim sm:text-sm">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-2xl bg-night/[0.04] p-3 text-xs leading-relaxed text-chalk-dim">
          <span className="text-chalk">Quick points:</span> exact group score{" "}
          <b className="text-gold">+3</b>, champion <b className="text-gold">+32</b>, Golden Boot{" "}
          <b className="text-gold">+12</b>, live exact score <b className="text-grass">+8</b>, each
          goal scorer <b className="text-grass">+3</b>.
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Link
            href="/how-it-works"
            onClick={close}
            className="text-sm font-semibold text-gold transition hover:text-gold-bright"
          >
            Full rules &amp; scoring →
          </Link>
          <button
            onClick={close}
            className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
