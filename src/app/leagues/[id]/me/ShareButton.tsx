"use client";

import { useState } from "react";
import { ShareIcon, LinkIcon } from "@/components/icons";

// Share an INVITE link (the dashboard), never the predictions URL — a teammate
// must not be able to open someone's picks before the bracket locks.
export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url =
      (typeof window !== "undefined" ? window.location.origin : "") + "/dashboard";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "My World Cup league", url });
      } catch {
        // user dismissed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className="shrink-0 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-night transition hover:opacity-90"
    >
      {copied ? (
        <span className="inline-flex items-center gap-1.5"><LinkIcon size={13} />Copied!</span>
      ) : (
        <span className="inline-flex items-center gap-1.5"><ShareIcon size={13} />Share</span>
      )}
    </button>
  );
}
