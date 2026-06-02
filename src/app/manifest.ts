import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WorldCuP 2026",
    short_name: "WorldCuP",
    description: "Predict the 2026 World Cup bracket and match results. Compete with friends.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1545",
    theme_color: "#0e1545",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
