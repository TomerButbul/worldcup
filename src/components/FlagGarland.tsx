// Decorative top bunting: triangular pennants of the teams playing the upcoming
// matchday, hanging from a gently DROOPING string (not a dead-straight line) set
// a little below the top edge. Small, well-separated, static (no scroll/fade),
// each pennant swaying softly. Cosmetic only (aria-hidden). Server component —
// the flag set is passed in from the layout (cached).

const STYLE = `
@keyframes fg-sway {
  0%, 100% { transform: rotate(-2.6deg); }
  50%      { transform: rotate(2.6deg); }
}
.fg-pennant {
  transform-origin: top center;
  animation: fg-sway 2.9s ease-in-out infinite;
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .fg-pennant { animation: none; transform: none; }
}
`;

const H = 32; // strip height
const STRING_Y = 8; // string sits ~3/4 up the strip, not flush at the very top
const DROOP = 4; // how far the string sags in the middle
const PW = 19; // pennant width
const PH = 15; // pennant height
const STRING_COLOR = "rgba(12, 20, 48, 0.32)";

function frac(n: number) {
  return n - Math.floor(n);
}

export default function FlagGarland({ flags }: { flags: { id: number; name: string }[] }) {
  if (!flags.length) return <div aria-hidden style={{ height: H }} />;
  const n = flags.length;
  const c = (n - 1) / 2;
  return (
    <div aria-hidden className="relative w-full overflow-hidden" style={{ height: H }}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      {/* the drooping string */}
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
        <path
          d={`M 0 ${STRING_Y} Q 50 ${STRING_Y + 2 * DROOP} 100 ${STRING_Y}`}
          fill="none"
          stroke={STRING_COLOR}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* triangle pennants hung along the sag */}
      <div className="absolute inset-x-0 flex items-start justify-around px-2" style={{ top: STRING_Y }}>
        {flags.map((f, i) => {
          const dy = c > 0 ? DROOP * (1 - ((i - c) / c) ** 2) : 0; // follow the sag
          return (
            <div key={f.id} style={{ transform: `translateY(${dy.toFixed(2)}px)` }}>
              <div
                className="fg-pennant"
                title={f.name}
                style={{
                  width: PW,
                  height: PH,
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  backgroundImage: `url(https://media.api-sports.io/football/teams/${f.id}.png)`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                  filter: "drop-shadow(0 1px 1px rgba(12, 20, 48, 0.35))",
                  animationDelay: `${(-frac(i * 0.41) * 2.9).toFixed(2)}s`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
