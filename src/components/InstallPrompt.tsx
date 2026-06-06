"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Device = "ios" | "android" | "desktop";

// Chrome/Android fire this before showing their own install UI; capturing it
// lets us trigger a REAL native install from our own button (one tap, no
// instructions). iOS has no such API — Apple only allows the user to do it via
// Share ▸ Add to Home Screen — so there we show a pinned, pointing coach instead.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function ShareGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5v10" />
      <path d="M8.5 7 12 3.5 15.5 7" />
      <path d="M7 10.5H6A2 2 0 0 0 4 12.5v6A2 2 0 0 0 6 20.5h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}
function PlusGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

// iOS install coach — pinned to the bottom so it stays put while you reach for
// Safari's Share button, with the two exact taps spelled out using the real
// glyphs. This is the closest iOS allows to "the site installs itself".
export function IosInstallCoach({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
      <div className="glass-strong relative w-full max-w-sm rounded-2xl p-4 shadow-2xl ring-1 ring-gold/40">
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-2.5 top-2 text-xl leading-none text-chalk-dim transition hover:text-chalk"
        >
          ×
        </button>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={42} height={42} className="shrink-0 rounded-xl" />
          <div className="min-w-0 pr-4">
            <p className="font-display text-lg leading-tight text-gradient-gold">Get the app — free</p>
            <p className="text-xs text-chalk-dim">Just 2 taps · no App Store needed</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-2.5 text-sm text-chalk">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 font-display text-xs text-gold">1</span>
          <span className="flex flex-wrap items-center gap-1.5">
            Tap
            <span className="inline-flex items-center gap-1 rounded-md bg-night/10 px-1.5 py-0.5 font-semibold text-night">
              <ShareGlyph /> Share
            </span>
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 font-display text-xs text-gold">2</span>
          <span className="flex flex-wrap items-center gap-1.5">
            Choose
            <span className="inline-flex items-center gap-1 rounded-md bg-night/10 px-1.5 py-0.5 font-semibold text-night">
              <PlusGlyph /> Add to Home Screen
            </span>
          </span>
        </div>

        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-chalk-dim">
          The Share button is in Safari&apos;s bar — the
          <span className="text-gold"><ShareGlyph /></span>
          box, usually below <span className="text-gold">↓</span>
        </p>
      </div>
    </div>
  );
}

// Pre-signup install nudge for the landing page. Android/desktop get a real
// one-tap install button; iOS gets the pinned coach. Hidden once installed or
// dismissed.
export default function InstallPrompt() {
  const [device, setDevice] = useState<Device>("desktop");
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem("wc_install_dismissed") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client capability detection
    setDevice(isIOS ? "ios" : isAndroid ? "android" : "desktop");
    if (standalone || dismissed) return; // already installed or dismissed → stay hidden
    setShow(true);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem("wc_install_dismissed", "1");
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // ignore
    }
    setDeferred(null);
    dismiss();
  }

  // iOS: pinned, pointing coach (Apple allows no programmatic install).
  if (device === "ios") return <IosInstallCoach onDismiss={dismiss} />;

  // Android / desktop: inline card with a real one-tap install where supported.
  return (
    <div className="glass-strong relative w-full max-w-md rounded-2xl p-4 text-left">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2.5 top-2 text-lg leading-none text-chalk-dim transition hover:text-chalk"
      >
        ×
      </button>
      <p className="pr-5 font-semibold text-chalk">📲 Get the app</p>
      <p className="mt-1 text-xs text-chalk-dim">
        Add World Cup to your home screen — it opens full-screen like a real app, sends pick &amp;
        kickoff reminders, and is far nicer to share than a link.
      </p>
      <div className="mt-2.5">
        {deferred ? (
          <button
            onClick={install}
            className="rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-night transition hover:brightness-110"
          >
            Install app
          </button>
        ) : (
          <span className="text-xs font-semibold text-gold">
            {device === "android"
              ? "Open the ⋮ menu, then “Install app.”"
              : "Click the install icon in your browser’s address bar."}
          </span>
        )}
      </div>
      <Link
        href="/install"
        className="mt-2 inline-block text-xs font-semibold text-gold underline-offset-2 hover:underline"
      >
        Show me how — with pictures →
      </Link>
    </div>
  );
}
