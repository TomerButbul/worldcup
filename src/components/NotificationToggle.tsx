"use client";

import { useEffect, useState } from "react";

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "idle" | "working" | "granted" | "denied" | "ios-install" | "unsupported";

export default function NotificationToggle() {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    let next: State;
    if (!supported) {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      next = isIOS && !standalone ? "ios-install" : "unsupported";
    } else if (Notification.permission === "granted") {
      next = "granted";
    } else if (Notification.permission === "denied") {
      next = "denied";
    } else {
      next = "idle";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client capability detection
    setState(next);
  }, []);

  async function enable() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "idle");
        return;
      }
      const { key } = await fetch("/api/push/key").then((r) => r.json());
      if (!key) {
        setState("idle");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? "granted" : "idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className="glass flex items-center justify-between gap-3 rounded-2xl p-4">
      <div className="min-w-0">
        <p className="font-semibold text-chalk">🔔 Match &amp; lock reminders</p>
        <p className="text-xs text-chalk-dim">
          {state === "granted"
            ? "You're set — we'll ping you before kickoffs and before picks lock."
            : state === "denied"
              ? "Blocked. Turn on notifications for this site in your browser settings."
              : state === "ios-install"
                ? "On iPhone: tap Share → Add to Home Screen, then open it from there to turn on alerts."
                : "Get pinged before your picks lock and before each match kicks off."}
        </p>
      </div>
      {(state === "idle" || state === "working") && (
        <button
          onClick={enable}
          disabled={state === "working"}
          className="shrink-0 rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
        >
          {state === "working" ? "Enabling…" : "Enable"}
        </button>
      )}
      {state === "granted" && <span className="shrink-0 text-sm font-semibold text-grass">✓ On</span>}
    </div>
  );
}
