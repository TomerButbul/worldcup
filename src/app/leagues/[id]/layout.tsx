import { createClient } from "@/lib/supabase/server";
import { GlobalNav } from "@/components/BottomNav";

// Wraps every page under /leagues/[id]. Every in-league page — including the draft
// room — now shows the ONE global app nav (so you can always jump Home/Rankings/…
// and never get stranded in a parallel "in-league" bar). The draft room supplies
// its own section tabs (Standings/Squads/Groups/Bracket/Fixtures) at the top.
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
      {league && <GlobalNav force />}
    </>
  );
}
