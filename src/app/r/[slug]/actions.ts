"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/lib/referral";

// Accept a referral from the public /r/<slug> landing page. We moved off a redirect-
// only route handler so the link carries real Open Graph tags (see page.tsx +
// opengraph-image.tsx) — but the cookie write that the handler did at request time now
// lives HERE, in a Server Action fired by the landing's "Join" button (cookies().set
// is allowed in Server Functions, not during page render). So DON'T fold this back
// into the page — that silently drops the referral.
//
// Logged-out → stash who referred them and send to sign-up; consumePendingReferral
// finishes the attribution post-auth (enrolling BOTH of them in the prize league).
// Logged-in → there's nothing to attribute (they already have an account); just open
// the Invitational.
export async function acceptReferral(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (slug) {
    try {
      const svc = createServiceClient();
      const { data } = await svc
        .from("profiles")
        .select("id")
        .eq("share_slug", slug)
        .maybeSingle();
      // Never self-refer; only stash a real referrer.
      if (data?.id && data.id !== user?.id) {
        const cookieStore = await cookies();
        cookieStore.set(REF_COOKIE, data.id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: REF_COOKIE_MAX_AGE,
          secure: process.env.NODE_ENV !== "development",
        });
      }
    } catch {
      // invalid/unknown slug → no cookie, still let them sign up
    }
  }

  redirect(user ? "/rankings" : "/signup?invited=1");
}
