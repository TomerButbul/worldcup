"use client";

import { useState } from "react";
import { LinkIcon, ShareIcon } from "@/components/icons";
import { copyText } from "@/lib/clipboard";
import { playPop } from "@/lib/sound";

// The viewer's personal invite link. Copying it (or sharing via the native sheet) is
// the entire growth loop — a friend who signs up through it grows the prize pool you
// both compete for. `compact` renders one subtle button (used inside the prize
// callout) instead of the full link-pill + buttons, so the bare deployment URL never
// shows on screen.
export default function ReferralLink({ link, compact = false }: { link: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await copyText(link);
    if (!ok) return;
    playPop();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function share() {
    try {
      await navigator.share({
        title: "TopCorner",
        text: `Play World Cup TopCorner with me — sign up with my link and you grow the prize pool we both compete for:`,
        url: link,
      });
    } catch {
      // dismissed or unsupported — Copy covers it
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Compact: one subtle full-width button — share on mobile, copy on desktop. The bare
  // deployment URL never renders (it looked unpolished and untrustworthy on screen).
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void (canShare ? share() : copy())}
        aria-label="Invite friends with your link"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-night/[0.05] px-3 py-2.5 text-sm font-semibold text-chalk ring-1 ring-inset ring-gold/30 transition hover:bg-gold/10"
      >
        {copied ? (
          "✓ Invite link copied!"
        ) : (
          <span className="inline-flex items-center gap-1.5">
            {canShare ? <ShareIcon size={15} /> : <LinkIcon size={15} />} Invite friends — grow the pool
          </span>
        )}
      </button>
    );
  }

  // Show the link without the protocol so it reads cleanly in the pill.
  const pretty = link.replace(/^https?:\/\//, "");

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <code className="flex min-w-0 flex-1 items-center truncate rounded-xl border border-night/10 bg-night/5 px-3 py-2.5 font-mono text-xs text-chalk-dim">
          {pretty}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label="Copy your invite link"
          className="text-night inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-gold-bright to-gold px-3.5 py-2.5 text-sm font-semibold glow-gold shine transition hover:brightness-105"
        >
          {copied ? (
            "✓ Copied!"
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <LinkIcon size={15} /> Copy link
            </span>
          )}
        </button>
      </div>
      {canShare && (
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl glass px-3 py-2.5 text-sm font-semibold text-chalk transition hover:bg-night/5"
          aria-label="Share your invite link"
        >
          <ShareIcon size={15} /> Share invite
        </button>
      )}
    </div>
  );
}
