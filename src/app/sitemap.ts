import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the genuinely public, content-bearing pages belong here — everything else
// is behind auth (the proxy bounces logged-out crawlers to /signup) and is
// excluded in robots.ts. Keep this in sync with isPublicPath in routeAccess.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
