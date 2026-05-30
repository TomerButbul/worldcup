import confetti from "canvas-confetti";
import { playCheer, playDing } from "@/lib/sound";

const GOLD = ["#f6c453", "#ffd970", "#19c37d", "#2de89a", "#ffffff"];

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// Quick celebratory burst (e.g. on save).
export function burst() {
  playDing();
  if (reducedMotion()) return;
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.7 },
    colors: GOLD,
    scalar: 0.9,
  });
}

// Big championship celebration (e.g. picking a champion).
export function celebrate() {
  playCheer();
  if (reducedMotion()) return;
  const end = Date.now() + 1200;
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 75, origin: { x: 0 }, colors: GOLD });
    confetti({ particleCount: 6, angle: 120, spread: 75, origin: { x: 1 }, colors: GOLD });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
