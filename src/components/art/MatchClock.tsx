// Digital match clock — the pitch-side / referee stopwatch look used to time a
// soccer game, replacing the generic hourglass on countdowns. Same art language
// as Trophy.tsx / Ball.tsx: viewBox 0 0 100 100, night (#0c1430) edge stroke,
// gold body, with a dark digital readout window. Reads from ~13px up.
//
// Gold by default, but currentColor-friendly: pass fill="currentColor" to tint.

const NIGHT = "#0c1430";

export default function MatchClock({
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
      aria-label="Match clock"
    >
      <g stroke={NIGHT} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
        {/* top start/stop button */}
        <rect x="41" y="3" width="18" height="13" rx="4" fill={fill} />
        {/* stopwatch body */}
        <circle cx="50" cy="59" r="37" fill={fill} />
      </g>
      {/* digital readout window */}
      <rect x="26" y="49" width="48" height="22" rx="4" fill={NIGHT} />
      {/* digits + colon, bold enough to survive downscaling */}
      <g fill={fill}>
        <rect x="33" y="53" width="4" height="14" rx="2" />
        <rect x="39.5" y="53" width="4" height="14" rx="2" />
        <circle cx="50" cy="56.5" r="2.1" />
        <circle cx="50" cy="63.5" r="2.1" />
        <rect x="56.5" y="53" width="4" height="14" rx="2" />
        <rect x="63" y="53" width="4" height="14" rx="2" />
      </g>
      {/* subtle polish highlight */}
      <ellipse cx="35" cy="44" rx="8" ry="5" fill="#ffffff" opacity="0.22" transform="rotate(-26 35 44)" />
    </svg>
  );
}
