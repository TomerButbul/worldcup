import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedGlobalRankings } from "@/lib/globalRankings";
import { getCachedTeams } from "@/lib/tournamentData";
import { SANDBOX_LEAGUE_ID } from "@/lib/predictionSync";
import { referralLink } from "@/lib/referral";
import { nowMs } from "@/lib/clock";
import type { LeaderboardRow } from "@/app/leagues/[id]/Leaderboard";
import RankingsHub, { type LeagueBoard } from "./RankingsHub";

// Per-user (it lists YOUR private leagues) + the realtime league boards, so this
// renders fresh each request.
export const dynamic = "force-dynamic";
export const metadata = { title: "Leagues" };

type LeagueRow = {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
  kind: string | null;
  is_global: boolean | null;
  bracket_lock_at: string;
};

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; error?: string }>;
}) {
  const { league: leagueParam, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const [ranks, teams, { data: memberships }, { data: prizeLeague }, { data: meProfile }] =
    await Promise.all([
      getCachedGlobalRankings(),
      getCachedTeams(),
      supabase
        .from("league_members")
        .select("leagues ( id, name, join_code, owner_id, kind, is_global, bracket_lock_at )")
        .eq("user_id", user.id),
      // Defensive: pre-migration the is_prize column doesn't exist — supabase returns
      // an error (not a throw), so prizeLeague stays null and the feature stays dark.
      supabase.from("leagues").select("id").eq("is_prize", true).maybeSingle(),
      supabase.from("profiles").select("share_slug").eq("id", user.id).maybeSingle(),
    ]);
  const slimTeams = teams.map((t) => ({ id: t.id, name: t.name, code: t.code, logo_url: t.logo_url }));
  const prizeLeagueId = (prizeLeague as { id: string } | null)?.id ?? null;
  const referralSlug = (meProfile as { share_slug: string | null } | null)?.share_slug ?? null;
  const myReferralLink = referralSlug ? referralLink(referralSlug) : null;
  // Server-computed so the client hub doesn't call Date.now() in render (hydration-safe).
  const lockDays = Math.ceil((Date.parse("2026-06-11T19:00:00Z") - nowMs()) / 86_400_000);
  const lockRel =
    lockDays > 1 ? `in ${lockDays} days` : lockDays === 1 ? "tomorrow" : lockDays === 0 ? "today" : null;

  // Your private (friend) leagues = prediction leagues you're in, minus the global
  // World league (that's the Global board) and the sandbox test league.
  const friend: LeagueRow[] = [];
  // Draft leagues are a different game (their own room + 3-pot standings); we
  // surface them as link-pills in the switcher rather than inline boards.
  const drafts: { id: string; name: string }[] = [];
  for (const m of (memberships ?? []) as { leagues: LeagueRow | LeagueRow[] | null }[]) {
    const lg = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
    if (!lg) continue;
    if (lg.id === SANDBOX_LEAGUE_ID || lg.is_global) continue;
    if ((lg.kind ?? "classic") === "draft") {
      drafts.push({ id: lg.id, name: lg.name });
      continue;
    }
    friend.push(lg);
  }
  // Feature the prize league first; everything else alphabetical.
  friend.sort(
    (a, b) =>
      Number(b.id === prizeLeagueId) - Number(a.id === prizeLeagueId) || a.name.localeCompare(b.name),
  );
  drafts.sort((a, b) => a.name.localeCompare(b.name));

  const leagues: LeagueBoard[] = await Promise.all(
    friend.map(async (lg) => {
      const { data: scores } = await supabase
        .from("scores")
        .select(
          "user_id, upfront_points, live_points, total_points, profiles ( display_name, team_name, avatar_url, favorite_team_id )",
        )
        .eq("league_id", lg.id)
        .order("total_points", { ascending: false });
      const rows: LeaderboardRow[] = (scores ?? []).map((s) => {
        const p = s.profiles as unknown as {
          display_name: string;
          team_name: string | null;
          avatar_url: string | null;
          favorite_team_id: number | null;
        };
        return {
          user_id: s.user_id,
          name: p?.team_name || p?.display_name || "?",
          avatarUrl: p?.avatar_url ?? null,
          favTeamId: p?.favorite_team_id ?? null,
          upfront: s.upfront_points,
          live: s.live_points,
          total: s.total_points,
        };
      });
      return {
        id: lg.id,
        name: lg.name,
        joinCode: lg.join_code,
        isOwner: lg.owner_id === user.id,
        locked: new Date(lg.bracket_lock_at).getTime() <= nowMs(),
        isPrize: lg.id === prizeLeagueId,
        rows,
      };
    }),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:max-w-5xl lg:p-8">
      <RankingsHub
        meId={user.id}
        teams={slimTeams}
        global={ranks}
        leagues={leagues}
        drafts={drafts}
        referralLink={myReferralLink}
        prizeExists={!!prizeLeagueId}
        lockRel={lockRel}
        initialLeagueId={leagueParam ?? null}
        error={error ?? null}
      />
    </main>
  );
}
