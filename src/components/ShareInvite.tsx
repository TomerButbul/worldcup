"use client";

import { useState } from "react";
import { LinkIcon, ShareIcon } from "@/components/icons";
import { playPop } from "@/lib/sound";

// Robust clipboard copy: prefer the async Clipboard API, fall back to a hidden
// <textarea> + execCommand for in-app/older browsers that block it. Runs inside
// the click gesture so iOS/Safari permit it.
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
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

// Invite share affordances for a league. "Copy invite link" reliably puts the
// full /join/<code> URL on the clipboard — this is what most people want, and it
// no longer routes through the native share sheet (whose "Copy" target can drop
// the URL and copy only the title). On phones that support it, a SEPARATE
// "Share" button opens the native sheet (WhatsApp, iMessage…) with the link.
export default function ShareInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const inviteLink = () =>
    typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : `/join/${code}`;

  async function copy(what: "link" | "code") {
    const ok = await copyText(what === "link" ? inviteLink() : code);
    if (!ok) return;
    playPop();
    setCopied(what);
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
  }

  async function share() {
    const link = inviteLink();
    try {
      // Embed the link in `text` as well: some share targets keep only `text`
      // and discard `url`, so this guarantees the link travels either way.
      await navigator.share({
        title: "World Cup prediction league",
        text: `Join my World Cup prediction league: ${link}`,
        url: link,
      });
    } catch {
      // Dismissed or unsupported mid-call — no-op; Copy link covers it.
    }
  }

  const base =
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50";

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void copy("link")}
        className={`${base} text-night shine hover:brightness-105`}
        aria-label="Copy invite link"
      >
        {copied === "link" ? (
          "✓ Link copied!"
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <LinkIcon size={14} /> Copy invite link
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => void copy("code")}
        className={`${base} glass text-chalk hover:bg-night/5`}
        aria-label="Copy join code"
      >
        {copied === "code" ? "✓ Code copied!" : "Copy code"}
      </button>
      {canShare && (
        <button
          type="button"
          onClick={() => void share()}
          className={`${base} glass text-chalk hover:bg-night/5`}
          aria-label="Share invite link"
        >
          <span className="inline-flex items-center gap-1.5">
            <ShareIcon size={14} /> Share
          </span>
        </button>
      )}
    </div>
  );
}
