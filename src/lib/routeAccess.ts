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
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/how-it-works") ||
    pathname.startsWith("/install") ||
    // The "scan to play" page is meant to be shown to logged-out people (that's
    // the whole point of a QR you point at strangers).
    pathname === "/qr" ||
    // Invite links must reach logged-out visitors: the /join route handler stashes
    // the invite_code cookie and *then* sends them to sign up. If we gated it here,
    // the proxy would redirect to /signup first and the code would be lost.
    pathname.startsWith("/join") ||
    // Public read-only bracket shares (/b/<slug>) — must reach logged-out visitors;
    // that's the whole point of a share link. The trailing slash is deliberate so we
    // don't accidentally make the auth-gated /bracket page public.
    pathname.startsWith("/b/") ||
    isAuthPath(pathname) ||
    // API routes self-authenticate (e.g. /api/sync via SYNC_SECRET) and must return
    // JSON, never an HTML redirect to /login — otherwise the cron silently 307s.
    pathname.startsWith("/api")
  );
}
