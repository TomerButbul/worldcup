"use client";

import { useEffect, useState } from "react";
import { SUPPORT_URL } from "@/lib/site";

// A quiet, dismissible "buy me a coffee" ask. Renders only when a SUPPORT_URL is
// configured (lib/site.ts), so it stays completely hidden until a tip link exists.
// Polite by design: one tap to dismiss (remembered), never blocks anything, and the
// copy reassures the game stays free for everyone. A solo-project framing — honest
// here, and what actually earns small tips.
export default function SupportCard() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!SUPPORT_URL) return;
    if (localStorage.getItem("wc_support_dismissed") === "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client check
    setShow(true);
  }, []);

  if (!SUPPORT_URL || !show) return null;

  function dismiss() {
    localStorage.setItem("wc_support_dismissed", "1");
    setShow(false);
  }

  return (
    <div className="glass-strong relative rounded-2xl p-4 text-left">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
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
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 inline-block rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-night transition hover:brightness-110"
      >
        ☕ Buy me a coffee
      </a>
    </div>
  );
}
