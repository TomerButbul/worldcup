import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request and gates protected routes.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // If Supabase isn't configured (e.g. running the local /preview with no keys),
  // skip auth entirely so the app doesn't crash. No effect once keys are set.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  // API routes self-authenticate (e.g. /api/sync via SYNC_SECRET) and must return
  // JSON, never an HTML redirect to /login — otherwise the cron silently 307s.
  const isApi = pathname.startsWith("/api");
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/preview") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/how-it-works") ||
    pathname.startsWith("/install") ||
    // Invite links must reach logged-out visitors: the /join route handler stashes
    // the invite_code cookie and *then* sends them to sign up. If we gated it here,
    // the proxy would redirect to /signup first and the code would be lost.
    pathname.startsWith("/join") ||
    isAuthRoute ||
    isApi;

  if (!user && !isPublic) {
    // Not signed in on a protected route (e.g. a shared /leagues/<id> link) →
    // send to sign-up. New folks get an account; existing users tap "Log in".
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    return NextResponse.redirect(url);
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
