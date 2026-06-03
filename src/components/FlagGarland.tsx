// Decorative top bunting: triangular pennants of the teams playing the upcoming
// matchday, hung from a gently DROOPING string set a little below the top edge.
//
// Each pennant is a downward triangle showing a clean flagcdn country flag. The
// box is 4:3 (20x15) to MATCH flagcdn's 4:3 flags, so `cover` places the whole
// flag with no zoom — only the triangle's two bottom corners are trimmed. flagcdn
// flags are edge-to-edge and uniform, so every pennant is the same size (the old
// team-badge images had inconsistent padding, which made some look smaller and
// zoomed-in). Cosmetic only (aria-hidden). Server component, fed from the layout.

const STYLE = `
@keyframes fg-sway {
  0%, 100% { transform: rotate(-2.4deg); }
  50%      { transform: rotate(2.4deg); }
}
.fg-pennant {
  transform-origin: top center;
  animation: fg-sway 3s ease-in-out infinite;
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .fg-pennant { animation: none; transform: none; }
}
`;

const H = 32; // strip height
const STRING_Y = 8; // string sits ~3/4 up the strip, not flush at the very top
const DROOP = 3.5; // gentle sag in the middle
const PW = 20; // pennant width
const PH = 15; // pennant height (4:3 with PW → matches flagcdn flags, no zoom)
const STRING_COLOR = "rgba(12, 20, 48, 0.32)";

function frac(n: number) {
  return n - Math.floor(n);
}

export default function FlagGarland({
  flags,
}: {
  flags: { id: number; name: string; iso: string | null }[];
}) {
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
          const src = f.iso
            ? `https://flagcdn.com/w80/${f.iso}.png`
            : `https://media.api-sports.io/football/teams/${f.id}.png`;
          return (
            <div key={f.id} style={{ transform: `translateY(${dy.toFixed(2)}px)` }}>
              <div
                className="fg-pennant"
                title={f.name}
                style={{
                  width: PW,
                  height: PH,
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  backgroundImage: `url(${src})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "drop-shadow(0 1px 1px rgba(12, 20, 48, 0.4))",
                  animationDelay: `${(-frac(i * 0.41) * 3).toFixed(2)}s`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
