"use client";

import { useState } from "react";
import { playPop } from "@/lib/sound";

// Two one-tap share affordances for a league: copy the full invite LINK
// (/join/<code>, which auto-joins after sign-up/login) and copy the raw join
// CODE for the dashboard form. Each button flips to a ✓ confirmation briefly.
export default function ShareInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const inviteLink = () =>
    typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : `/join/${code}`;

  async function copy(what: "link" | "code") {
    const text = what === "link" ? inviteLink() : code;
    try {
      await navigator.clipboard.writeText(text);
      playPop();
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
    } catch {
      // Clipboard blocked (insecure context / denied) — silently no-op.
    }
  }

  async function share() {
    // Best-effort native share sheet; falls back to copy when unavailable.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join my World Cup league",
          text: "Join my World Cup prediction league:",
          url: inviteLink(),
        });
        return;
      } catch {
        // User dismissed or share failed — fall through to copy.
      }
    }
    void copy("link");
  }

  const base =
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50";

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => (canShare ? share() : copy("link"))}
        className={`${base} text-night shine hover:brightness-105`}
        aria-label="Copy invite link"
      >
        {copied === "link" ? "✓ Copied!" : "🔗 Copy invite link"}
      </button>
      <button
        type="button"
        onClick={() => copy("code")}
        className={`${base} glass text-chalk hover:bg-night/5`}
        aria-label="Copy join code"
      >
        {copied === "code" ? "✓ Copied!" : "Copy code"}
      </button>
    </div>
  );
}
