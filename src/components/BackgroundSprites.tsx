// Flat line-art sprites for the animated background — same language as
// SoccerBall.tsx: white/accent fills, night (#0c1430) strokes, viewBox 0 0 100 100.

const NIGHT = "#0c1430";

type SpriteProps = { size?: number; className?: string };

export function Trophy({ size = 38, className = "" }: SpriteProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`inline-block shrink-0 ${className}`} aria-hidden>
      <g stroke={NIGHT} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {/* handles */}
        <path d="M30 26 Q14 26 14 38 Q14 50 30 48" fill="none" />
        <path d="M70 26 Q86 26 86 38 Q86 50 70 48" fill="none" />
        {/* cup bowl */}
        <path d="M28 20 H72 V40 Q72 60 50 60 Q28 60 28 40 Z" fill="#e0a400" />
        {/* stem + base */}
        <rect x="45" y="60" width="10" height="12" fill="#e0a400" />
        <path d="M34 72 H66 L61 82 H39 Z" fill="#e0a400" />
        <rect x="32" y="82" width="36" height="7" rx="2" fill="#e0a400" />
      </g>
    </svg>
  );
}

export function PlayerKick({ size = 40, className = "", color = "#2563eb" }: SpriteProps & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`inline-block shrink-0 ${className}`} aria-hidden>
      <g stroke={NIGHT} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {/* head */}
        <circle cx="48" cy="22" r="11" fill="#ffffff" />
        {/* jersey torso */}
        <path d="M32 42 Q48 36 64 42 L60 68 H38 Z" fill={color} />
        {/* arms */}
        <line x1="33" y1="44" x2="22" y2="60" />
        <line x1="63" y1="44" x2="74" y2="58" />
        {/* legs (one planted, one kicking) */}
        <line x1="43" y1="68" x2="40" y2="88" />
        <line x1="55" y1="68" x2="68" y2="80" />
        {/* ball at the kicking foot */}
        <circle cx="76" cy="84" r="8" fill="#ffffff" />
        <path d="M76 78 L81 82 L79 88 H73 L71 82 Z" fill={NIGHT} stroke="none" />
      </g>
    </svg>
  );
}

export function Pennant({ size = 36, className = "", color = "#10b981" }: SpriteProps & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`inline-block shrink-0 ${className}`} aria-hidden>
      <g stroke={NIGHT} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {/* pole */}
        <line x1="28" y1="12" x2="28" y2="92" />
        <circle cx="28" cy="12" r="4" fill="#e0a400" />
        {/* waving flag */}
        <path d="M28 18 Q48 10 68 18 Q88 26 84 44 L28 44 Z" fill={color} />
        {/* a single chalk stripe for that 'kit' feel */}
        <path d="M54 14 Q58 30 54 44" fill="none" stroke="#ffffff" strokeWidth={3} />
      </g>
    </svg>
  );
}
