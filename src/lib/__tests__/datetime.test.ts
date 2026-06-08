import { describe, it, expect } from "vitest";
import { formatInZone } from "@/lib/datetime";

// The opening match / bracket-lock instant: 19:00 UTC on Jun 11, 2026.
const OPENER = "2026-06-11T19:00:00Z";
const HM = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
const MD = { month: "short", day: "numeric" } as const;

describe("formatInZone", () => {
  it("renders the same instant as a different wall-clock per timezone", () => {
    expect(formatInZone(OPENER, HM, "America/New_York")).toBe("15:00"); // EDT, UTC-4
    expect(formatInZone(OPENER, HM, "Asia/Jerusalem")).toBe("22:00"); // IDT, UTC+3
    expect(formatInZone(OPENER, HM, "Asia/Tokyo")).toBe("04:00"); // JST, UTC+9 (next day)
  });

  it("shifts the calendar day across the date line", () => {
    expect(formatInZone(OPENER, MD, "America/New_York")).toBe("Jun 11");
    expect(formatInZone(OPENER, MD, "Asia/Tokyo")).toBe("Jun 12"); // 04:00 the next morning
  });

  it("falls back to the runtime's local zone when none is given", () => {
    // Env-dependent value, but it must format without throwing and be non-empty.
    const out = formatInZone(OPENER, HM);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});
