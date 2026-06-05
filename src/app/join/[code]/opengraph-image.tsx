import { ImageResponse } from "next/og";
import { getInvitePreview } from "@/lib/invite";

// Per-league invite card — the 1200×630 image that unfurls when a /join/<code> link
// is pasted into iMessage, WhatsApp, X, Slack, Discord… It mirrors the site's root
// OG card (navy gradient, gold frame, trophy watermark) but swaps in the league's
// name, headcount and lock date so every shared invite feels personal, not generic.
// Reads league data with the service client; falls back to a generic-but-branded
// card if the code is unknown (a thrown OG route = a broken grey preview).
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "You’re invited to a World Cup 2026 prediction league";

const GOLD = "#ffd970";
const GOLD_DEEP = "#f6c453";
const DEFAULT_LOCK_MS = Date.parse("2026-06-11T19:00:00Z");

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const league = await getInvitePreview(code);

  const name = league?.name ?? "World Cup 2026";
  const members = league?.memberCount ?? 0;
  const memberLine =
    members > 0 ? `${members} ${members === 1 ? "manager" : "managers"} playing` : "Be the first in";
  const lockMs = league?.lockAt ? Date.parse(league.lockAt) : DEFAULT_LOCK_MS;
  const lockDate = new Date(lockMs).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  // Scale the league name down a touch for long names so it stays on ~2 lines.
  const nameSize = name.length > 22 ? 76 : name.length > 14 ? 92 : 108;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background:
            "radial-gradient(1100px 700px at 86% -8%, rgba(255,217,112,0.18), transparent 60%), radial-gradient(900px 600px at 6% 110%, rgba(255,217,112,0.10), transparent 55%), linear-gradient(135deg, #182264 0%, #0e1545 55%, #0a1038 100%)",
          color: "#eef1ff",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* gold hairline frame */}
        <div
          style={{
            position: "absolute",
            top: 36,
            left: 36,
            right: 36,
            bottom: 36,
            borderRadius: 36,
            border: "2px solid rgba(255,217,112,0.22)",
            display: "flex",
          }}
        />

        {/* oversized watermark trophy, bottom-right */}
        <div
          style={{
            position: "absolute",
            right: -40,
            bottom: -120,
            fontSize: 520,
            display: "flex",
            opacity: 0.07,
          }}
        >
          🏆
        </div>

        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 26,
              background: `linear-gradient(160deg, ${GOLD}, ${GOLD_DEEP})`,
              boxShadow: "0 16px 40px rgba(255,217,112,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
            }}
          >
            ⚽
          </div>
          <div
            style={{
              fontSize: 25,
              color: GOLD,
              letterSpacing: 6,
              fontWeight: 700,
              display: "flex",
            }}
          >
            THE 2026 PREDICTION GAME
          </div>
        </div>

        {/* eyebrow */}
        <div
          style={{
            marginTop: 40,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 2,
            color: "#c9d0f5",
            display: "flex",
          }}
        >
          YOU’RE INVITED TO JOIN
        </div>

        {/* league name */}
        <div
          style={{
            marginTop: 12,
            fontSize: nameSize,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: -2,
            color: GOLD,
            maxWidth: 1010,
            display: "flex",
          }}
        >
          {name}
        </div>

        {/* member + lock pills */}
        <div style={{ marginTop: 42, display: "flex", gap: 16 }}>
          <div
            style={{
              fontSize: 29,
              fontWeight: 600,
              padding: "13px 28px",
              borderRadius: 999,
              background: "rgba(255,217,112,0.10)",
              border: "2px solid rgba(255,217,112,0.45)",
              color: GOLD,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            👥 {memberLine}
          </div>
          <div
            style={{
              fontSize: 29,
              fontWeight: 600,
              padding: "13px 28px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "2px solid rgba(255,255,255,0.16)",
              color: "#dfe4ff",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            🔒 Picks lock {lockDate}
          </div>
        </div>

        {/* CTA pill */}
        <div style={{ marginTop: 44, display: "flex" }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              padding: "15px 36px",
              borderRadius: 999,
              background: `linear-gradient(160deg, ${GOLD}, ${GOLD_DEEP})`,
              color: "#23200f",
              boxShadow: "0 14px 34px rgba(255,217,112,0.30)",
              display: "flex",
              alignItems: "center",
            }}
          >
            Join free →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
