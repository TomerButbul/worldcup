import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GROUP_LABELS, type Team } from "@/lib/types";
import BracketEditor from "./BracketEditor";

export default async function BracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, bracket_lock_at")
    .eq("id", id)
    .maybeSingle();
  if (!league) notFound();

  const locked = new Date(league.bracket_lock_at).getTime() <= Date.now();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, code, logo_url, group_label")
    .order("name");

  const { data: prediction } = await supabase
    .from("bracket_predictions")
    .select("group_standings, knockout, champion_team_id")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const teamList = (teams ?? []) as Team[];

  if (teamList.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-6">
        <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
          &larr; {league.name}
        </Link>
        <h1 className="font-display text-3xl text-chalk">Bracket</h1>
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          ⚽ Tournament teams haven&apos;t been loaded yet. Run the sync to import the 2026
          groups, then come back to make your picks.
        </p>
      </main>
    );
  }

  // Build per-group ordered lists. Honor any saved ordering; otherwise alphabetical.
  const savedStandings = (prediction?.group_standings ?? {}) as Record<string, number[]>;
  const byId = new Map(teamList.map((t) => [t.id, t]));
  const groups: Record<string, Team[]> = {};
  for (const label of GROUP_LABELS) {
    const inGroup = teamList.filter((t) => t.group_label === label);
    if (inGroup.length === 0) continue;
    const savedOrder = savedStandings[label];
    if (savedOrder?.length) {
      const ordered = savedOrder.map((tid) => byId.get(tid)).filter(Boolean) as Team[];
      // append any group teams missing from the saved order
      for (const t of inGroup) if (!savedOrder.includes(t.id)) ordered.push(t);
      groups[label] = ordered;
    } else {
      groups[label] = inGroup;
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-6">
      <div className="glass-strong rounded-3xl p-6">
        <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Your upfront bracket</h1>
        <p className="text-sm text-chalk-dim">
          {locked
            ? "🔒 Predictions are locked."
            : "Order each group (top 2 advance), build the knockout, and crown your champion."}
        </p>
      </div>

      <BracketEditor
        leagueId={id}
        groups={groups}
        initialKnockout={(prediction?.knockout ?? {}) as Record<string, number[]>}
        initialChampion={prediction?.champion_team_id ?? null}
        locked={locked}
      />
    </main>
  );
}
