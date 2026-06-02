import confetti from "canvas-confetti";
import type { Shape } from "canvas-confetti";
import { playCheer, playDing } from "@/lib/sound";

const COLORS = ["#2563eb", "#db2777", "#10b981", "#f5b400", "#ffffff", "#7c3aed"];

let ballShape: Shape | null = null;
function getBallShape(): Shape | null {
  if (ballShape) return ballShape;
  try {
    if (typeof confetti.shapeFromText === "function") {
      ballShape = confetti.shapeFromText({ text: "⚽", scalar: 2.4 });
    }
  } catch {
    ballShape = null;
  }
  return ballShape;
}

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// Quick celebratory burst (e.g. on save) — colours + a few soccer balls.
export function burst() {
  playDing();
  if (reducedMotion()) return;
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 }, colors: COLORS, scalar: 0.9 });
  const ball = getBallShape();
  if (ball) {
    confetti({ particleCount: 14, spread: 90, origin: { y: 0.7 }, shapes: [ball], scalar: 2.2 });
  }
}

// Big celebration (e.g. picking a champion) — side cannons + raining balls.
export function celebrate() {
  playCheer();
  if (reducedMotion()) return;
  const ball = getBallShape();
  const end = Date.now() + 1200;
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 75, origin: { x: 0 }, colors: COLORS });
    confetti({ particleCount: 6, angle: 120, spread: 75, origin: { x: 1 }, colors: COLORS });
    if (ball) {
      confetti({ particleCount: 3, spread: 100, origin: { y: 0.4 }, shapes: [ball], scalar: 2.4 });
    }
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
