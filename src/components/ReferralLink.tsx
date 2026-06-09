"use client";

import { useState } from "react";
import { LinkIcon, ShareIcon } from "@/components/icons";
import { copyText } from "@/lib/clipboard";
import { playPop } from "@/lib/sound";

// The viewer's personal invite link for The TopCorner Invitational. Copying it (or
// sharing via the native sheet) is the entire growth loop — a friend who signs up
// through it puts BOTH of you in the running for the prize.
export default function ReferralLink({ link }: { link: string }) {
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
        title: "The TopCorner Invitational",
        text: `Play World Cup TopCorner with me — sign up with my link and we're both in the running for the prize:`,
        url: link,
      });
    } catch {
      // dismissed or unsupported — Copy covers it
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
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
