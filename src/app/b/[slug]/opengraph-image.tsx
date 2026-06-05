import { ImageResponse } from "next/og";
import { getSharedBracket } from "@/lib/shareBracket";

// The teaser that unfurls when a /b/<slug> bracket link is shared. A full 32-team
// tree is illegible at 1200×630, so the card teases the climax instead — the
// predicted champion (big flag), runner-up + bronze, and a "beat my bracket" hook.
// The full tree lives on the page itself. Falls back to a branded generic card if
// the slug is unknown or the bracket is empty (never throws -> no broken preview).
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A World Cup 2026 predicted bracket — beat it if you can";

const GOLD = "#ffd970";
const GOLD_DEEP = "#f6c453";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getSharedBracket(slug);

  const name = data?.name ?? "A manager";
  const champ = data && data.view.champion != null ? data.teamsById[data.view.champion] : null;
  const runner = data && data.view.runnerUp != null ? data.teamsById[data.view.runnerUp] : null;
  const third = data && data.view.third != null ? data.teamsById[data.view.third] : null;

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
          padding: "72px 96px",
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

        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: `linear-gradient(160deg, ${GOLD}, ${GOLD_DEEP})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
            }}
          >
            ⚽
          </div>
          <div style={{ fontSize: 22, color: GOLD, letterSpacing: 5, fontWeight: 700, display: "flex" }}>
            THE 2026 PREDICTION GAME
          </div>
        </div>

        {/* who */}
        <div style={{ marginTop: 34, fontSize: 38, fontWeight: 700, color: "#dfe4ff", display: "flex" }}>
          {name}&rsquo;s World Cup 2026 bracket
        </div>

        {champ ? (
          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 36 }}>
            {champ.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- next/image can't render inside ImageResponse
              <img
                src={champ.logo_url}
                width={150}
                height={150}
                alt=""
                style={{ borderRadius: 16, objectFit: "contain", background: "rgba(255,255,255,0.96)", padding: 14 }}
              />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 26, color: GOLD, letterSpacing: 4, fontWeight: 700, display: "flex" }}>
                🏆 PREDICTED CHAMPION
              </div>
              <div style={{ fontSize: 92, fontWeight: 800, color: "#ffffff", lineHeight: 1.05, letterSpacing: -2, display: "flex", maxWidth: 760 }}>
                {champ.name}
              </div>
              <div style={{ marginTop: 6, fontSize: 30, color: "#c9d0f5", display: "flex" }}>
                {runner ? `Final vs ${runner.name}` : ""}
                {third ? `   ·   🥉 ${third.name}` : ""}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 30, fontSize: 56, fontWeight: 800, color: GOLD, display: "flex" }}>
            Bracket in progress…
          </div>
        )}

        {/* CTA pill */}
        <div style={{ marginTop: 40, display: "flex" }}>
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
            Beat my bracket →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
