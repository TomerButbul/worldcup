import Ball from "@/components/art/Ball";

// Small football badges shared by the lineup pitch chips and the bench list.

// Goal — just the soccer ball (it already reads clearly) with a soft shadow for
// contrast, and a "×N" only when a player scored more than once. No background box.
export function GoalMark({ count = 1 }: { count?: number }) {
  return (
    <span className="flex items-center gap-px">
      <Ball size={13} className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]" />
      {count > 1 && (
        <span className="text-[8px] font-extrabold leading-none text-white [text-shadow:0_1px_1.5px_rgba(0,0,0,0.85)]">
          ×{count}
        </span>
      )}
    </span>
  );
}

// Assist — a football cleat, drawn as a white silhouette with a soft shadow so it
// stays legible on the green pitch and over player photos.
export function AssistMark({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#fff"
      aria-label="assist"
      className="shrink-0 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.6)]"
    >
      <path d="M3 7a1 1 0 0 1 1-1h4.5a1 1 0 0 1 1 1v3l8.4 3.5c1.3.6 2.1 1.8 2.1 3.2V18a1 1 0 0 1-1 1H5.2A2.2 2.2 0 0 1 3 16.8V7z" />
      <circle cx="7" cy="21" r="0.9" />
      <circle cx="12" cy="21" r="0.9" />
      <circle cx="17" cy="21" r="0.9" />
    </svg>
  );
}

// Referee card. The 🟨/🟥 emoji render as plain coloured squares on many systems,
// so we draw a crisp CSS rectangle that actually reads as a card.
export function CardMark({ color, className = "" }: { color: "yellow" | "red"; className?: string }) {
  return (
    <span
      aria-label={color === "red" ? "red card" : "yellow card"}
      className={`inline-block h-3 w-[8px] shrink-0 rounded-[1.5px] shadow-sm ring-1 ring-black/15 ${
        color === "red" ? "bg-red-500" : "bg-yellow-400"
      } ${className}`}
    />
  );
}
