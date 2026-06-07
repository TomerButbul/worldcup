// Pure maths for the CountUp animated number. Kept DOM/React-free so the easing
// and per-frame value are unit-testable; the component just drives `progress` from
// a requestAnimationFrame clock and renders countUpValue(from, to, progress).

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

// Decelerating ease — fast start, gentle settle. Feels like a score "landing".
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

// The integer to show at a given progress [0,1] while animating from → to.
// Works in both directions (a rank/points drop counts down). Endpoints are exact.
export function countUpValue(from: number, to: number, progress: number): number {
  const eased = easeOutCubic(progress);
  return Math.round(from + (to - from) * eased);
}
