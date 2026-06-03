"use client";

import type { SaveState } from "@/lib/useAutosave";

const MAP: Record<SaveState, { text: string; cls: string }> = {
  idle: { text: "Auto-saves as you go", cls: "text-chalk-dim" },
  saving: { text: "Saving…", cls: "text-chalk-dim" },
  saved: { text: "✓ Saved", cls: "text-grass" },
  error: { text: "Couldn't save — keep editing to retry", cls: "text-red-600" },
};

// Subtle status line that replaces the old manual Save buttons.
export default function SaveStatus({
  state,
  error,
  className = "",
}: {
  state: SaveState;
  error?: string | null;
  className?: string;
}) {
  const s = MAP[state];
  const text = state === "error" && error ? `⚠ ${error}` : state === "error" ? `⚠ ${s.text}` : s.text;
  return <span className={`text-xs font-medium ${s.cls} ${className}`}>{text}</span>;
}
