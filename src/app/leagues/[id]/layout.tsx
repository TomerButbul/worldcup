import { createClient } from "@/lib/supabase/server";
import { LeagueNav } from "@/components/BottomNav";

// Wraps every page under /leagues/[id]. Fetches just the league kind (RLS hides
// the row from non-members → no nav, and the page itself redirects) so the
// bottom nav can show the right tabs: prediction sub-routes vs draft ?tab views.
export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: league } = await supabase.from("leagues").select("kind").eq("id", id).maybeSingle();

  return (
    <>
      {children}
      {league && <LeagueNav leagueId={id} kind={league.kind ?? "classic"} />}
    </>
  );
}
