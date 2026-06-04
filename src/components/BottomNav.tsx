"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { JSX } from "react";

// ---------------------------------------------------------------------------
// A persistent, thumb-reachable bottom tab bar — the app's primary navigation.
// Two flavours share one <Bar>: GlobalNav (top-level app pages) and LeagueNav
// (inside a league; tabs differ for prediction vs draft leagues). Both are fixed
// to the bottom; GlobalNav hides itself on league routes so only one shows.
// ---------------------------------------------------------------------------

type Tab = { href: string; label: string; icon: IconName; active: boolean };

function Bar({ tabs }: { tabs: Tab[] }): JSX.Element {
  return (
    <>
      {/* Mobile: thumb-reachable bottom tab bar (hidden on desktop). */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-night/10 bg-white/90 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto flex max-w-2xl items-stretch">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition ${
                t.active ? "text-gold" : "text-chalk-dim hover:text-chalk"
              }`}
            >
              <NavIcon name={t.icon} />
              <span className="leading-none">{t.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop: horizontal top nav bar (sits just below the flag garland). */}
      <nav className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+2.25rem)] z-20 hidden border-b border-night/10 bg-white/85 backdrop-blur lg:block">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-6">
          <Link
            href="/dashboard"
            className="mr-2 flex items-center gap-2 font-display text-lg text-gradient-gold"
          >
            <NavIcon name="ball" size={20} /> World Cup
          </Link>
          <div className="flex flex-1 items-center justify-end gap-1">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.active ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  t.active ? "bg-gold/10 text-gold" : "text-chalk-dim hover:bg-night/5 hover:text-chalk"
                }`}
              >
                <NavIcon name={t.icon} size={18} /> {t.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}

// --- Global (top-level) nav ------------------------------------------------
const GLOBAL_HIDE = ["/leagues/", "/login", "/signup", "/forgot-password", "/reset-password", "/preview"];

export function GlobalNav(): JSX.Element | null {
  const pathname = usePathname();
  if (!pathname || pathname === "/" || GLOBAL_HIDE.some((p) => pathname.startsWith(p))) return null;
  const tabs: Tab[] = [
    { href: "/dashboard", label: "Home", icon: "home", active: pathname.startsWith("/dashboard") },
    { href: "/rankings", label: "Rankings", icon: "globe", active: pathname.startsWith("/rankings") },
    { href: "/how-it-works", label: "How to", icon: "help", active: pathname.startsWith("/how-it-works") },
  ];
  return <Bar tabs={tabs} />;
}

// --- League nav (prediction vs draft) --------------------------------------
export function LeagueNav({ leagueId, kind }: { leagueId: string; kind: string }): JSX.Element {
  const pathname = usePathname();
  const search = useSearchParams();
  const base = `/leagues/${leagueId}`;

  if (kind === "draft") {
    const tab = search.get("tab") ?? "board";
    const tabs: Tab[] = [
      { href: `${base}?tab=board`, label: "Board", icon: "trophy", active: tab === "board" },
      { href: `${base}?tab=groups`, label: "Groups", icon: "grid", active: tab === "groups" },
      { href: `${base}?tab=bracket`, label: "Bracket", icon: "bracket", active: tab === "bracket" },
      { href: `${base}?tab=fixtures`, label: "Fixtures", icon: "calendar", active: tab === "fixtures" },
    ];
    return <Bar tabs={tabs} />;
  }

  // Prediction league — real sub-routes. "My Picks" (/me) folds into Table.
  const tabs: Tab[] = [
    {
      href: base,
      label: "Table",
      icon: "trophy",
      active: pathname === base || pathname.startsWith(`${base}/players`) || pathname.startsWith(`${base}/me`),
    },
    {
      href: `${base}/bracket`,
      label: "Bracket",
      icon: "bracket",
      active: pathname.startsWith(`${base}/bracket`) || pathname.startsWith(`${base}/awards`),
    },
    { href: `${base}/predict`, label: "Predict", icon: "target", active: pathname.startsWith(`${base}/predict`) },
    { href: `${base}/matches`, label: "Matches", icon: "ball", active: pathname.startsWith(`${base}/matches`) },
  ];
  return <Bar tabs={tabs} />;
}

// --- Icons (inline SVG, currentColor — no emoji) ----------------------------
type IconName = "home" | "globe" | "help" | "trophy" | "bracket" | "ball" | "target" | "grid" | "calendar";

function NavIcon({ name, size = 22 }: { name: IconName; size?: number }): JSX.Element {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "home":
      return (
        <svg {...p}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case "globe":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" />
        </svg>
      );
    case "help":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.1.9-1.1 1.7" />
          <circle cx="12" cy="16.5" r=".7" fill="currentColor" stroke="none" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...p}>
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 20h6M12 13v4" />
        </svg>
      );
    case "bracket":
      return (
        <svg {...p}>
          <path d="M4 5h4v6h4M4 19h4v-6" />
          <path d="M20 12h-4M16 8v8" />
        </svg>
      );
    case "ball":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="m12 7 3.5 2.6-1.3 4.2h-4.4L8.5 9.6z" />
        </svg>
      );
    case "target":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "grid":
      return (
        <svg {...p}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...p}>
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M4 9h16M8 3v4M16 3v4" />
        </svg>
      );
  }
}
