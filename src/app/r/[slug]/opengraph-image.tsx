import { ImageResponse } from "next/og";
import { TOURNAMENT_TZ } from "@/lib/datetime";
import { getReferrerPreview } from "@/lib/referral";
import { INVITATIONAL_NAME } from "@/lib/contest";

// Referral invite card — the 1200×630 image that unfurls when a /r/<slug> link is
// pasted into iMessage, WhatsApp, X, Slack… Mirrors the /join card (navy gradient,
// gold frame, trophy watermark) but sells the prize + "you're both in" hook so every
// shared referral feels personal and high-stakes. Falls back to a generic-but-branded
// card if the slug is unknown.
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "You're invited to the Invitational — best World Cup bracket wins a cash prize";

const GOLD = "#ffd970";
const GOLD_DEEP = "#f6c453";
const LOCK_MS = Date.parse("2026-06-11T19:00:00Z");

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ref = await getReferrerPreview(slug);
  const eyebrow = ref ? `${ref.name.toUpperCase()} INVITED YOU TO` : "YOU'RE INVITED TO";
  const lockDate = new Date(LOCK_MS).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: TOURNAMENT_TZ,
  });

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
            🏆
          </div>
          <div style={{ fontSize: 25, color: GOLD, letterSpacing: 6, fontWeight: 700, display: "flex" }}>
            THE 2026 PREDICTION GAME
          </div>
        </div>

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
          {eyebrow}
        </div>

        <div
          style={{
            marginTop: 12,
            fontSize: 116,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: -2,
            color: GOLD,
            display: "flex",
          }}
        >
          {INVITATIONAL_NAME}
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 36,
            fontWeight: 600,
            color: "#dfe4ff",
            display: "flex",
            maxWidth: 1000,
          }}
        >
          Sign up — you&rsquo;re both in. Best bracket wins the prize.
        </div>

        <div style={{ marginTop: 40, display: "flex", gap: 16 }}>
          <div
            style={{
              fontSize: 29,
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
            🔒 Brackets lock {lockDate}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
