import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";
import MatchCard, { type MatchCardData, type Lineup } from "@/app/leagues/[id]/matches/MatchCard";
import { saveSandboxPrediction } from "./actions";
import AutoRefresh from "@/components/AutoRefresh";

// Private test harness for one account: a faithful copy of the predict/live
// experience pointed at the Canada v Ireland sandbox fixture. Gated by email;
// everything reads/writes the private Sandbox league only. Not cached (so newly
// inserted test teams/players show immediately).
export const metadata = { title: "Sandbox", robots: { index: false } };
export const dynamic = "force-dynamic";

const SANDBOX = "00000000-0000-4000-8000-000000000001";
const MATCH = 9_000_001;
const OWNER_EMAIL = "tomerbutbuleast@gmail.com";

export default async function SandboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");
  if (user.email !== OWNER_EMAIL) notFound();

  const [{ data: match }, { data: teams }, { data: players }, { data: pred }, { data: lineups }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id, stage, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals, venue_id, venue_name, venue_city")
        .eq("id", MATCH)
        .maybeSingle(),
      supabase.from("teams").select("id, name").in("id", [5529, 776]),
      supabase
        .from("players")
        .select("id, name, team_id, position, photo_url, ovr, number, in_squad")
        .in("team_id", [5529, 776])
        .eq("in_squad", true),
      supabase
        .from("match_predictions")
        .select("home_goals, away_goals, scorer_goals, pen_winner_team_id")
        .eq("league_id", SANDBOX)
        .eq("user_id", user.id)
        .eq("match_id", MATCH)
        .maybeSingle(),
      supabase.from("team_lineups").select("team_id, xi").in("team_id", [5529, 776]),
    ]);
  if (!match) notFound();

  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const byTeam = new Map<number, Player[]>();
  for (const p of (players ?? []) as Player[]) {
    if (p.team_id == null) continue;
    if (!byTeam.has(p.team_id)) byTeam.set(p.team_id, []);
    byTeam.get(p.team_id)!.push(p);
  }
  const lineupByTeam = new Map<number, Lineup>();
  for (const tl of lineups ?? []) {
    const xiRaw = (tl.xi ?? []) as { player_id: number; name?: string | null; pos?: string | null; grid?: string | null }[];
    const ids = xiRaw.map((x) => x.player_id).filter(Boolean);
    if (ids.length) lineupByTeam.set(tl.team_id, { starters: ids, subs: [], xi: xiRaw });
  }

  const homeId = match.home_team_id ?? 0;
  const awayId = match.away_team_id ?? 0;
  const card: MatchCardData = {
    id: match.id,
    stage: match.stage,
    kickoff_at: match.kickoff_at,
    status: match.status,
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    homeName: teamName.get(homeId) ?? "Canada",
    awayName: teamName.get(awayId) ?? "Ireland",
    homeGoalsActual: match.home_goals,
    awayGoalsActual: match.away_goals,
    venueId: match.venue_id ?? null,
    venueName: match.venue_name ?? null,
    venueCity: match.venue_city ?? null,
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:p-6">
      <AutoRefresh enabled />
      <div className="glass-strong rounded-3xl p-5">
        <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
          &larr; Home
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">🧪 Sandbox</h1>
        <p className="mt-1 text-sm text-chalk-dim">
          A private test match — only you can see this. Predict it, watch it kick off, and check
          your points + notifications, exactly like a real World Cup game.
        </p>
      </div>

      <MatchCard
        leagueId={SANDBOX}
        match={card}
        homePlayers={byTeam.get(homeId) ?? []}
        awayPlayers={byTeam.get(awayId) ?? []}
        initial={pred ?? null}
        homeLineup={lineupByTeam.get(homeId) ?? null}
        awayLineup={lineupByTeam.get(awayId) ?? null}
        saveAction={saveSandboxPrediction}
      />

      <Link
        href={`/leagues/${SANDBOX}/matches/${MATCH}`}
        className="block glass rounded-2xl p-4 text-center text-sm font-semibold text-gold transition hover:text-gold-bright"
      >
        Open the full live match page →
      </Link>
    </main>
  );
}
