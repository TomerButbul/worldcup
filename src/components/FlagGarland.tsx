"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

// Festive flag bunting along the top: real country flags strung from a line,
// gently swaying in place (NOT a scrolling ticker), cross-fading to the next
// set every few seconds so the whole field rotates through. Cosmetic only
// (aria-hidden), prop-free — rendered in the root layout's fixed top bar.
//
// Real flag PNGs (flagcdn.com, already used elsewhere in the repo). Country-flag
// emoji render as bare letter pairs on Windows browsers, so emoji are out.

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

const VISIBLE = 12; // flags on screen at once, evenly spaced
const PAGES = Math.ceil(NATIONS.length / VISIBLE);

function frac(n: number) {
  return n - Math.floor(n);
}

// Each flag hangs from its top edge and sways like cloth in a breeze. Scoped,
// uniquely-named keyframes so they don't collide with globals.css.
const STYLE = `
@keyframes fg-sway {
  0%, 100% { transform: rotate(-2.6deg) skewX(2deg); }
  50%      { transform: rotate(2.6deg)  skewX(-2deg); }
}
.fg-flag {
  transform-origin: top center;
  border-radius: 2px;
  box-shadow: 0 2px 3px rgba(12, 20, 48, 0.4);
  animation: fg-sway 2.8s ease-in-out infinite;
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) {
  .fg-flag { animation: none; transform: none; }
}
`;

export default function FlagGarland() {
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setPage((p) => (p + 1) % PAGES), 5000);
    return () => clearInterval(id);
  }, []);

  const start = (page % PAGES) * VISIBLE;
  const set = Array.from({ length: VISIBLE }, (_, i) => NATIONS[(start + i) % NATIONS.length]);

  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden border-b border-gold/30 bg-night/90"
      style={{ height: 30 }}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      {/* the string the flags hang from */}
      <div className="absolute inset-x-0 top-0 h-px bg-gold/40" />
      <AnimatePresence>
        <motion.div
          key={page}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 flex items-start justify-around px-2 pt-0.5"
        >
          {set.map((n, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${page}-${n.iso}-${i}`}
              className="fg-flag"
              src={`https://flagcdn.com/w40/${n.iso}.png`}
              alt=""
              width={26}
              height={18}
              loading="eager"
              decoding="async"
              draggable={false}
              style={{ width: 26, height: 18, animationDelay: `${(-frac(i * 0.41) * 2.8).toFixed(2)}s` }}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
