import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import type { Team } from "@/lib/types";
import BracketEditor, { type EditorTeam } from "@/app/leagues/[id]/bracket/BracketEditor";
import { nowMs } from "@/lib/clock";
import Ball from "@/components/art/Ball";
import { Medal } from "@/components/icons";
import { primaryPredictionLeague } from "@/lib/predictionSync";
import NoPredictionLeague from "@/components/NoPredictionLeague";
import ShareBracket from "@/components/ShareBracket";

export const metadata = { title: "Your bracket" };

// Account-level upfront bracket. Resolves the user's canonical prediction league
// to read the saved order/knockout/champion from; saveBracket mirrors writes to
// every prediction league they're in.
export default async function BracketPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const league = await primaryPredictionLeague(supabase, user.id);
  if (!league) return <NoPredictionLeague title="Build your upfront bracket" />;
  const leagueId = league.id;

  const locked = new Date(league.bracket_lock_at).getTime() <= nowMs();

  const [teams, { data: prediction }, { data: profile }] = await Promise.all([
    getCachedTeams(),
    supabase
      .from("bracket_predictions")
      .select("group_order, third_qualifiers, knockout, champion_team_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("favorite_team_id, share_slug").eq("id", user.id).maybeSingle(),
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
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6 lg:max-w-[1600px] lg:p-8">
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Your upfront bracket</h1>
        <p className="text-sm text-chalk-dim">
          {locked
            ? "🔒 Predictions are locked."
            : "Order each group, pick the 8 best third-place teams, then your knockout bracket builds itself. You set this once — it counts in every league you're in."}
        </p>
        <Link
          href="/awards"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold transition hover:bg-gold/20"
        >
          <span className="inline-flex items-center gap-1.5"><Medal size={15} /> Predict individual awards →</span>
        </Link>
        {profile?.share_slug && (
          <div className="mt-4 border-t border-night/10 pt-4">
            <p className="mb-2 text-xs text-chalk-dim">
              Show off your bracket — a public link anyone can open (no account needed):
            </p>
            <ShareBracket slug={profile.share_slug} />
          </div>
        )}
      </div>

      {!hasGroups ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          <Ball size={14} className="mr-1 inline-block align-[-2px]" />Tournament teams haven&apos;t been loaded yet. Run the sync to import the 2026
          groups, then come back to make your picks.
        </p>
      ) : (
        <BracketEditor
          leagueId={leagueId}
          groups={groups}
          fifaRank={fifaRank}
          initialOrder={(prediction?.group_order ?? {}) as Record<string, number[]>}
          initialThirds={(prediction?.third_qualifiers ?? []) as string[]}
          initialKnockout={(prediction?.knockout ?? {}) as Record<string, number>}
          initialChampion={prediction?.champion_team_id ?? null}
          favoriteTeamId={profile?.favorite_team_id ?? null}
          locked={locked}
        />
      )}
    </main>
  );
}
