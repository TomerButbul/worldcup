import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import { liveGroupStandings } from "@/lib/tournament-standings";
import { resolveActualBracket } from "@/lib/actual-bracket";
import { topScorers, topAssists, topCleanSheets } from "@/lib/tournament-stats";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import TournamentHub from "./TournamentHub";

// Live tournament data ticks as the sync job runs, so this page is always
// rendered fresh (it also reads cookies via the auth check, which opts out of
// caching anyway). Tournament-wide reads use the cookie-free service client so
// every viewer shares the same query plan regardless of their RLS scope.
export const dynamic = "force-dynamic";
export const metadata = { title: "Tournament" };

export default async function TournamentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const svc = createServiceClient();
  const [{ data: matchesRaw }, teams, { data: goalsRaw }, { data: assistsRaw }, { data: gkRaw }] =
    await Promise.all([
      svc
        .from("matches")
        .select(
          "id, stage, group_label, kickoff_at, status, elapsed, home_team_id, away_team_id, home_goals, away_goals, winner_team_id, venue_name, venue_city",
        )
        .lt("id", 9_000_000) // hide sentinel test fixtures (the Sandbox dress-rehearsal game)
        .order("kickoff_at"),
      getCachedTeams(),
      svc.from("match_goals").select("player_id, goals").lt("match_id", 9_000_000),
      // Only rows with an assist — keeps the result well under PostgREST's 1000-row
      // cap (there are ~26×2×104 appearance rows over a full tournament).
      svc.from("match_player_stats").select("player_id, assists").gt("assists", 0).lt("match_id", 9_000_000),
      // Goalkeepers (id + nation) → the Golden Glove board. Few rows (~3 per team).
      svc.from("players").select("id, team_id").eq("position", "Goalkeeper"),
    ]);

  const matches = matchesRaw ?? [];
  const teamList = teams as {
    id: number;
    name: string;
    code: string | null;
    logo_url: string | null;
    group_label: string | null;
    fifa_rank: number | null;
  }[];

  const fifaRankRecord: Record<number, number> = {};
  for (const t of teamList) if (t.fifa_rank != null) fifaRankRecord[t.id] = t.fifa_rank;

  // Live group tables (every team shown, updates as games play).
  const standings = liveGroupStandings(
    matches.map((m) => ({
      stage: m.stage,
      group_label: m.group_label,
      status: m.status,
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      home_goals: m.home_goals,
      away_goals: m.away_goals,
    })),
    teamList.map((t) => ({ id: t.id, group_label: t.group_label, fifa_rank: t.fifa_rank })),
    new Map(Object.entries(fifaRankRecord).map(([id, r]) => [Number(id), r])),
    true, // count in-progress games provisionally so the table moves as goals go in
  );

  // The real knockout bracket, resolved from actual results.
  const bracket = resolveActualBracket(
    matches.map((m) => ({
      id: m.id,
      stage: m.stage,
      group_label: m.group_label,
      status: m.status,
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      home_goals: m.home_goals,
      away_goals: m.away_goals,
      winner_team_id: m.winner_team_id,
    })),
    new Map(Object.entries(fifaRankRecord).map(([id, r]) => [Number(id), r])),
  );

  // Top scorers / assists → join the player ids back to a name + team (the photo
  // comes free from the media CDN via <PlayerAvatar>).
  const scorerRanks = topScorers(goalsRaw ?? []).slice(0, 25);
  const assistRanks = topAssists(assistsRaw ?? []).slice(0, 25);

  // Golden Glove — keepers' clean sheets. Pull ONLY keepers' appearance rows
  // (filtered to their ids) so the result stays well under the 1000-row cap, then
  // tally finished shutouts against the match results we already fetched.
  const gkRows = (gkRaw ?? []) as { id: number; team_id: number | null }[];
  const gkIds = gkRows.map((g) => g.id);
  let cleanSheetRanks: { playerId: number; count: number }[] = [];
  if (gkIds.length > 0) {
    const { data: gkApps } = await svc
      .from("match_player_stats")
      .select("player_id, match_id, minutes")
      .gt("minutes", 0)
      .in("player_id", gkIds)
      .lt("match_id", 9_000_000);
    const teamOf = new Map<number, number | null>(gkRows.map((g) => [g.id, g.team_id]));
    const matchById = new Map(
      matches.map((m) => [
        m.id,
        {
          home_team_id: m.home_team_id,
          away_team_id: m.away_team_id,
          home_goals: m.home_goals,
          away_goals: m.away_goals,
          status: m.status,
        },
      ]),
    );
    cleanSheetRanks = topCleanSheets(gkApps ?? [], teamOf, matchById).slice(0, 25);
  }

  const pidSet = new Set<number>([
    ...scorerRanks.map((r) => r.playerId),
    ...assistRanks.map((r) => r.playerId),
    ...cleanSheetRanks.map((r) => r.playerId),
  ]);
  const playerInfo = new Map<number, { name: string; team_id: number | null }>();
  if (pidSet.size > 0) {
    const { data: pl } = await svc.from("players").select("id, name, team_id").in("id", [...pidSet]);
    for (const p of pl ?? []) playerInfo.set(p.id, { name: p.name, team_id: p.team_id });
  }
  const joinLeader = (rows: { playerId: number; count: number }[]) =>
    rows.map((r) => ({
      playerId: r.playerId,
      count: r.count,
      name: playerInfo.get(r.playerId)?.name ?? `#${r.playerId}`,
      teamId: playerInfo.get(r.playerId)?.team_id ?? null,
    }));

  const liveCount = matches.filter((m) => m.status === "live").length;
  const hasResults = matches.some((m) => m.status !== "scheduled");

  // In-progress group games → rendered as a live scoreline above their group's
  // table (the standings above already fold in the provisional points).
  const liveGroupMatches = matches
    .filter((m) => m.status === "live" && m.stage === "group" && m.group_label)
    .map((m) => ({
      group: m.group_label as string,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeGoals: m.home_goals ?? 0,
      awayGoals: m.away_goals ?? 0,
      elapsed: m.elapsed ?? null,
    }));

  // Per-round date windows for the (mostly empty) knockout bracket. Every knockout
  // fixture is seeded with a kickoff even before its teams are known, so grouping
  // by stage → min/max kickoff tells viewers WHEN each round is played. Formatted
  // date-only in UTC on the server → one stable string, no client-tz hydration drift.
  const KO_STAGES = ["round_of_32", "round_of_16", "quarter", "semi", "third_place", "final"];
  const fmtDay = (ms: number) =>
    new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const roundDates: Record<string, string> = {};
  for (const stage of KO_STAGES) {
    const ks = matches
      .filter((m) => m.stage === stage && m.kickoff_at)
      .map((m) => new Date(m.kickoff_at as string).getTime())
      .filter((n) => Number.isFinite(n));
    if (ks.length === 0) continue;
    const lo = fmtDay(Math.min(...ks));
    const hi = fmtDay(Math.max(...ks));
    roundDates[stage] = lo === hi ? lo : `${lo} – ${hi}`;
  }

  return (
    <TournamentHub
      teams={teamList.map((t) => ({ id: t.id, name: t.name, code: t.code, logo_url: t.logo_url }))}
      standings={standings}
      liveMatches={liveGroupMatches}
      scorers={joinLeader(scorerRanks)}
      assisters={joinLeader(assistRanks)}
      keepers={joinLeader(cleanSheetRanks)}
      bracketRounds={bracket.rounds}
      champion={bracket.champion}
      fifaRank={fifaRankRecord}
      roundDates={roundDates}
      liveCount={liveCount}
      hasResults={hasResults}
      started={nowMs() >= KICKOFF_MS}
    />
  );
}
