"use client";

import QRCode from "react-qr-code";
import { SITE_URL } from "@/lib/site";
import Trophy from "@/components/art/Trophy";
import Ball from "@/components/art/Ball";

const PRETTY_URL = SITE_URL.replace(/^https?:\/\//, "");

// A bold, brandable "scan to play" screen — postable as-is and good to throw on a
// screen at a watch party. The QR uses level-H error correction so the centred
// ball badge can sit on top without breaking the scan.
export default function QRPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-gold ring-1 ring-gold/40">
        <Trophy size={15} /> World Cup 2026
      </div>

      <div className="space-y-2.5">
        <h1 className="font-display text-[2.75rem] leading-[0.92] text-shimmer-fifa sm:text-6xl">
          Predict the
          <br />
          World Cup
        </h1>
        <p className="mx-auto max-w-xs text-pretty text-sm text-chalk-dim">
          Build your bracket, call every match &amp; goal scorer, and climb the live
          leaderboard with your friends.
        </p>
      </div>

      {/* QR card */}
      <div className="relative rounded-[2rem] bg-white p-5 shadow-2xl ring-[5px] ring-gold/50 glow-gold">
        <QRCode
          value={SITE_URL}
          size={236}
          level="H"
          bgColor="#ffffff"
          fgColor="#0b1033"
          className="h-auto w-full max-w-[236px]"
        />
        {/* Centred ball badge — punches a clean hole the H-level QR can spare. */}
        <span className="absolute left-1/2 top-1/2 flex h-[3.25rem] w-[3.25rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-[3px] border-white bg-gold shadow-md">
          <Ball size={30} />
        </span>
      </div>

      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-2 rounded-full bg-night/5 px-4 py-2 font-mono text-sm font-semibold text-chalk ring-1 ring-night/10">
          <span className="h-2 w-2 animate-pulse rounded-full bg-grass" />
          {PRETTY_URL}
        </div>
        <p className="mx-auto max-w-[17rem] text-pretty text-xs text-chalk-dim">
          Point your phone camera at the code — free, plays right in your browser, add it
          to your home screen like an app.
        </p>
      </div>

      <p className="font-display text-sm uppercase tracking-wide text-gold">
        <Ball size={14} className="mr-1 inline-block align-[-2px]" />
        Kicks off June 11 — lock your bracket now
      </p>
    </main>
  );
}
