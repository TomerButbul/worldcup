// Referee's whistle — the soccer signal for half-time and stoppages. Inline SVG
// so it inherits the surrounding text color (currentColor). Square (1:1); size +
// className mirror the other art icons (Ball, Trophy).
export default function Whistle({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
    >
      {/* air tube / mouthpiece */}
      <rect x="1.4" y="9.7" width="9" height="3.1" rx="1.5" />
      {/* round body */}
      <circle cx="14" cy="13.6" r="5.9" />
      {/* sound hole on top of the body */}
      <rect x="12.5" y="5.7" width="3" height="3.6" rx="1.5" />
      {/* lanyard loop */}
      <path
        d="M16.3 6.7h1.9a1.4 1.4 0 1 1 0 2.8H17.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* pea hole — punched through with the page/pill colour via low-opacity white */}
      <circle cx="14" cy="13.6" r="1.7" fill="#ffffff" fillOpacity="0.55" />
    </svg>
  );
}
