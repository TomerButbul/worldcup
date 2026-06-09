import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRelativePath } from "@/lib/safe-redirect";
import { consumePendingInvite } from "@/app/dashboard/actions";
import { consumePendingReferral } from "@/lib/referral";

// OAuth providers (e.g. Google) redirect here with a `code` after the user
// authorizes. We exchange it for a session, which @supabase/ssr writes to
// cookies on this response, then send the user into the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=Could+not+sign+in`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Behind Vercel's proxy the request origin is internal; trust x-forwarded-host
  // in production so we redirect to the real public URL.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal ? origin : forwardedHost ? `https://${forwardedHost}` : origin;
  // Recovery links pass ?next=/reset-password; OAuth has no `next` → /dashboard.
  const next = safeRelativePath(searchParams.get("next"));

  // Pending league invite (set by /join/[code] before sign-up): now that a
  // session exists, finish the auto-join and head straight into that league.
  // Best-effort and fully isolated — a bad/expired invite must never break the
  // normal sign-in redirect.
  try {
    const invitedLeagueId = await consumePendingInvite();
    if (invitedLeagueId) return NextResponse.redirect(`${base}/leagues/${invitedLeagueId}`);
  } catch {
    // ignore — fall through to the default redirect below
  }

  return NextResponse.redirect(`${base}${next}`);
}
