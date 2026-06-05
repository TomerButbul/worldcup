"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// A tiny, reusable "what's this?" tooltip. Tap (mobile) or hover (desktop) the
// trigger to reveal a short explanation bubble above it. Use for jargon a casual
// fan might not know (OVR, FIFA rank, the best-3rd-place rule, the score crowns…)
// without cluttering the UI for everyone else.
//
//   <InfoTip label="OVR">Overall rating, 0–99 — a player's all-round skill.</InfoTip>
//   Best third place <InfoTip>The 8 best 3rd-placed teams also advance.</InfoTip>
export default function InfoTip({
  children,
  label,
  className = "",
}: {
  children: ReactNode; // the explanation shown in the bubble
  label?: ReactNode; // the trigger; defaults to a small ⓘ
  className?: string;
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

  return (
    <span ref={ref} className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label="What's this?"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`inline-flex cursor-help items-center ${
          label
            ? "gap-0.5 underline decoration-dotted decoration-chalk-dim/50 underline-offset-2"
            : "h-3.5 w-3.5 justify-center rounded-full bg-night/15 text-[9px] font-bold leading-none text-chalk-dim"
        } ${className}`}
      >
        {label ?? "i"}
      </button>
      {/* The bubble — shown on tap, or on hover for pointer devices. */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-[120] mb-2 w-56 -translate-x-1/2 rounded-xl bg-night px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-xl transition-opacity duration-150 ${
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ visibility: open ? "visible" : undefined }}
      >
        {children}
        <span
          aria-hidden
          className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-night"
        />
      </span>
    </span>
  );
}
