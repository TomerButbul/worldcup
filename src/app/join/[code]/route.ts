import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { joinByCode } from "@/app/dashboard/actions";

// Shareable invite link: GET /join/<join_code>.
//
// This is a Route Handler (not a page) on purpose: it must WRITE the invite
// cookie, and cookie writes are not allowed during Server Component rendering —
// only in Route Handlers / Server Functions. (Next docs, cookies.md: "HTTP does
// not allow setting cookies after streaming starts, so you must use .set in a
// Server Function or Route Handler.") The earlier page.tsx version silently
// dropped the cookie, breaking auto-join.
//
// If the visitor is already signed in we join them and drop them in the league.
// Otherwise we stash the code in a short-lived httpOnly cookie and send them to
// sign up; the post-auth callback (auth/callback/route.ts) reads that cookie and
// finishes the join.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const { origin } = new URL(request.url);

  // Behind Vercel's proxy the request origin is internal; trust x-forwarded-host
  // in production so we redirect to the real public URL (mirrors auth/callback).
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal ? origin : forwardedHost ? `https://${forwardedHost}` : origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const r = await joinByCode(code);
    if (r.leagueId) return NextResponse.redirect(`${base}/leagues/${r.leagueId}`);
    return NextResponse.redirect(
      `${base}/dashboard?error=${encodeURIComponent(r.error ?? "Invalid invite")}`,
    );
  }

  // Not signed in — remember the invite so the auth callback can auto-join after
  // sign-up/login, then send them to sign up.
  const cookieStore = await cookies();
  cookieStore.set("invite_code", code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
    secure: !isLocal,
  });

  return NextResponse.redirect(`${base}/signup`);
}
