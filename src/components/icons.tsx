// Cohesive single-colour icon set, football-themed where it has a natural
// metaphor and clean line-icons where it doesn't. Replaces the grab-bag of
// mismatched emoji (🎯 dart, ⚡ lightning, 👑 crown, 📋 clipboard, 🥇 medal,
// 🔗 link, ✏️ pencil…) across the app.
//
// All icons: viewBox 0 0 24 24, stroke="currentColor" — so they inherit the
// parent's text colour (wrap in text-gold / text-grass / text-chalk to tint,
// and they pick up active-state colour changes for free). Decorative by default
// (aria-hidden), since they sit next to text labels.

import type { SVGProps } from "react";

type IconProps = { size?: number; className?: string };

function Svg({
  size = 16,
  className = "",
  children,
  ...rest
}: IconProps & { children: React.ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

// ── The three score types ────────────────────────────────────────────────
// Upfront = your locked pre-tournament picks (a coach's clipboard).
export const Upfront = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="2.5" width="8" height="4" rx="1.2" />
    <path d="M16 4.5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2" />
    <path d="M9 13.2l2 2 4-4.2" />
  </Svg>
);

// Live = a match in play (referee's whistle).
export const Live = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10h8.6a5.5 5.5 0 1 1-4.9 3H3a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1Z" />
    <path d="M6 10V7.4" />
    <circle cx="13.4" cy="14.6" r="1.35" />
  </Svg>
);

// Total = the overall standing (the trophy).
export const Trophy = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4.6a2.4 2.4 0 0 0 0 4.8H7.4M17 6h2.4a2.4 2.4 0 0 1 0 4.8H16.6" />
    <path d="M12 14v3.2" />
    <path d="M9 21h6" />
    <path d="M9.4 21a2.8 2.8 0 0 1 5.2 0" />
  </Svg>
);

// ── Awards & player honours ──────────────────────────────────────────────
// Awards group (medal on a ribbon).
export const Medal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3l3 6M16 3l-3 6" />
    <circle cx="12" cy="15" r="5.2" />
    <path d="M12 12.6l.8 1.6 1.8.26-1.3 1.25.3 1.78L12 16.66l-1.6.83.3-1.78-1.3-1.25 1.8-.26.8-1.6Z" />
  </Svg>
);

// Golden Boot / top scorer.
export const Boot = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h3.4a1 1 0 0 1 1 1v3.1l8.3 3.1A3 3 0 0 1 19.6 17v1.4a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6Z" />
    <path d="M4.5 16.5h13.8" />
  </Svg>
);

// Golden Glove / goalkeeper.
export const Glove = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 11V6a1.5 1.5 0 0 1 3 0M10 10.2V4.6a1.5 1.5 0 0 1 3 0v5.6M13 10.4V6.2a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6h-.8a5 5 0 0 1-5-5v-1.4A2.6 2.6 0 0 1 7 11" />
  </Svg>
);

// Young Player / favourite (star).
export const Star = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2l2.6 5.27 5.8.85-4.2 4.1.99 5.78L12 16.55 6.81 19.2l.99-5.78-4.2-4.1 5.8-.85L12 3.2Z" />
  </Svg>
);

// Goal / penalty shootout (goal frame + net).
export const Net = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="1" />
    <path d="M7.5 6v12M12 6v12M16.5 6v12M3 10h18M3 14h18" strokeWidth={1.3} />
  </Svg>
);

// ── Utility / chrome ─────────────────────────────────────────────────────
export const Bell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.8 2H4.2L6 16Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Svg>
);

export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 14.5l5-5" />
    <path d="M11.5 6.2l1.1-1.1a4 4 0 0 1 5.7 5.7l-2.3 2.3" />
    <path d="M12.5 17.8l-1.1 1.1a4 4 0 0 1-5.7-5.7l2.3-2.3" />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="18" cy="5.5" r="2.6" />
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="18.5" r="2.6" />
    <path d="M8.4 10.7l7.2-4.1M8.4 13.3l7.2 4.1" />
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L18.2 9.8a2.7 2.7 0 0 0-3.8-3.8L4 16v4Z" />
    <path d="M13.6 6.8l3.6 3.6" />
  </Svg>
);

// ── Navigation / board switcher ──────────────────────────────────────────
// Global (worldwide board) — globe with equator + meridian.
export const Globe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.45 3.8 5.6 3.8 9s-1.3 6.55-3.8 9c-2.5-2.45-3.8-5.6-3.8-9S9.5 5.45 12 3Z" />
  </Svg>
);

// Create / add a new league.
export const Plus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

// Opens in its own room (draft leagues link out to their draft board).
export const ArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </Svg>
);
