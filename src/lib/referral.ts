import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

// Referral attribution plumbing for "The TopCorner Invitational" (see
// src/lib/prizeEligibility.ts for the eligibility rule). A referral link is just a
// user's existing public share_slug under /r/<slug>; clicking it stashes the
// referrer's profile id in this cookie, and the first time the visitor lands a
// real session we record it as their `referred_by`.

export const REF_COOKIE = "ref_by";

// 7 days: generous enough that a friend who clicks today and signs up over the
// weekend is still attributed, short enough to limit stale mis-attribution.
export const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The shareable invite link for a user's public slug. */
export function referralLink(slug: string): string {
  return `${SITE_URL}/r/${slug}`;
}

// The public face of a referral link for the /r/<slug> landing page + its OG card:
// just the referrer's display name, nothing sensitive. Service client so it resolves
// for LOGGED-OUT visitors (RLS hides other profiles). cache() = one read per request
// even though generateMetadata, the OG image and the page body all ask for it.
export const getReferrerPreview = cache(async (slug: string): Promise<{ name: string } | null> => {
  const clean = (slug ?? "").replace(/[^a-zA-Z0-9]/g, "");
  if (!clean) return null;
  try {
    const db = createServiceClient();
    const { data } = await db
      .from("profiles")
      .select("display_name, team_name")
      .eq("share_slug", clean)
      .maybeSingle();
    if (!data) return null;
    return { name: (data.team_name as string) || (data.display_name as string) || "A friend" };
  } catch {
    return null;
  }
});

// Attribute a pending referral once a session exists. Mirrors consumePendingInvite:
// called from every auth entry point that creates a NEW account (email signup,
// guest upgrade, OAuth callback) — never from plain login, since referral is a
// sign-up concept. Best-effort and fully isolated so a bad/expired referral can
// never break the post-auth redirect.
//
// Rules enforced here:
//   • set referred_by only if it's still null (a referral is recorded once, never
//     overwritten — your first inviter is your inviter);
//   • never self-referral;
//   • the referrer must be a real, existing profile.
// The DB also carries a CHECK + nullable self-FK as defense in depth.
export async function consumePendingReferral(): Promise<void> {
  const cookieStore = await cookies();
  const referrerId = cookieStore.get(REF_COOKIE)?.value;
  if (!referrerId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // no session yet — leave the cookie for the next attempt

  // Self-referral or anything we can terminally resolve clears the cookie so we
  // don't keep retrying; only an unexpected error leaves it for a later auth.
  if (referrerId === user.id) {
    cookieStore.delete(REF_COOKIE);
    return;
  }

  try {
    // Service client: under RLS a brand-new user can't read another profile, and we
    // must both verify the referrer exists and write across the two rows.
    const svc = createServiceClient();
    const { data: referrer } = await svc
      .from("profiles")
      .select("id")
      .eq("id", referrerId)
      .maybeSingle();

    if (referrer?.id) {
      // .is("referred_by", null) makes this idempotent + first-wins: a second
      // referral link can never overwrite an existing attribution.
      await svc
        .from("profiles")
        .update({ referred_by: referrerId })
        .eq("id", user.id)
        .is("referred_by", null);
    }
    cookieStore.delete(REF_COOKIE);
  } catch {
    // transient — keep the cookie so a later sign-in can retry
  }
}
