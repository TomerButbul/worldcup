// Asset-free sound effects synthesized with the Web Audio API.
// Respects a persisted mute flag and prefers-reduced-motion is irrelevant here,
// but autoplay policies mean sounds only fire after a user gesture.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const MUTE_KEY = "wc-muted";

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "triangle",
  gain = 0.18,
  slideTo?: number,
) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.05);
}

function guard(): boolean {
  return !isMuted() && getCtx() !== null;
}

// Triumphant ascending fanfare.
export function playCheer() {
  if (!guard()) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => tone(f, i * 0.1, 0.25, "triangle", 0.2));
  tone(1318.51, 0.4, 0.45, "triangle", 0.18); // E6 flourish
}

// Sad "womp womp" trombone — for losers.
export function playWomp() {
  if (!guard()) return;
  tone(311.13, 0, 0.35, "sawtooth", 0.16, 261.63);   // Eb -> C
  tone(261.63, 0.35, 0.55, "sawtooth", 0.16, 196.0);  // C -> G
}

// Referee whistle.
export function playWhistle() {
  if (!guard()) return;
  tone(2100, 0, 0.18, "square", 0.08);
  tone(2300, 0.16, 0.2, "square", 0.08);
}

// Soft UI pop.
export function playPop() {
  if (!guard()) return;
  tone(880, 0, 0.08, "sine", 0.12);
}

// Save / confirm ding.
export function playDing() {
  if (!guard()) return;
  tone(987.77, 0, 0.12, "sine", 0.15);
  tone(1318.51, 0.08, 0.18, "sine", 0.13);
}
