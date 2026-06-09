"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { LinkIcon, ShareIcon } from "@/components/icons";
import { copyText } from "@/lib/clipboard";
import { playPop } from "@/lib/sound";

// Invite share affordances for a league: copy link, native share, and a scan-to-join
// QR popup (great for showing your phone to a friend across the table). The join code
// itself lives inside the QR popup, so there's no separate "copy code" button.
export default function ShareInvite({ code, name }: { code: string; name?: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const inviteLink = () =>
    typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : `/join/${code}`;

  async function copyLink() {
    const ok = await copyText(inviteLink());
    if (!ok) return;
    playPop();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    const link = inviteLink();
    try {
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
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className={`${base} text-night bg-gradient-to-b from-gold-bright to-gold glow-gold shine hover:brightness-105`}
          aria-label="Copy invite link"
        >
          {copied ? (
            "✓ Link copied!"
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <LinkIcon size={14} /> Copy link
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowQr(true)}
          className={`${base} glass text-chalk hover:bg-night/5`}
          aria-label="Show a QR code to join"
        >
          <span className="inline-flex items-center gap-1.5" aria-hidden>
            <QrGlyph /> QR
          </span>
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

      {showQr && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-night/70 p-4 backdrop-blur-sm"
          onClick={() => setShowQr(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Scan to join"
        >
          <div
            className="glass-strong relative w-full max-w-[19rem] rounded-[28px] p-7 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQr(false)}
              aria-label="Close"
              className="absolute right-3.5 top-3.5 rounded-lg p-1 text-chalk-dim transition hover:bg-night/10 hover:text-chalk"
            >
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>

            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">Scan to join</p>
            {name && <h3 className="mt-1 truncate font-display text-2xl text-gradient-gold">{name}</h3>}

            <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
              <QRCode value={inviteLink()} size={188} fgColor="#0e1545" />
            </div>

            <p className="mt-5 text-sm text-chalk-dim">
              Point a phone camera at the code — it opens the join link.
            </p>
            <p className="mt-2 inline-block rounded-lg bg-night/[0.06] px-3 py-1 font-mono text-sm font-bold uppercase tracking-[0.3em] text-chalk">
              {code}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function QrGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden>
      <path d="M3 3h5v5H3V3zm1.5 1.5v2h2v-2h-2zM12 3h5v5h-5V3zm1.5 1.5v2h2v-2h-2zM3 12h5v5H3v-5zm1.5 1.5v2h2v-2h-2zM12 12h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2z" />
    </svg>
  );
}
