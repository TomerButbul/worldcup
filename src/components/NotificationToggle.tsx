"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "@/components/icons";

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "idle" | "working" | "granted" | "denied" | "ios-install" | "unsupported";
type Device = "ios" | "android" | "desktop";

const INSTALL_LINE: Record<Device, string> = {
  ios: "iPhone: tap Share ▸ Add to Home Screen, then open it from your home screen.",
  android: "Android: open the ⋮ menu ▸ Install app (or Add to Home screen).",
  desktop: "Desktop: click the install icon in your browser's address bar.",
};

// `top` placement = the prominent install-first card, shown until reminders are
// on. `bottom` placement = a compact "on · turn off" row, shown only once on.
// So a new user gets a big nudge up top; once set up it tucks to the bottom.
export default function NotificationToggle({ placement = "top" }: { placement?: "top" | "bottom" }) {
  const [state, setState] = useState<State>("idle");
  const [device, setDevice] = useState<Device>("desktop");

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    let next: State;
    if (!supported) next = isIOS && !standalone ? "ios-install" : "unsupported";
    else if (Notification.permission === "granted") next = "granted";
    else if (Notification.permission === "denied") next = "denied";
    else next = "idle";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client capability detection
    setState(next);
    setDevice(isIOS ? "ios" : isAndroid ? "android" : "desktop");
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

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } catch {
      // ignore — best effort
    }
    setState("idle");
  }

  if (state === "unsupported") return null;

  // Compact bottom row — only once reminders are on. Turning off keeps the app.
  if (placement === "bottom") {
    if (state !== "granted") return null;
    return (
      <div className="glass flex items-center justify-between gap-3 rounded-2xl p-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-chalk-dim"><Bell size={13} /> Match &amp; lock reminders are on.</span>
        <button
          onClick={disable}
          className="text-xs text-chalk-dim underline underline-offset-2 hover:text-chalk"
        >
          Turn off
        </button>
      </div>
    );
  }

  // Prominent top card — hidden once on (the bottom row takes over). The headline
  // is installing the app; reminders are framed as the bonus.
  if (state === "granted") return null;
  return (
    <div className="glass rounded-2xl p-4">
      <p className="font-semibold text-chalk">📲 Install the World Cup app</p>
      <p className="mt-1 text-xs text-chalk-dim">
        Add it to your home screen — it opens full-screen like a real app, and you can switch on
        reminders so you never miss a pick. {INSTALL_LINE[device]}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {state === "ios-install" ? (
          <span className="text-xs font-semibold text-gold">
            Add to Home Screen first, then reopen from the icon to turn on reminders.
          </span>
        ) : (
          <>
            <button
              onClick={enable}
              disabled={state === "working"}
              className="rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
            >
              {state === "working" ? "Enabling…" : <span className="inline-flex items-center gap-1.5"><Bell size={14} /> Turn on reminders</span>}
            </button>
            {state === "denied" && (
              <span className="text-xs text-red-600">
                Blocked — enable notifications for this site in your browser settings.
              </span>
            )}
          </>
        )}
      </div>
      <Link
        href="/install"
        className="mt-2 inline-block text-xs font-semibold text-gold underline-offset-2 hover:underline"
      >
        📖 Step-by-step install guide (with pictures) →
      </Link>
    </div>
  );
}
