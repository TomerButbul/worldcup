// Imperative "GOAL!" text pop — works from anywhere without prop drilling.
function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function goalCelebration(text = "GOAL!") {
  if (typeof document === "undefined" || reducedMotion()) return;
  const el = document.createElement("div");
  el.textContent = text;
  el.className = "goal-pop";
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 1500);
}
