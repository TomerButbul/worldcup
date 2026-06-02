import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "WorldCuP 2026 — Bracket & Prediction Game";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(800px 500px at 12% 0%, #2aa8ff66, transparent), radial-gradient(800px 500px at 90% 100%, #ff4d8d55, transparent), radial-gradient(700px 500px at 80% 10%, #18d48855, transparent), linear-gradient(135deg, #182264, #0e1545)",
          color: "#eaf3ee",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: "linear-gradient(180deg, #ffd970, #f6c453)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 800,
              color: "#04140e",
            }}
          >
            W
          </div>
          <div style={{ fontSize: 30, color: "#8fa89d", letterSpacing: 2 }}>
            BRACKET · PREDICTIONS · LEAGUES
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            display: "flex",
            gap: 24,
            fontSize: 104,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          <span>WorldCuP</span>
          <span style={{ color: "#f6c453" }}>2026</span>
        </div>

        <div style={{ marginTop: 28, fontSize: 38, color: "#cfe0d8", maxWidth: 900 }}>
          Predict the bracket, call every match, and battle your friends across three
          live leaderboards.
        </div>

        <div style={{ marginTop: 44, display: "flex", gap: 16 }}>
          {["Upfront", "Live", "Overall"].map((t) => (
            <div
              key={t}
              style={{
                fontSize: 28,
                padding: "10px 26px",
                borderRadius: 999,
                border: "2px solid #19c37d",
                color: "#2de89a",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
