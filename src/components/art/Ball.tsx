// Classic soccer ball icon — the public-domain (CC0) Wikimedia
// "Soccerball_shade.svg", a clean shaded black-and-white football. Rendered as
// an <img>; square (1:1). Size is set via inline `style` so Tailwind Preflight's
// `img { height: auto }` reset can't distort it. className is for positioning.
export default function Ball({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ball.svg"
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
