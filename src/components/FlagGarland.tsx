"use client";

// Decorative top bar: a seamless marquee of World Cup nation flags that
// gently wave in the wind. Cosmetic only (aria-hidden), prop-free — rendered
// as <FlagGarland /> in the root layout's fixed top bar.
//
// Approach: small flag PNGs from flagcdn.com (already used elsewhere in this
// repo, e.g. src/app/preview/page.tsx). Real flag images skew/ripple far more
// convincingly than country-flag emoji — and crucially, Windows browsers
// (Chrome/Edge) don't render country-flag emoji as flags at all, just letter
// pairs, so emoji would look broken for most users here.
//
// Two layers of motion:
//   1. The whole row slides left forever (linear) and loops with no seam,
//      because the flag list is rendered TWICE and the track travels exactly
//      -50% of its own width.
//   2. Each flag also runs its own eased wave (translateY + skew + rotate)
//      with a per-flag delay/duration derived deterministically from its
//      index — no Math.random, so server and client render identically and
//      hydration stays clean. The spread of offsets makes it feel like a
//      breeze rather than a metronome.
//
// prefers-reduced-motion: both animations are disabled and transforms reset,
// leaving a tidy static row of flags.

// flagcdn special codes: England/Scotland/Wales use gb-eng / gb-sct / gb-wls.
// Curated ~48-nation field (the qualified World Cup field), ISO-2 codes.
const NATIONS: ReadonlyArray<{ iso: string; name: string }> = [
  { iso: "ca", name: "Canada" },
  { iso: "mx", name: "Mexico" },
  { iso: "us", name: "United States" },
  { iso: "ar", name: "Argentina" },
  { iso: "br", name: "Brazil" },
  { iso: "uy", name: "Uruguay" },
  { iso: "co", name: "Colombia" },
  { iso: "ec", name: "Ecuador" },
  { iso: "py", name: "Paraguay" },
  { iso: "fr", name: "France" },
  { iso: "es", name: "Spain" },
  { iso: "gb-eng", name: "England" },
  { iso: "de", name: "Germany" },
  { iso: "pt", name: "Portugal" },
  { iso: "nl", name: "Netherlands" },
  { iso: "it", name: "Italy" },
  { iso: "be", name: "Belgium" },
  { iso: "hr", name: "Croatia" },
  { iso: "ch", name: "Switzerland" },
  { iso: "rs", name: "Serbia" },
  { iso: "dk", name: "Denmark" },
  { iso: "pl", name: "Poland" },
  { iso: "at", name: "Austria" },
  { iso: "gb-sct", name: "Scotland" },
  { iso: "gb-wls", name: "Wales" },
  { iso: "no", name: "Norway" },
  { iso: "tr", name: "Turkey" },
  { iso: "ua", name: "Ukraine" },
  { iso: "cz", name: "Czechia" },
  { iso: "ma", name: "Morocco" },
  { iso: "sn", name: "Senegal" },
  { iso: "tn", name: "Tunisia" },
  { iso: "dz", name: "Algeria" },
  { iso: "eg", name: "Egypt" },
  { iso: "ng", name: "Nigeria" },
  { iso: "gh", name: "Ghana" },
  { iso: "ci", name: "Ivory Coast" },
  { iso: "cm", name: "Cameroon" },
  { iso: "za", name: "South Africa" },
  { iso: "jp", name: "Japan" },
  { iso: "kr", name: "South Korea" },
  { iso: "ir", name: "Iran" },
  { iso: "sa", name: "Saudi Arabia" },
  { iso: "au", name: "Australia" },
  { iso: "qa", name: "Qatar" },
  { iso: "jo", name: "Jordan" },
  { iso: "uz", name: "Uzbekistan" },
  { iso: "nz", name: "New Zealand" },
];

// Deterministic pseudo-random in [0,1) seeded by index — SSR-safe (no
// Math.random at module/render time, so server and client agree).
function frac(n: number): number {
  return n - Math.floor(n);
}

const FLAG_W = 30; // px — small, mobile-friendly
const FLAG_H = 20;

// Scoped keyframes + reduced-motion handling. Unique names avoid colliding
// with the app's global keyframes in globals.css (which we must not edit).
const STYLE = `
@keyframes fg-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes fg-wave {
  0%   { transform: translateY(0)      rotate(-1.5deg) skewX(0deg); }
  25%  { transform: translateY(-1.5px) rotate(1.2deg)  skewX(-7deg); }
  50%  { transform: translateY(0.5px)  rotate(-1deg)   skewX(0deg); }
  75%  { transform: translateY(-1px)   rotate(1.5deg)  skewX(7deg); }
  100% { transform: translateY(0)      rotate(-1.5deg) skewX(0deg); }
}
.fg-track {
  display: flex;
  width: max-content;
  align-items: center;
  gap: 18px;
  padding-inline: 9px;
  animation: fg-marquee 60s linear infinite;
  will-change: transform;
}
.fg-flag {
  display: block;
  flex: none;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(12, 20, 48, 0.35);
  transform-origin: left center;
  animation: fg-wave 3s ease-in-out infinite;
  will-change: transform;
}
@media (hover: hover) {
  .fg-bar:hover .fg-track { animation-play-state: paused; }
}
@media (prefers-reduced-motion: reduce) {
  .fg-track { animation: none; }
  .fg-flag  { animation: none; transform: none; }
}
`;

export default function FlagGarland() {
  // Render the list twice so the marquee wraps seamlessly: the track travels
  // exactly -50% of its width, landing the second copy where the first began.
  const doubled = [...NATIONS, ...NATIONS];

  return (
    <div
      aria-hidden
      className="fg-bar relative w-full overflow-hidden border-b border-gold/30 bg-night/90"
      style={{ height: FLAG_H + 8 }}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div className="fg-track">
        {doubled.map((n, i) => {
          // Per-flag offsets, deterministic by position in the original list
          // so the two copies wave identically and there's no seam.
          const seed = i % NATIONS.length;
          const delay = -frac(seed * 0.37) * 3; // negative => already mid-wave
          const duration = 2.6 + frac(seed * 0.91) * 1.8; // 2.6s–4.4s
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              className="fg-flag"
              src={`https://flagcdn.com/w40/${n.iso}.png`}
              alt=""
              width={FLAG_W}
              height={FLAG_H}
              loading="eager"
              decoding="async"
              draggable={false}
              style={{
                width: FLAG_W,
                height: FLAG_H,
                animationDelay: `${delay.toFixed(2)}s`,
                animationDuration: `${duration.toFixed(2)}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
