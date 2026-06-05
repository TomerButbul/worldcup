"use client";

import { useState } from "react";
import { LinkIcon, ShareIcon } from "@/components/icons";
import { playPop } from "@/lib/sound";

// Robust clipboard copy: prefer the async Clipboard API, fall back to a hidden
// <textarea> for in-app/older browsers. Runs inside the click gesture so iOS allows
// it. (Same approach as ShareInvite — kept local to avoid a shared-util refactor.)
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// "Share my bracket" — turns the viewer's predicted bracket into a public link
// (/b/<slug>) they can post anywhere. The link unfurls a champion/podium teaser card
// and opens the full read-only tree, with a "build your own" CTA — so every share is
// a funnel back to sign-up. Copy link is the reliable default; phones that support it
// also get a native Share button (WhatsApp/iMessage/Instagram).
export default function ShareBracket({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const link = () =>
    typeof window !== "undefined" ? `${window.location.origin}/b/${slug}` : `/b/${slug}`;

  async function copy() {
    const ok = await copyText(link());
    if (!ok) return;
    playPop();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    const url = link();
    try {
      await navigator.share({
        title: "My World Cup 2026 bracket",
        text: `My World Cup 2026 bracket — think you can beat it? ${url}`,
        url,
      });
    } catch {
      /* dismissed/unsupported — Copy link covers it */
    }
  }

  const base =
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50";
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void copy()}
        className={`${base} text-night bg-gradient-to-b from-gold-bright to-gold glow-gold shine hover:brightness-105`}
        aria-label="Copy a link to your bracket"
      >
        {copied ? (
          "✓ Bracket link copied!"
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <LinkIcon size={14} /> Share my bracket
          </span>
        )}
      </button>
      {canShare && (
        <button
          type="button"
          onClick={() => void share()}
          className={`${base} glass text-chalk hover:bg-night/5`}
          aria-label="Share your bracket"
        >
          <span className="inline-flex items-center gap-1.5">
            <ShareIcon size={14} /> Share
          </span>
        </button>
      )}
    </div>
  );
}
