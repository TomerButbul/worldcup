// Decorative top bunting: the flags of the teams playing the upcoming matchday,
// hung from a string and gently swaying. Small, well-separated, STATIC (no
// scroll, no fade). Cosmetic only (aria-hidden). Server component — the flag
// set is passed in from the layout (cached). Uses the same team flag images as
// the rest of the app (api-sports by team id).

const STYLE = `
@keyframes fg-sway {
  0%, 100% { transform: rotate(-2.5deg); }
  50%      { transform: rotate(2.5deg); }
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

function frac(n: number) {
  return n - Math.floor(n);
}

export default function FlagGarland({ flags }: { flags: { id: number; name: string }[] }) {
  if (!flags.length) return <div aria-hidden style={{ height: 24 }} />;
  return (
    <div aria-hidden className="relative w-full overflow-hidden" style={{ height: 24 }}>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      {/* the string the flags hang from */}
      <div className="absolute inset-x-0 top-0 h-px bg-night/25" />
      <div className="flex h-full items-start justify-around px-3">
        {flags.map((f, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={f.id}
            className="fg-pennant"
            title={f.name}
            src={`https://media.api-sports.io/football/teams/${f.id}.png`}
            alt=""
            width={20}
            height={14}
            style={{
              width: 20,
              height: 14,
              objectFit: "cover",
              borderRadius: 2,
              boxShadow: "0 1px 2px rgba(12, 20, 48, 0.3)",
              animationDelay: `${(-frac(i * 0.41) * 2.9).toFixed(2)}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
