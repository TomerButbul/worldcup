// Convert API-Football status_short + elapsed minute to a compact display label.
// Used wherever we show a match clock: live cards, standings badges, widget rows.
export function matchClock(
  statusShort: string | null | undefined,
  elapsed: number | null | undefined,
): string {
  switch (statusShort) {
    case "HT":  return "HT";
    case "FT":  return "FT";
    case "AET": return "AET";
    case "PEN":
    case "P":   return "PEN";
    case "BT":  return "BT"; // break between extra-time halves
    case "ET":  return elapsed != null ? `${elapsed}'` : "ET";
    default:    return elapsed != null ? `${elapsed}'` : "LIVE";
  }
}

// True for statuses where the clock is frozen (not a running minute).
export function isClockFrozen(statusShort: string | null | undefined): boolean {
  return ["HT", "FT", "AET", "PEN", "P", "BT"].includes(statusShort ?? "");
}
