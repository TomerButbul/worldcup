// Validate a `next` redirect target so it can only point back into our own
// site. Without this, a crafted ?next=//evil.com (or https://evil.com) on the
// auth callback could bounce a freshly-authenticated user off-site.
export function safeRelativePath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next) return fallback;
  // Must start with a single "/" and not "//" or "/\" (protocol-relative or
  // backslash tricks browsers normalize to an absolute URL).
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.startsWith("/\\")) return fallback;
  return next;
}
