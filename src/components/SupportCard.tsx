"use client";

import { useEffect, useState } from "react";
import { SUPPORT_URL } from "@/lib/site";
import { KICKOFF_MS } from "@/lib/clock";

// A polite, *occasional* "buy me a coffee" nudge — shown during the tournament to
// people who keep coming back (a fair proxy for "they're enjoying it"), never to
// first-timers, and never on repeat. Stays completely hidden until a SUPPORT_URL
// exists. The gates, all client-side so they cost nothing on the server:
//   • only once the tournament has kicked off (no asking before the fun starts)
//   • only after the user has opened the app on ≥3 different days
//   • at most once every ~7 days (the × snoozes it for a week)
//   • "No thanks / already chipped in" — and tapping the coffee button — hides it
//     for good, so nobody who's given (or said no) ever gets asked again.
const DAYS_KEY = "wc_support_days";
const SNOOZE_KEY = "wc_support_snooze_until";
const OPTOUT_KEY = "wc_support_optout";
const ENGAGED_DAYS = 3;
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export default function SupportCard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!SUPPORT_URL || localStorage.getItem(OPTOUT_KEY) === "1") return;

    // Track distinct active days (return visits = enjoying it). Recorded on every
    // visit, even before kickoff, so a hooked early user is "engaged" by day one.
    const today = new Date().toISOString().slice(0, 10);
    let days: string[] = [];
    try {
      const raw = localStorage.getItem(DAYS_KEY);
      if (raw) days = JSON.parse(raw) as string[];
    } catch {
      days = [];
    }
    if (!days.includes(today)) {
      days.push(today);
      if (days.length > 40) days = days.slice(-40);
      localStorage.setItem(DAYS_KEY, JSON.stringify(days));
    }

    // Show only during the tournament, to an engaged user, outside any snooze.
    if (Date.now() < KICKOFF_MS) return;
    const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? "0");
    if (days.length >= ENGAGED_DAYS && Date.now() >= snoozeUntil) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time eligibility gate
      setShow(true);
    }
  }, []);

  if (!SUPPORT_URL || !show) return null;

  function snooze() {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setShow(false);
  }
  function optOut() {
    localStorage.setItem(OPTOUT_KEY, "1");
    setShow(false);
  }

  return (
    <div className="glass-strong relative rounded-2xl p-4 text-left">
      <button
        onClick={snooze}
        aria-label="Maybe later"
        className="absolute right-2.5 top-2 text-lg leading-none text-chalk-dim transition hover:text-chalk"
      >
        ×
      </button>
      <p className="pr-5 font-semibold text-chalk">☕ Enjoying World Cup?</p>
      <p className="mt-1 text-xs text-chalk-dim">
        It&apos;s a free, no-ads passion project I build in my spare time. If it&apos;s made
        your tournament more fun, you can chip in the price of a coffee — totally optional,
        and it stays free for everyone either way. 🙏
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={optOut}
          className="inline-block rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-night transition hover:brightness-110"
        >
          ☕ Buy me a coffee
        </a>
        <button onClick={optOut} className="text-xs text-chalk-dim transition hover:text-chalk">
          No thanks / already chipped in
        </button>
      </div>
    </div>
  );
}
