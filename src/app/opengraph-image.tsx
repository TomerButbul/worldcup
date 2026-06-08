import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "World Cup 2026 — Predict the bracket, call every match, beat your friends";

const GOLD = "#ffd970";
const GOLD_DEEP = "#f6c453";

export default function OgImage() {
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
          padding: "84px 96px",
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
            fontSize: 560,
            display: "flex",
            opacity: 0.07,
          }}
        >
          🏆
        </div>

        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: 30,
              background: `linear-gradient(160deg, ${GOLD}, ${GOLD_DEEP})`,
              boxShadow: "0 16px 40px rgba(255,217,112,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 60,
            }}
          >
            ⚽
          </div>
          <div
            style={{
              fontSize: 27,
              color: GOLD,
              letterSpacing: 7,
              fontWeight: 700,
              display: "flex",
            }}
          >
            WORLD CUP 2026 PREDICTIONS
          </div>
        </div>

        {/* title */}
        <div
          style={{
            marginTop: 46,
            display: "flex",
            alignItems: "baseline",
            fontSize: 150,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: -4,
          }}
        >
          <span style={{ color: GOLD }}>TopCorner</span>
        </div>

        {/* tagline */}
        <div
          style={{
            marginTop: 30,
            fontSize: 41,
            fontWeight: 500,
            color: "#c9d0f5",
            maxWidth: 880,
            lineHeight: 1.25,
            display: "flex",
          }}
        >
          Predict the bracket. Call every match. Beat your friends.
        </div>

        {/* feature pills */}
        <div style={{ marginTop: 50, display: "flex", gap: 18 }}>
          {["Bracket", "Live picks", "Leaderboards"].map((t) => (
            <div
              key={t}
              style={{
                fontSize: 28,
                fontWeight: 600,
                padding: "13px 30px",
                borderRadius: 999,
                background: "rgba(255,217,112,0.10)",
                border: "2px solid rgba(255,217,112,0.45)",
                color: GOLD,
                display: "flex",
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* gold accent baseline */}
        <div
          style={{
            position: "absolute",
            left: 96,
            bottom: 92,
            width: 132,
            height: 8,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${GOLD}, ${GOLD_DEEP})`,
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
