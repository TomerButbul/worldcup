"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { joinByCode } from "@/app/dashboard/actions";

// Accept a league invite from the public /join/[code] landing page.
//
// This replaces the old /join/[code] Route Handler. We moved off a route handler so
// the URL can serve a real HTML page carrying per-league Open Graph tags (rich link
// previews in iMessage/WhatsApp/X). The catch the old handler existed to solve —
// cookie writes are forbidden during Server Component render — is solved here
// instead: the cookie write lives in this Server Action (cookies().set IS allowed
// in Server Functions), fired by the landing's Join button. So DON'T "fix" this
// back into a page that sets the cookie at render time; that silently drops it.
//
// Behaviour is otherwise identical to the old handler:
//   • signed in  → join immediately, land in the league
//   • signed out → stash the code in `invite_code`, send to sign-up; the auth
//                  callback's consumePendingInvite() finishes the join post-auth.
//
// The code travels via a hidden <input name="code"> on the landing's Join form.
export async function acceptInvite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/dashboard?error=Invalid+invite");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const r = await joinByCode(code);
    if (r.leagueId) redirect(`/leagues/${r.leagueId}`);
    redirect(`/dashboard?error=${encodeURIComponent(r.error ?? "Invalid invite")}`);
  }

  const cookieStore = await cookies();
  cookieStore.set("invite_code", code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour — enough to finish sign-up
    secure: process.env.NODE_ENV !== "development",
  });
  redirect("/signup");
}
