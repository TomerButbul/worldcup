import { createClient } from "@/lib/supabase/server";
import { GlobalNav, LeagueNav } from "@/components/BottomNav";

// Wraps every page under /leagues/[id]. Fetches just the league kind (RLS hides
// the row from non-members → no nav, and the page itself redirects). Draft leagues
// are their own game, so they keep the dedicated LeagueNav (?tab views). Everything
// else here (the match centre, a manager's picks — prediction-context detail pages)
// shows the ONE global nav, so there's no confusing parallel "in-league" mode.
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
  const isDraft = (league?.kind ?? "classic") === "draft";

  return (
    <>
      {children}
      {league && (isDraft ? <LeagueNav leagueId={id} kind="draft" /> : <GlobalNav force />)}
    </>
  );
}
