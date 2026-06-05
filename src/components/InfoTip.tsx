"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// A tiny, reusable "what's this?" tooltip. Tap (mobile) or hover (desktop) the
// trigger to reveal a short explanation bubble above it. Use for jargon a casual
// fan might not know (OVR, FIFA rank, the best-3rd-place rule, the score crowns…)
// without cluttering the UI for everyone else.
//
//   <InfoTip label="OVR">Overall rating, 0–99 — a player's all-round skill.</InfoTip>
//   Best third place <InfoTip>The 8 best 3rd-placed teams also advance.</InfoTip>
//
// align="end" opens the bubble leftward (right-aligned) — use it for triggers
// near the right screen edge so the bubble can't overflow into a horizontal scroll.
export default function InfoTip({
  children,
  label,
  className = "",
  wrapClassName = "",
  bare = false,
  align = "center",
}: {
  children: ReactNode; // the explanation shown in the bubble
  label?: ReactNode; // the trigger; defaults to a small ⓘ
  className?: string; // extra classes on the trigger button
  wrapClassName?: string; // extra classes on the positioned outer wrapper
  bare?: boolean; // render the label as-is (no underline / ⓘ chrome)
  align?: "center" | "end"; // bubble alignment relative to the trigger
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const bubblePos = align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  const arrowPos = align === "end" ? "right-3" : "left-1/2 -translate-x-1/2";

  return (
    <span ref={ref} className={`group relative inline-flex align-middle ${wrapClassName}`}>
      <button
        type="button"
        aria-label="What's this?"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={
          bare
            ? `cursor-help ${className}`
            : `inline-flex cursor-help items-center ${
                label
                  ? "gap-0.5 underline decoration-dotted decoration-chalk-dim/50 underline-offset-2"
                  : "h-3.5 w-3.5 justify-center rounded-full bg-night/15 text-[9px] font-bold leading-none text-chalk-dim"
              } ${className}`
        }
      >
        {label ?? "i"}
      </button>
      {/* The bubble is `hidden` (display:none) when closed so it takes ZERO
          layout — an always-laid-out opacity-0 bubble near a screen edge silently
          widens the page and causes a horizontal scroll on mobile. Shown on tap
          or hover; capped to the viewport and right-alignable near the edge. */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full ${bubblePos} z-[120] mb-2 w-56 max-w-[calc(100vw-1.5rem)] rounded-xl bg-night px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-xl ${
          open ? "block" : "hidden group-hover:block"
        }`}
      >
        {children}
        <span
          aria-hidden
          className={`absolute top-full ${arrowPos} border-4 border-transparent border-t-night`}
        />
      </span>
    </span>
  );
}
