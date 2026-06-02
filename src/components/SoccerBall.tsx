// Crisp inline soccer-ball SVG used as a decorative accent / spinner / bullet.
export default function SoccerBall({
  size = 20,
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
      aria-hidden
    >
      <circle cx="50" cy="50" r="46" fill="#ffffff" stroke="#0c1430" strokeWidth="3" />
      <g stroke="#0c1430" strokeWidth="4" strokeLinecap="round">
        <line x1="50" y1="35" x2="50" y2="6" />
        <line x1="63.3" y1="44.7" x2="93" y2="36" />
        <line x1="58.2" y1="60.3" x2="77" y2="86" />
        <line x1="41.8" y1="60.3" x2="23" y2="86" />
        <line x1="36.7" y1="44.7" x2="7" y2="36" />
      </g>
      <path d="M50 35 L63.3 44.7 L58.2 60.3 L41.8 60.3 L36.7 44.7 Z" fill="#0c1430" />
    </svg>
  );
}
