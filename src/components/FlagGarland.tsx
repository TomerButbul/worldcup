// Decorative top bunting: triangular pennants of the upcoming matchday's teams,
// hung from a SCALLOPED string that rises to each flag and dips between them —
// the classic draped party-bunting look, not a flat line.
//
// Each pennant is a downward triangle showing a clean flagcdn flag. The box is
// 4:3 to match flagcdn's 4:3 flags, so `cover` shows the WHOLE flag with no
// zoom — only the triangle's two bottom corners trim to the point.
//
// Alignment trick: with `justify-around`, pennant i's centre sits at exactly
// (i+0.5)/n of the width, so the SVG string can peak at those same fractions
// and the two layers line up without measuring the DOM. Cosmetic (aria-hidden).

const STYLE = `
@keyframes fg-sway {
  0%, 100% { transform: rotate(-2.2deg); }
  50%      { transform: rotate(2.2deg); }
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
const PEAK_Y = 7; // where pennants attach (string high points), ~3/4 up
const DIP_Y = 13; // string sag between pennants
const PW = 26; // pennant width
const PH = 20; // pennant height (~4:3 with PW → matches flagcdn flags)
const STRING_COLOR = "rgba(12, 20, 48, 0.4)";

function frac(n: number) {
  return n - Math.floor(n);
}

// A scalloped path: dips at the edges, rises to a peak at each pennant centre,
// dips again between adjacent pennants.
function buildString(n: number) {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push(((i + 0.5) / n) * 100);
  let d = `M 0 ${DIP_Y} Q ${(xs[0] / 2).toFixed(1)} ${DIP_Y} ${xs[0].toFixed(1)} ${PEAK_Y}`;
  for (let i = 1; i < n; i++) {
    const mid = (xs[i - 1] + xs[i]) / 2;
    d += ` Q ${mid.toFixed(1)} ${DIP_Y} ${xs[i].toFixed(1)} ${PEAK_Y}`;
  }
  const last = xs[n - 1];
  d += ` Q ${((last + 100) / 2).toFixed(1)} ${DIP_Y} 100 ${DIP_Y}`;
  return d;
}

export default function FlagGarland({
  flags,
}: {
  flags: { id: number; name: string; iso: string | null }[];
}) {
  if (!flags.length) return <div aria-hidden style={{ height: H }} />;
  const path = buildString(flags.length);
  return (
    <div aria-hidden className="relative w-full overflow-hidden" style={{ height: H }}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      {/* scalloped string */}
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
        <path
          d={path}
          fill="none"
          stroke={STRING_COLOR}
          strokeWidth={1.4}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* triangle pennants hung from the peaks */}
      <div className="absolute inset-x-0 flex items-start justify-around" style={{ top: PEAK_Y }}>
        {flags.map((f, i) => {
          const src = f.iso
            ? `https://flagcdn.com/w80/${f.iso}.png`
            : `https://media.api-sports.io/football/teams/${f.id}.png`;
          return (
            <div
              key={f.id}
              className="fg-pennant"
              title={f.name}
              style={{
                width: PW,
                height: PH,
                clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                backgroundImage: `url(${src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "drop-shadow(0 1.5px 1.5px rgba(12, 20, 48, 0.45))",
                animationDelay: `${(-frac(i * 0.41) * 3).toFixed(2)}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
