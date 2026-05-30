"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveProfile(fields: {
  display_name?: string;
  team_name?: string | null;
  avatar_url?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const update: Record<string, string | null> = {};
  if (fields.display_name !== undefined) {
    const name = fields.display_name.trim();
    if (!name) return { ok: false, error: "Name can't be empty" };
    update.display_name = name;
  }
  if (fields.team_name !== undefined) {
    update.team_name = fields.team_name?.trim() || null;
  }
  if (fields.avatar_url !== undefined) {
    update.avatar_url = fields.avatar_url;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveFavoriteTeam(teamId: number | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ favorite_team_id: teamId })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/dashboard?error=Name+required");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_league", { p_name: name });
  if (error) redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);

  redirect(`/leagues/${data}`);
}

export async function joinLeague(formData: FormData) {
  const code = String(formData.get("join_code") ?? "").trim();
  if (!code) redirect("/dashboard?error=Join+code+required");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_league_by_code", {
    p_code: code,
  });
  if (error) redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);

  redirect(`/leagues/${data}`);
}
