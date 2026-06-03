"use client";

import { useEffect, useRef, useState } from "react";
import { countdownParts } from "@/lib/clock";
import MatchClock from "@/components/art/MatchClock";

function format(target: number): string | null {
  const p = countdownParts(target);
  if (!p) return null;
  if (p.days > 0) return `${p.days}d ${p.hours}h`;
  if (p.hours > 0) return `${p.hours}h ${p.mins}m`;
  if (p.mins > 0) return `${p.mins}m ${String(p.secs).padStart(2, "0")}s`;
  return `${p.secs}s`;
}

export default function MatchCountdown({
  kickoff,
  onExpire,
  className = "",
}: {
  kickoff: string;
  onExpire?: () => void;
  className?: string;
}) {
  const target = new Date(kickoff).getTime();
  const [text, setText] = useState<string | null>(null);

  // Latest-ref so the ticking effect doesn't re-subscribe when the parent
  // passes a fresh onExpire closure each render.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const tick = () => {
      const next = format(target);
      setText(next);
      if (next == null) {
        onExpireRef.current?.();
        return false;
      }
      return true;
    };
    if (!tick()) return;
    const id = window.setInterval(() => {
      if (!tick()) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  // Null on the server and first client render (avoids hydration mismatch),
  // and again once kickoff has passed.
  if (text == null) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold ${className}`}
    >
      <MatchClock size={13} />
      {text}
    </span>
  );
}
