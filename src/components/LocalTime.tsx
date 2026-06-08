"use client";

import { useEffect, useState } from "react";
import { formatInZone, TOURNAMENT_TZ } from "@/lib/datetime";

type Mode = "time" | "date" | "datetime" | "weekday-long";

const PRESETS: Record<Mode, Intl.DateTimeFormatOptions> = {
  time: { hour: "numeric", minute: "2-digit" },
  date: { weekday: "short", month: "short", day: "numeric" },
  datetime: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  "weekday-long": { weekday: "long", month: "short", day: "numeric" },
};

// Renders a stored (UTC) kickoff instant in the VIEWER'S timezone. Because a server
// component can't know the visitor's zone, formatting has to happen on the client:
// we seed with the tournament zone (so SSR + the first client render agree — no
// hydration mismatch, and no-JS/crawlers still get a real time), then drop the pin
// on mount so it re-formats in the browser's local zone.
export default function LocalTime({
  iso,
  mode = "datetime",
  options,
  className,
}: {
  iso: string;
  mode?: Mode;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
}) {
  const opts = options ?? PRESETS[mode];
  const [tz, setTz] = useState<string | undefined>(TOURNAMENT_TZ);
  useEffect(() => setTz(undefined), []);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {formatInZone(iso, opts, tz)}
    </time>
  );
}
