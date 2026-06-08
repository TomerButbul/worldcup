"use client";

import { useEffect, useState, type ReactNode } from "react";

// Visual, low-reading install guide. Each step shows a little mock of the actual
// screen with the EXACT button to press highlighted (gold ring + pulse), plus a
// short bold label. Auto-picks the visitor's platform but lets anyone switch.
// iOS mirrors the modern flow (••• → Share → Add to Home Screen → Add); icons
// are drawn to match the real iOS/Android glyphs.

type Platform = "ios" | "android" | "desktop";

const STYLE = `
@keyframes ig-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(246, 196, 83, 0.55); }
  50%      { box-shadow: 0 0 0 7px rgba(246, 196, 83, 0); }
}
.ig-target {
  border-radius: 12px;
  outline: 2.5px solid #f6c453;
  outline-offset: 1px;
  animation: ig-pulse 1.8s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) { .ig-target { animation: none; } }
`;

/* ── exact-button glyphs (currentColor) ───────────────────────────── */
function ShareIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v9.5" />
      <path d="M8.5 7.5 12 4l3.5 3.5" />
      <path d="M7.5 10.5h-1A1.9 1.9 0 0 0 4.6 12.4v6.2A1.9 1.9 0 0 0 6.5 20.5h11a1.9 1.9 0 0 0 1.9-1.9v-6.2a1.9 1.9 0 0 0-1.9-1.9h-1" />
    </svg>
  );
}
function MoreIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}
function BookmarkIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />
    </svg>
  );
}
function BookIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 6c-1.6-1.2-3.7-2-6-2v13c2.3 0 4.4.8 6 2 1.6-1.2 3.7-2 6-2V4c-2.3 0-4.4.8-6 2z" />
      <path d="M12 6v13" />
    </svg>
  );
}
function PlusSquareIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function DotsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}
function DownloadIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v11" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

/* ── mock-screen tiles (the "screenshot") ─────────────────────────── */
const tileBox = "rounded-xl border border-night/10 bg-white p-2.5 shadow-sm";
const barIcon = "flex h-8 w-8 items-center justify-center rounded-lg text-chalk-dim";

// iOS: the modern compact Safari bottom bar — Share lives behind the ••• button.
function IosCompactBar() {
  return (
    <div className={`${tileBox} flex items-center gap-1.5`}>
      <span className={barIcon}>‹</span>
      <span className="flex h-7 items-center rounded-md px-1 text-xs font-semibold text-chalk-dim">aA</span>
      <span className="flex-1 truncate rounded-full bg-night/5 px-3 py-1.5 text-center text-[11px] text-chalk-dim">
        worldcup…vercel.app
      </span>
      <span className={`${barIcon} ig-target bg-gold/10 text-night`}>
        <MoreIcon />
      </span>
    </div>
  );
}
// iOS: the menu that ••• opens — Share is the first row.
function IosShareMenu() {
  return (
    <div className={`${tileBox} space-y-1`}>
      <div className="ig-target flex items-center justify-between bg-gold/10 px-2.5 py-2 text-night">
        <span className="text-sm font-semibold">Share</span>
        <ShareIcon size={20} />
      </div>
      <div className="flex items-center justify-between px-2.5 py-2 text-chalk-dim">
        <span className="text-sm">Add to Bookmarks</span>
        <BookmarkIcon size={20} />
      </div>
      <div className="flex items-center justify-between px-2.5 py-2 text-chalk-dim">
        <span className="text-sm">Add Bookmark to…</span>
        <BookIcon size={20} />
      </div>
    </div>
  );
}
// iOS: the Share sheet's lower list — "Add to Home Screen".
function IosSheetRows() {
  return (
    <div className={`${tileBox} space-y-1`}>
      <div className="flex items-center justify-between px-2.5 py-2 text-chalk-dim">
        <span className="text-sm">Add Bookmark</span>
        <BookmarkIcon size={20} />
      </div>
      <div className="ig-target flex items-center justify-between bg-gold/10 px-2.5 py-2 text-night">
        <span className="text-sm font-semibold">Add to Home Screen</span>
        <PlusSquareIcon size={20} />
      </div>
    </div>
  );
}
function IosAddBar() {
  return (
    <div className={`${tileBox} flex items-center justify-between`}>
      <span className="text-sm text-chalk-dim">Cancel</span>
      <span className="text-sm font-semibold text-chalk">Add to Home Screen</span>
      <span className="ig-target rounded-lg bg-gold px-3 py-1 text-sm font-bold text-night">Add</span>
    </div>
  );
}
function AndroidTopBar() {
  return (
    <div className={`${tileBox} flex items-center gap-2`}>
      <span className="flex-1 truncate rounded-full bg-night/5 px-3 py-1.5 text-xs text-chalk-dim">worldcup-liart.vercel.app</span>
      <span className={`${barIcon} ig-target bg-gold/10 text-night`}>
        <DotsIcon />
      </span>
    </div>
  );
}
function AndroidMenu() {
  return (
    <div className={`${tileBox} space-y-1.5`}>
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-chalk-dim">
        <span className="text-base">↻</span>
        <span className="text-sm">Refresh</span>
      </div>
      <div className="ig-target flex items-center gap-2 bg-gold/10 px-2 py-1.5 text-night">
        <DownloadIcon size={20} />
        <span className="text-sm font-semibold">Install app</span>
      </div>
    </div>
  );
}
function AndroidDialog() {
  return (
    <div className={`${tileBox}`}>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={28} height={28} className="rounded-md" />
        <span className="text-sm font-semibold text-chalk">Install World Cup?</span>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="text-sm text-chalk-dim">Cancel</span>
        <span className="ig-target rounded-lg bg-gold px-3 py-1 text-sm font-bold text-night">Install</span>
      </div>
    </div>
  );
}
function DesktopBar() {
  return (
    <div className={`${tileBox} flex items-center gap-2`}>
      <span className="text-chalk-dim">⟳</span>
      <span className="flex-1 truncate rounded-full bg-night/5 px-3 py-1.5 text-xs text-chalk-dim">worldcup-liart.vercel.app</span>
      <span className={`${barIcon} ig-target bg-gold/10 text-night`}>
        <DownloadIcon size={20} />
      </span>
    </div>
  );
}

type Step = { title: string; sub?: string; tile: ReactNode };

const STEPS: Record<Platform, Step[]> = {
  ios: [
    { title: "Tap the ••• button", sub: "Bottom-right of Safari. (See a Share ⬆ box instead? Tap that and skip to step 3.)", tile: <IosCompactBar /> },
    { title: "Tap “Share”", sub: "The box-with-an-arrow — opens the share sheet.", tile: <IosShareMenu /> },
    { title: "Tap “Add to Home Screen”", sub: "Scroll down the sheet if you don't see it.", tile: <IosSheetRows /> },
    { title: "Tap “Add”", sub: "Top-right corner. Done!", tile: <IosAddBar /> },
  ],
  android: [
    { title: "Tap the ⋮ menu", sub: "Three dots, top-right in Chrome.", tile: <AndroidTopBar /> },
    { title: "Tap “Install app”", sub: "Or “Add to Home screen”.", tile: <AndroidMenu /> },
    { title: "Tap “Install”", sub: "Confirm. Done!", tile: <AndroidDialog /> },
  ],
  desktop: [
    { title: "Click the Install icon", sub: "On the right of the address bar.", tile: <DesktopBar /> },
    { title: "Click “Install”", sub: "No icon? Open the ⋮ menu → “Install TopCorner.”", tile: <AndroidDialog /> },
  ],
};

const TABS: { key: Platform; label: string }[] = [
  { key: "ios", label: "iPhone / iPad" },
  { key: "android", label: "Android" },
  { key: "desktop", label: "Computer" },
];

export default function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("ios");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const detected: Platform = /iphone|ipad|ipod/i.test(ua)
      ? "ios"
      : /android/i.test(ua)
        ? "android"
        : "desktop";
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client detection
    setPlatform(detected);
    setInstalled(standalone);
  }, []);

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />

      {installed && (
        <div className="glass rounded-2xl p-3 text-center text-sm font-semibold text-grass">
          ✓ You&apos;re already running the installed app — you&apos;re all set!
        </div>
      )}

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setPlatform(t.key)}
            className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
              platform === t.key ? "bg-gold text-night" : "glass text-chalk-dim hover:text-chalk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ol className="space-y-3">
        {STEPS[platform].map((step, i) => (
          <li key={i} className="glass-strong flex items-start gap-3 rounded-2xl p-3 sm:p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-sm text-gold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-chalk">{step.title}</p>
              {step.sub && <p className="mb-2 text-xs text-chalk-dim">{step.sub}</p>}
              {step.tile}
            </div>
          </li>
        ))}
      </ol>

      <p className="text-center text-xs text-chalk-dim">
        The app opens full-screen, sends pick &amp; kickoff reminders, and is one tap from your home
        screen.
      </p>
    </div>
  );
}
