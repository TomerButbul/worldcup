import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The per-league schedule is now the global Tournament → Fixtures tab — every
// league sees the same tournament, so there's no need for a per-league copy. This
// route just forwards there (draft leagues keep their own fixtures tab) so old
// links, bookmarks and deep-links keep working.
export default async function MatchesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");
  const { data: league } = await supabase.from("leagues").select("kind").eq("id", id).maybeSingle();
  if (league && (league.kind ?? "classic") === "draft") redirect(`/leagues/${id}?tab=fixtures`);
  redirect("/predict");
}
