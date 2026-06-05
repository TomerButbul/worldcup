"use client";

import { useState, useEffect } from "react";
import { nowMs } from "@/lib/clock";

// Half-time pill with a live countdown to the second half. `secondHalfAt` is
// stamped by the live sync the moment HT is detected (kickoff of 1st-half break
// + 15 min), so this counts down without needing the exact resume time.
export default function HalfTime({ secondHalfAt }: { secondHalfAt: string | null }) {
  const target = secondHalfAt ? new Date(secondHalfAt).getTime() : null;
  const [left, setLeft] = useState(() => (target ? Math.max(0, target - nowMs()) : 0));

  useEffect(() => {
    if (!target) return;
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
      <span className="text-sm leading-none">⏸</span> Half Time
      {target && left > 0 ? ` · 2nd half in ${mm}:${String(ss).padStart(2, "0")}` : ""}
    </span>
  );
}
