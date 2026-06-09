import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/lib/referral";

// Public referral landing: /r/<share_slug>. A friend clicks an invite link, we
// stash WHO referred them in the `ref_by` cookie, and send them to sign up; the
// post-auth consumePendingReferral() records it as their referred_by. Must reach
// logged-OUT visitors (see routeAccess.isPublicPath), exactly like /join.
//
// We resolve the slug -> referrer id here (service client, since a logged-out
// visitor can't read another profile under RLS). An unknown slug just drops the
// cookie and still sends them to sign up — a broken link should never dead-end.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { origin } = new URL(request.url);
  // Behind Vercel's proxy the request origin is internal; trust x-forwarded-host in
  // production so we redirect to the real public URL (mirrors auth/callback, /match).
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal ? origin : forwardedHost ? `https://${forwardedHost}` : origin;

  const res = NextResponse.redirect(`${base}/signup?invited=1`);

  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("profiles")
      .select("id")
      .eq("share_slug", slug)
      .maybeSingle();
    if (data?.id) {
      res.cookies.set(REF_COOKIE, data.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: REF_COOKIE_MAX_AGE,
        secure: process.env.NODE_ENV !== "development",
      });
    }
  } catch {
    // unknown/invalid slug — fall through to a plain sign-up redirect
  }

  return res;
}
