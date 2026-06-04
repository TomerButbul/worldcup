import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { joinByCode } from "@/app/dashboard/actions";

// Shareable invite link: /join/<join_code>. If the visitor is already signed in
// we join them straight away and drop them in the league. Otherwise we stash the
// code in a short-lived httpOnly cookie and send them to sign up — the post-auth
// callback (and the email-confirm flow) reads that cookie and finishes the join.
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const r = await joinByCode(code);
    if (r.leagueId) redirect(`/leagues/${r.leagueId}`);
    redirect(`/dashboard?error=${encodeURIComponent(r.error ?? "Invalid invite")}`);
  }

  // Not signed in — remember the invite so we can auto-join after auth.
  const cookieStore = await cookies();
  cookieStore.set("invite_code", code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
    secure: process.env.NODE_ENV !== "development",
  });

  redirect("/signup");
}
