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
  };
}
