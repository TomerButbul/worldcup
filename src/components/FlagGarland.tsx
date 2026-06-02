// Decorative triangular flag bunting strung across the top of a section.
// Pure CSS (sway animation in globals.css). Cosmetic only.
const COLORS = [
  "#19c37d", "#f6c453", "#e23b3b", "#3b7de2", "#ffffff",
  "#9b3be2", "#2de89a", "#ff8a3b", "#e23bb0", "#3be2d8",
];

export default function FlagGarland({ count = 16 }: { count?: number }) {
  return (
    <div aria-hidden className="relative h-6 w-full overflow-hidden">
      <div className="absolute left-0 top-1 h-px w-full bg-night/20" />
      <div className="flex w-full justify-between px-1">
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className="origin-top animate-sway"
            style={{
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: `14px solid ${COLORS[i % COLORS.length]}`,
              animationDelay: `${(i % 6) * 0.18}s`,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
            }}
          />
        ))}
      </div>
    </div>
  );
}
