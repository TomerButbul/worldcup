// Stylised World Cup trophy — the iconic "two figures spiralling up to hold a
// globe" silhouette, simplified to read cleanly from 16px to 96px.
// Same art language as SoccerBall.tsx / BackgroundSprites.tsx: viewBox 0 0 100 100,
// night (#0c1430) edge stroke, gold fill by default.
//
// Gold by default, but currentColor-friendly: pass fill="currentColor" to tint it.

const NIGHT = "#0c1430";

export default function Trophy({
  size = 24,
  className = "",
  fill = "#e0a400",
}: {
  size?: number;
  className?: string;
  /** Body colour. Defaults to brand gold; pass "currentColor" to inherit. */
  fill?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label="Trophy"
    >
      <g stroke={NIGHT} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {/* globe crowning the trophy */}
        <circle cx="50" cy="26" r="17" fill={fill} />

        {/* twisting flanks — two figures sweeping up from the base to the globe */}
        <path
          d="M40 40 C32 52 32 66 44 74 L36 82 C22 72 22 50 32 34 Z"
          fill={fill}
        />
        <path
          d="M60 40 C68 52 68 66 56 74 L64 82 C78 72 78 50 68 34 Z"
          fill={fill}
        />

        {/* central column linking the flanks under the globe */}
        <path d="M44 38 H56 V66 Q50 76 44 66 Z" fill={fill} />

        {/* plinth */}
        <path d="M34 82 H66 L62 90 H38 Z" fill={fill} />
        <rect x="30" y="90" width="40" height="7" rx="2.5" fill={fill} />
      </g>

      {/* subtle highlight for a polished-metal feel (skipped when tinted) */}
      <path
        d="M47 11 C41 26 41 66 45 82 L51 82 C47 66 47 26 53 11 Z"
        fill="#ffffff"
        opacity="0.22"
      />
    </svg>
  );
}
