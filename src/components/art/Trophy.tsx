// The World Cup trophy icon used across the app — the SAME real (CC0) trophy as
// the app/home-screen icon, so in-app icons match. Rendered as an <img> because
// the authentic trophy shape is hard to draw cleanly as a tiny inline SVG.
// `size` sets the HEIGHT; width scales to the trophy's natural (tall) aspect, so
// it never squishes. Override via className (e.g. responsive `h-* w-auto`).
export default function Trophy({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/trophy.png" alt="" height={size} className={`inline-block w-auto shrink-0 ${className}`} />
  );
}
