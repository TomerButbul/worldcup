"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { SaveState } from "@/lib/useAutosave";

const MAP: Record<SaveState, { text: string; cls: string }> = {
  idle: { text: "Auto-saves as you go", cls: "text-chalk-dim" },
  saving: { text: "Saving…", cls: "text-chalk-dim" },
  saved: { text: "✓ Saved", cls: "text-grass" },
  error: { text: "Couldn't save — keep editing to retry", cls: "text-red-600" },
};

// Status line for autosaved picks. On a fresh save it stamps a brief gold
// "Predicted" seal — a little reward for locking a pick in — then settles back to
// the quiet "✓ Saved".
export default function SaveStatus({
  state,
  error,
  className = "",
}: {
  state: SaveState;
  error?: string | null;
  className?: string;
}) {
  const [stamp, setStamp] = useState(false);
  const prev = useRef<SaveState>(state);
  useEffect(() => {
    if (state === "saved" && prev.current !== "saved") {
      setStamp(true);
      const t = setTimeout(() => setStamp(false), 1500);
      prev.current = state;
      return () => clearTimeout(t);
    }
    prev.current = state;
  }, [state]);

  if (stamp) {
    return (
      <motion.span
        className={`inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-gold ring-1 ring-gold/40 ${className}`}
        initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
        animate={{ scale: [0.4, 1.14, 1], rotate: [-12, 3, 0], opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.62, 1] }}
      >
        🔒 Predicted
      </motion.span>
    );
  }

  const s = MAP[state];
  const text = state === "error" && error ? `⚠ ${error}` : state === "error" ? `⚠ ${s.text}` : s.text;
  return <span className={`text-xs font-medium ${s.cls} ${className}`}>{text}</span>;
}
