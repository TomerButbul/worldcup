// Classic soccer ball icon used across the app — the public-domain (CC0)
// Wikimedia Commons "Soccerball_shade.svg", a clean shaded black-and-white
// football. Rendered as an <img> so it's crisp at any size and unmistakably a
// soccer ball (not the abstract curved-seam look it replaced). Square (1:1).
export default function Ball({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/ball.svg" alt="" width={size} height={size} className={`inline-block shrink-0 ${className}`} />
  );
}
