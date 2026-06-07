// Imperative "GOAL!" celebration takeover — a brief, full-screen, non-interactive
// burst (big wordmark, optional team name, a colour flash + confetti) you can fire
// from anywhere without prop-drilling a celebration context through the tree. It's
// fire-and-forget DOM: appended to <body>, self-removes, and is pointer-events:none
// so it never blocks the UI underneath. No-ops during SSR and under reduced motion.
function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// Brand palette for the confetti bits (electric / magenta / grass / gold / orange / cyan).
const CONFETTI_COLORS = ["#2563eb", "#db2777", "#10b981", "#e0a400", "#ea580c", "#0891b2"];
const CONFETTI_COUNT = 28;

export function goalCelebration(text = "GOAL!", opts: { subtitle?: string } = {}) {
  if (typeof document === "undefined" || reducedMotion()) return;

  const wrap = document.createElement("div");
  wrap.className = "goal-takeover";
  // Announce the moment to assistive tech without stealing focus.
  wrap.setAttribute("role", "status");
  wrap.setAttribute("aria-live", "polite");
  wrap.setAttribute("aria-label", opts.subtitle ? `${text} ${opts.subtitle}` : text);

  // Colour bloom behind the text.
  const flash = document.createElement("div");
  flash.className = "goal-flash";
  wrap.appendChild(flash);

  // Confetti burst — exploding outward from the centre, biased downward (gravity).
  // Spread/spin are randomised per piece; safe here since this only ever runs in the
  // browser after a user/poll event (never during SSR or hydration).
  const confetti = document.createElement("div");
  confetti.className = "goal-confetti";
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const piece = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const dist = 26 + Math.random() * 34;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist + 14; // + downward bias
    piece.style.setProperty("--tx", `${tx.toFixed(1)}vw`);
    piece.style.setProperty("--ty", `${ty.toFixed(1)}vh`);
    piece.style.setProperty("--spin", `${(Math.random() * 760 - 380).toFixed(0)}deg`);
    piece.style.setProperty("--delay", `${(Math.random() * 0.12).toFixed(2)}s`);
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    confetti.appendChild(piece);
  }
  wrap.appendChild(confetti);

  // Text block — appended last so it paints above the flash + confetti.
  const textWrap = document.createElement("div");
  textWrap.className = "goal-text";
  const pop = document.createElement("div");
  pop.className = "goal-pop";
  pop.textContent = text;
  textWrap.appendChild(pop);
  if (opts.subtitle) {
    const sub = document.createElement("div");
    sub.className = "goal-sub";
    sub.textContent = opts.subtitle;
    textWrap.appendChild(sub);
  }
  wrap.appendChild(textWrap);

  document.body.appendChild(wrap);
  window.setTimeout(() => wrap.remove(), 1800);
}
