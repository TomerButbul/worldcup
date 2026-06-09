import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import type { Team } from "@/lib/types";
import BracketEditor, { type EditorTeam } from "@/app/leagues/[id]/bracket/BracketEditor";
import { nowMs, knockoutLockMs } from "@/lib/clock";
import { bracketLockState } from "@/lib/bracketLock";
import ResetBracketButton from "@/components/ResetBracketButton";
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

  const [teams, { data: prediction }, { data: profile }, { data: koMatch }] = await Promise.all([
    getCachedTeams(),
    supabase
      .from("bracket_predictions")
      .select(
        "group_order, third_qualifiers, knockout, champion_team_id, submitted_at, reset_at, original_bracket",
      )
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("favorite_team_id, share_slug").eq("id", user.id).maybeSingle(),
    // First knockout kickoff = the Round-of-32 lock (null until those fixtures sync).
    supabase
      .from("matches")
      .select("kickoff_at")
      .neq("stage", "group")
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const kickoffMs = new Date(league.bracket_lock_at).getTime();
  const state = bracketLockState({
    now: nowMs(),
    kickoffMs,
    knockoutLockMs: knockoutLockMs(
      koMatch?.kickoff_at ? new Date(koMatch.kickoff_at as string).getTime() : null,
    ),
    submittedAtMs: prediction?.submitted_at ? new Date(prediction.submitted_at as string).getTime() : null,
    resetAtMs: prediction?.reset_at ? new Date(prediction.reset_at as string).getTime() : null,
    hasGroupBracket: !!(prediction?.group_order && Object.keys(prediction.group_order).length),
  });
  // The editor is read-only whenever the bracket isn't currently editable for this
  // player (committed + locked at kickoff, or everyone after R32).
  const locked = !state.knockoutEditable;
  const afterKickoff = nowMs() >= kickoffMs;
  const orig = (prediction?.original_bracket ?? null) as {
    group_order?: Record<string, number[]>;
    third_qualifiers?: string[];
    knockout?: Record<string, number>;
    champion_team_id?: number | null;
  } | null;

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

      {/* Second-chance + late-joiner status */}
      {state.canReset && (
        <div className="glass rounded-3xl border border-gold/30 p-5 sm:p-6">
          <p className="font-semibold text-chalk">🔄 Second chance</p>
          <p className="mt-1 text-sm text-chalk-dim">
            Groups didn&rsquo;t go your way? Forfeit your group-stage points to re-open your knockout
            bracket and re-pick it on the real field — editable right up to the Round of 32, scoring
            in full. Your original bracket is kept so you can still look back on it.
          </p>
          <div className="mt-3">
            <ResetBracketButton leagueId={leagueId} />
          </div>
        </div>
      )}

      {state.inReset && (
        <div className="glass rounded-3xl border border-grass/40 p-5 sm:p-6">
          <p className="font-semibold text-chalk">✅ Second chance active</p>
          <p className="mt-1 text-sm text-chalk-dim">
            Your knockout is open to edit until the Round of 32 and scores in full; group-stage points
            are forfeited. Edit below — and scroll down to revisit your original bracket.
          </p>
        </div>
      )}

      {!state.committed && !state.inReset && state.knockoutEditable && afterKickoff && (
        <div className="glass rounded-3xl border border-gold/40 p-5 sm:p-6">
          <p className="font-semibold text-chalk">You&rsquo;re not too late 🙌</p>
          <p className="mt-1 text-sm text-chalk-dim">
            Groups are only ~13% of the game — and the knockout, where it&rsquo;s won, is fully open to
            you until the Round of 32. Build your bracket below; it scores in full.
          </p>
        </div>
      )}

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

      {state.inReset && orig && hasGroups && (
        <details className="glass rounded-3xl p-5 sm:p-6">
          <summary className="cursor-pointer font-semibold text-chalk">
            📜 Your original bracket — for the memories (doesn&rsquo;t score)
          </summary>
          <div className="mt-4">
            <BracketEditor
              leagueId={leagueId}
              groups={groups}
              fifaRank={fifaRank}
              initialOrder={orig.group_order ?? {}}
              initialThirds={orig.third_qualifiers ?? []}
              initialKnockout={orig.knockout ?? {}}
              initialChampion={orig.champion_team_id ?? null}
              favoriteTeamId={profile?.favorite_team_id ?? null}
              locked={true}
            />
          </div>
        </details>
      )}
    </main>
  );
}
