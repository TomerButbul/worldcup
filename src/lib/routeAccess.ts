// Which routes the auth proxy lets through, as pure pathname predicates.
//
// These were inlined inside the proxy's updateSession(); they're extracted here
// so the allow-list is unit-testable. A missing entry fails silently in prod
// (logged-out users get bounced to /signup before the real route runs) — exactly
// how invite links broke once — so the test suite guards this list directly.

// Auth screens. Logged-IN users get redirected away from these (→ /dashboard).
export function isAuthPath(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/signup");
}

// Routes a logged-OUT visitor may reach without being bounced to sign-up.
// Keep this in sync whenever you add a pre-auth page (landing, legal, invites…).
export function isPublicPath(pathname: string): boolean {
  return (
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
    isAuthPath(pathname) ||
    // API routes self-authenticate (e.g. /api/sync via SYNC_SECRET) and must return
    // JSON, never an HTML redirect to /login — otherwise the cron silently 307s.
    pathname.startsWith("/api")
  );
}
