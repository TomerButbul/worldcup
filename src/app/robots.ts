import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Let crawlers index the public marketing pages (/, /how-it-works) and point them
// at the sitemap. Everything else is either behind auth or a thin utility page —
// disallow it so it doesn't waste crawl budget or surface login screens in search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/join/",
        "/preview",
        "/install",
        "/dashboard",
        "/leagues",
        "/predict",
        "/bracket",
        "/awards",
        "/rankings",
        "/me",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
