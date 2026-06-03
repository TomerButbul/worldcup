// The World Cup trophy icon — the same real (CC0) trophy as the app icon, so
// in-app icons match. Rendered as an <img>. `size` is the HEIGHT; width follows
// the asset's real aspect (trophy.png is 201×500) so it never squishes.
//
// Sizing is set via inline `style` (NOT the height attribute): Tailwind's
// Preflight resets `img { height: auto }`, which would override an HTML height
// attribute and let this tall image balloon to its intrinsic size. Inline style
// beats that stylesheet rule. className is for positioning only — don't pass
// h-*/w-* utilities (they'd be ignored next to the inline style anyway).
const RATIO = 201 / 500;

export default function Trophy({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const w = Math.round(size * RATIO);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/trophy.png"
      alt=""
      width={w}
      height={size}
      style={{ width: w, height: size }}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
