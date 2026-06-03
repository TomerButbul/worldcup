import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "World Cup 2026",
    short_name: "World Cup",
    description: "Predict the 2026 World Cup bracket and match results. Compete with friends.",
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
  };
}
