"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Permanently delete the signed-in user's account and ALL their data. Deleting the
// auth.users row cascades through every foreign key (profiles → picks, scores, league
// memberships, leagues they own, push subscriptions), so a single admin call leaves no
// orphaned rows. The user id always comes from the session — a caller can only ever
// delete THEIR OWN account, never someone else's.
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    redirect(
      "/profile?error=" +
        encodeURIComponent("Couldn't delete your account — please try again, or email support."),
    );
  }

  // Clear the now-orphaned session cookie, then land on a plain confirmation.
  await supabase.auth.signOut();
  redirect("/login?info=" + encodeURIComponent("Your account and all your data have been deleted."));
}
