import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import type { Team } from "@/lib/types";
import BracketEditor, { type EditorTeam } from "./BracketEditor";
import { nowMs } from "@/lib/clock";
import Ball from "@/components/art/Ball";

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
  if (!user) redirect("/signup");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, bracket_lock_at, kind")
    .eq("id", id)
    .maybeSingle();
  if (!league) redirect("/dashboard");
  if (league.kind === "draft") redirect(`/leagues/${id}`); // draft leagues don't predict

  const locked = new Date(league.bracket_lock_at).getTime() <= nowMs();

  const [teams, { data: prediction }] = await Promise.all([
    getCachedTeams(),
    supabase
      .from("bracket_predictions")
      .select("group_order, third_qualifiers, knockout, champion_team_id")
      .eq("league_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const teamList = teams as (Team & { fifa_rank: number | null })[];

  // Bucket the 48 teams into their 12 groups (A..L), 4 teams each, keyed by
  // group_label. Order within a group doesn't matter here — the editor seeds the
  // predicted order from the saved row (or FIFA rank).
  const groups: Record<string, EditorTeam[]> = {};
  for (const t of teamList) {
    if (!t.group_label) continue;
    (groups[t.group_label] ??= []).push({
      id: t.id,
      name: t.name,
      code: t.code,
      logo_url: t.logo_url,
      fifa_rank: t.fifa_rank,
    });
  }

  const fifaRank: Record<number, number> = {};
  for (const t of teamList) if (t.fifa_rank != null) fifaRank[t.id] = t.fifa_rank;

  const hasGroups = Object.keys(groups).length > 0;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6">
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Your upfront bracket</h1>
        <p className="text-sm text-chalk-dim">
          {locked
            ? "🔒 Predictions are locked."
            : "Order each group, pick the 8 best third-place teams, then your knockout bracket builds itself. Match scores are predicted live during the tournament."}
        </p>
        <Link
          href={`/leagues/${id}/awards`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold transition hover:bg-gold/20"
        >
          🏅 Predict individual awards →
        </Link>
      </div>

      {!hasGroups ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          <Ball size={14} className="mr-1 inline-block align-[-2px]" />Tournament teams haven&apos;t been loaded yet. Run the sync to import the 2026
          groups, then come back to make your picks.
        </p>
      ) : (
        <BracketEditor
          leagueId={id}
          groups={groups}
          fifaRank={fifaRank}
          initialOrder={(prediction?.group_order ?? {}) as Record<string, number[]>}
          initialThirds={(prediction?.third_qualifiers ?? []) as string[]}
          initialKnockout={(prediction?.knockout ?? {}) as Record<string, number>}
          initialChampion={prediction?.champion_team_id ?? null}
          locked={locked}
        />
      )}
    </main>
  );
}
