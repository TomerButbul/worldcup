"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function renameLeague(leagueId: string, rawName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = rawName.trim();
  if (name.length < 2 || name.length > 50) {
    return { ok: false, error: "Name must be 2–50 characters" };
  }

  // RLS ("owner updates league") is the real gate — a non-owner's update
  // matches zero rows. We check ownership explicitly so a non-owner gets a
  // clear message instead of a silent no-op.
  const { data: league } = await supabase
    .from("leagues")
    .select("owner_id")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) return { ok: false, error: "League not found" };
  if (league.owner_id !== user.id) {
    return { ok: false, error: "Only the league owner can rename it" };
  }

  const { error } = await supabase.from("leagues").update({ name }).eq("id", leagueId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath("/dashboard");
  return { ok: true, name };
}
