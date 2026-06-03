// Modern World Cup match-ball — clean curved interlocking panels (contemporary
// Al Rihla / Telstar look) rather than the classic black-pentagon cliché.
// Same art language as SoccerBall.tsx: viewBox 0 0 100 100, night (#0c1430)
// strokes, white panels with subtle shading. Reads cleanly from 16px to 96px.

const NIGHT = "#0c1430";

export default function Ball({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label="Soccer ball"
    >
      {/* sphere */}
      <circle cx="50" cy="50" r="46" fill="#ffffff" stroke={NIGHT} strokeWidth={3} />

      {/* soft shading for roundness */}
      <circle cx="50" cy="50" r="46" fill="url(#ballShade)" />

      <defs>
        <radialGradient id="ballShade" cx="0.38" cy="0.34" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#0c1430" stopOpacity="0.14" />
        </radialGradient>
      </defs>

      {/* three sweeping curved panel seams that wrap the ball */}
      <g fill="none" stroke={NIGHT} strokeWidth={3} strokeLinecap="round">
        <path d="M50 5 C30 28 30 72 50 95" />
        <path d="M8 38 C34 50 66 50 92 38" />
        <path d="M16 74 C38 60 62 60 84 74" />
      </g>

      {/* small gold pivot accent where panels meet — the on-brand detail */}
      <circle cx="50" cy="50" r="4.2" fill="#e0a400" stroke={NIGHT} strokeWidth={2} />

      {/* crisp specular highlight */}
      <ellipse cx="36" cy="30" rx="9" ry="6" fill="#ffffff" opacity="0.75" transform="rotate(-28 36 30)" />
    </svg>
  );
}
