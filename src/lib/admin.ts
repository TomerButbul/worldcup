import { CONTACT_EMAIL } from "@/lib/contest";

// Who counts as an admin (the contest Sponsor). Defaults to the owner's contact
// email so it works out of the box; override with ADMIN_EMAILS (comma-separated) in
// the environment. An unset/empty value means ONLY the default — never "everyone".
// Server-only (reads a non-public env var); call from Server Components / actions.
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? CONTACT_EMAIL)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
