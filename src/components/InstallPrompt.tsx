"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Device = "ios" | "android" | "desktop";

// Chrome/Android fire this before showing their own install UI; capturing it
// lets us trigger a real native install from our own button. iOS has no such
// API, so there we show the Share ▸ Add to Home Screen instructions instead.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Public, pre-signup install nudge for the landing page. The whole point of the
// app being a PWA is that it's nicer to share/use than the bare URL — so make
// installing it one tap. Hidden once installed (standalone) or dismissed.
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
        {device === "ios" ? (
          <span className="text-xs font-semibold text-gold">
            Tap Share ⬆︎ at the bottom, then “Add to Home Screen.”
          </span>
        ) : deferred ? (
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
