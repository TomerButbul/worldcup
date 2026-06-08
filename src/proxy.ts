import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16: this file replaces middleware.ts (Proxy convention).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except static assets, images, the PWA files (manifest +
    // service worker), and the generated metadata images — those must be served
    // directly, not routed through the auth session handler (which would 307 a
    // logged-out request to /signup). That gating silently broke the homepage's
    // og:image for social scrapers (they're never logged in), so the share card
    // had no image. Nested OG routes (/b, /join) stay matched but are allow-listed.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|xml|webmanifest)$).*)",
  ],
};
