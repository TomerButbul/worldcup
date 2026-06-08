import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TopCorner",
    short_name: "TopCorner",
    description: "TopCorner — predict the 2026 World Cup bracket, scores and goal scorers. Compete with friends.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1545",
    theme_color: "#0e1545",
    orientation: "portrait",
    // Stable identity so the OS keeps recognising the app even if the URL changes.
    id: "/",
    categories: ["sports", "games"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press app-icon shortcuts (Android / desktop PWA) jumping straight to the
    // most-used screens.
    shortcuts: [
      { name: "My bracket", short_name: "Bracket", url: "/bracket", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Live scores", short_name: "Scores", url: "/predict", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Leaderboard", short_name: "Ranks", url: "/rankings", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
    // Shown in the richer install dialog (Android / desktop).
    screenshots: [
      { src: "/screenshots/hero.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Predict the 2026 World Cup" },
      { src: "/screenshots/bracket.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Build your full bracket" },
      { src: "/screenshots/leaderboard.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow", label: "Climb the leaderboard" },
    ],
  };
}
