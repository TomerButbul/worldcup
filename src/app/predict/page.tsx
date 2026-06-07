import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams, getCachedPlayers } from "@/lib/tournamentData";
import type { Player } from "@/lib/types";
import MatchCard, { type MatchCardData, type Lineup } from "@/app/leagues/[id]/matches/MatchCard";
import MatchPredictions from "@/app/leagues/[id]/matches/[matchId]/MatchPredictions";
import AutoRefresh from "@/components/AutoRefresh";
import Ball from "@/components/art/Ball";
import ResultCard, { type ResultCardData } from "./ResultCard";
import LiveCard from "./LiveCard";
import LiveDetailTabs from "./LiveDetailTabs";
import MatchFilter from "./MatchFilter";
import Pitch, { type LineupRow, type EventRow } from "@/app/leagues/[id]/matches/[matchId]/Pitch";
import MatchStats, { type StatMap } from "@/components/match/MatchStats";
import MatchTimeline from "@/components/match/MatchTimeline";
import { buildPredRows, type MatchPredictionRow, type BracketPredictionRow } from "@/lib/matchPredictions";
import { fetchLineups } from "@/lib/apiFootball";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import { primaryPredictionLeague, userPredictionLeagueIds } from "@/lib/predictionSync";
import NoPredictionLeague from "@/components/NoPredictionLeague";

export const metadata = { title: "Match predictions" };

// Account-level match predictions. Picks are mirrored to every prediction league
// the user is in (see savePrediction), so we resolve their canonical league only
// to READ the current picks + write against; the save fans out to all of them.
export default async function PredictPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const league = await primaryPredictionLeague(supabase, user.id);
  if (!league) return <NoPredictionLeague title="Make your match predictions" />;
  const leagueId = league.id;
  const userId = user.id; // captured so closures below don't re-widen `user` to null

  const [{ data: matches }, teams, players, { data: preds }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, stage, kickoff_at, status, elapsed, home_team_id, away_team_id, home_goals, away_goals, venue_id, venue_name, venue_city",
      )
      .lt("id", 9_000_000) // hide sentinel test fixtures (only the /sandbox page shows them)
      .order("kickoff_at"),
    getCachedTeams(),
    getCachedPlayers(),
    supabase
      .from("match_predictions")
      .select("match_id, home_goals, away_goals, scorer_goals, pen_winner_team_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id),
  ]);

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const teamById = new Map(teams.map((t) => [t.id, t])); // full team (code, logo_url) for MatchPredictions
  const playersByTeam = new Map<number, Player[]>();
  for (const p of players as (Player & { in_squad?: boolean })[]) {
    if (p.team_id == null || !p.in_squad) continue; // World Cup squad only
    if (!playersByTeam.has(p.team_id)) playersByTeam.set(p.team_id, []);
    playersByTeam.get(p.team_id)!.push(p);
  }
  const predByMatch = new Map((preds ?? []).map((p) => [p.match_id, p]));

  const now = nowMs();
  const live: typeof matches = [];
  const upcoming: typeof matches = [];
  const past: typeof matches = [];
  for (const m of matches ?? []) {
    // Finished → always Played; live → Live now; otherwise split by kickoff.
    if (m.status === "live") live.push(m);
    else if (m.status === "finished") past.push(m);
    else if (new Date(m.kickoff_at).getTime() > now) upcoming.push(m);
    else past.push(m);
  }
  past.reverse(); // most recent first
  const liveCount = live.length; // captured for the closure below (live re-widens to null inside it)
  // match id → its tab, so a /predict#match-<id> deep link opens the right tab + scrolls.
  const tabByMatchId: Record<string, "upcoming" | "live" | "played"> = {};
  for (const m of upcoming) tabByMatchId[m.id] = "upcoming";
  for (const m of live) tabByMatchId[m.id] = "live";
  for (const m of past) tabByMatchId[m.id] = "played";

  // Live games show their full details inline (lineup, score, stats, predictions),
  // so pull each one's XI + events + per-team stats, plus everyone's predictions
  // for those matches (across the viewer's leagues) and the squad photos scorers
  // need. Only paid when something is actually live.
  const liveIds = live.map((m) => m.id);
  let liveLineupRows: { match_id: number; team_id: number; formation: string | null; xi: unknown; subs: unknown }[] = [];
  let liveEventRows: { match_id: number }[] = [];
  let liveStatRows: { match_id: number; team_id: number; stats: StatMap | null }[] = [];
  let livePredRows: (MatchPredictionRow & { match_id: number })[] = [];
  let liveBracketRows: BracketPredictionRow[] = [];
  const livePlayerById = new Map<number, { id: number; name: string; team_id: number | null; photo_url: string | null }>();
  if (liveIds.length) {
    const predLeagueIds = Array.from(new Set([leagueId, ...(await userPredictionLeagueIds(supabase, user.id))]));
    const liveTeamIds = Array.from(
      new Set(live.flatMap((m) => [m.home_team_id, m.away_team_id]).filter((t): t is number => t != null)),
    );
    const [ll, le, ls, lp, lb, lpl] = await Promise.all([
      supabase.from("match_lineups").select("match_id, team_id, formation, xi, subs").in("match_id", liveIds),
      supabase
        .from("match_events")
        .select("match_id, team_id, type, detail, player_id, player_name, related_id, related_name, minute")
        .in("match_id", liveIds)
        .order("sort"),
      supabase.from("match_stats").select("match_id, team_id, stats").in("match_id", liveIds),
      supabase
        .from("match_predictions")
        .select("match_id, user_id, home_goals, away_goals, scorer_goals, pen_winner_team_id, profiles ( display_name, team_name, avatar_url )")
        .in("league_id", predLeagueIds)
        .in("match_id", liveIds),
      supabase
        .from("bracket_predictions")
        .select("user_id, group_scores, profiles ( display_name, team_name, avatar_url )")
        .in("league_id", predLeagueIds),
      liveTeamIds.length
        ? supabase.from("players").select("id, name, team_id, photo_url").in("team_id", liveTeamIds)
        : Promise.resolve({ data: [] as { id: number; name: string; team_id: number | null; photo_url: string | null }[] }),
    ]);
    liveLineupRows = (ll.data ?? []) as typeof liveLineupRows;
    liveEventRows = (le.data ?? []) as typeof liveEventRows;
    liveStatRows = (ls.data ?? []) as typeof liveStatRows;
    livePredRows = (lp.data ?? []) as unknown as typeof livePredRows;
    liveBracketRows = (lb.data ?? []) as unknown as typeof liveBracketRows;
    for (const p of (lpl.data ?? []) as { id: number; name: string; team_id: number | null; photo_url: string | null }[]) {
      livePlayerById.set(p.id, p);
    }
  }
  const liveLineupOf = (mid: number, teamId: number | null): LineupRow | null =>
    teamId == null
      ? null
      : ((liveLineupRows.find((l) => l.match_id === mid && l.team_id === teamId) as unknown as LineupRow | undefined) ?? null);
  const liveEventsOf = (mid: number): EventRow[] => liveEventRows.filter((e) => e.match_id === mid) as unknown as EventRow[];
  const liveStatsOf = (mid: number, teamId: number | null): StatMap | null =>
    teamId == null ? null : liveStatRows.find((s) => s.match_id === mid && s.team_id === teamId)?.stats ?? null;

  // Pull official lineups for matches kicking off within ~75 min so the scorer
  // picker can show the real XI + subs (falls back to full squad otherwise).
  const lineupByMatch = new Map<number, Record<number, Lineup>>();
  const imminent = (upcoming ?? []).filter((m) => {
    const k = new Date(m.kickoff_at).getTime();
    return k > now && k <= now + 75 * 60 * 1000;
  });
  await Promise.all(
    imminent.map(async (m) => {
      try {
        const ls = await fetchLineups(m.id);
        if (!ls.length) return;
        const byTeam: Record<number, Lineup> = {};
        for (const l of ls) {
          byTeam[l.team.id] = {
            starters: l.startXI.map((x) => x.player.id),
            subs: l.substitutes.map((x) => x.player.id),
            xi: l.startXI.map((x) => ({
              player_id: x.player.id,
              name: x.player.name,
              pos: x.player.pos,
              grid: x.player.grid,
            })),
          };
        }
        lineupByMatch.set(m.id, byTeam);
      } catch {
        // Lineup not posted yet — fall back to the full squad.
      }
    }),
  );

  // Fallback for the scorer picker: each team's most recent starting XI, so the
  // picker defaults to ~11 players (not the whole 28-man squad) before official
  // lineups drop. Official lineups (above) still win when posted.
  const { data: teamLineups } = await supabase.from("team_lineups").select("team_id, xi");
  const lastXIByTeam = new Map<number, Lineup>();
  for (const tl of teamLineups ?? []) {
    const xiRaw = (tl.xi ?? []) as { player_id: number; name?: string | null; pos?: string | null; grid?: string | null }[];
    const ids = xiRaw.map((x) => x.player_id).filter(Boolean);
    if (ids.length) {
      lastXIByTeam.set(tl.team_id, {
        starters: ids,
        subs: [],
        xi: xiRaw.map((x) => ({ player_id: x.player_id, name: x.name ?? null, pos: x.pos ?? null, grid: x.grid ?? null })),
      });
    }
  }

  // Group upcoming by matchday so the page isn't a wall of cards: show the next
  // matchday, tuck the rest behind a "predict earlier" disclosure.
  // Group by the tournament's North-American day so a matchday's full slate stays
  // together even when a late kickoff crosses midnight UTC (e.g. June 11's 2 games).
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "short", day: "numeric" });
  const upcomingByDay: { day: string; matches: NonNullable<typeof matches> }[] = [];
  for (const m of upcoming ?? []) {
    const day = dayLabel(m.kickoff_at);
    const last = upcomingByDay[upcomingByDay.length - 1];
    if (last && last.day === day) last.matches.push(m);
    else upcomingByDay.push({ day, matches: [m] });
  }
  function toCard(m: NonNullable<typeof matches>[number]): MatchCardData {
    return {
      id: m.id,
      stage: m.stage,
      kickoff_at: m.kickoff_at,
      status: m.status,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeName: m.home_team_id ? (teamName.get(m.home_team_id) ?? "TBD") : "TBD",
      awayName: m.away_team_id ? (teamName.get(m.away_team_id) ?? "TBD") : "TBD",
      homeGoalsActual: m.home_goals,
      awayGoalsActual: m.away_goals,
      venueId: m.venue_id ?? null,
      venueName: m.venue_name ?? null,
      venueCity: m.venue_city ?? null,
    };
  }

  function renderCard(m: NonNullable<typeof matches>[number]) {
    // id anchor + scroll-margin so the dashboard "Up next" card can deep-link
    // straight to this match (/predict#match-<id>) without the top nav covering it.
    return (
      // `min-w-0` is load-bearing: this div is the grid ITEM. Without it the item
      // keeps min-width:auto (= the card's min-content), and on the mobile single
      // `auto`-column grid that blows the column out to the widest card's content —
      // so a long venue/team name made every card in that day's grid wider. The
      // card's own overflow-hidden can't fix this (it's a descendant, not the item).
      <div key={m.id} id={`match-${m.id}`} className="min-w-0 scroll-mt-28">
        <MatchCard
          leagueId={leagueId}
          match={toCard(m)}
          homePlayers={m.home_team_id ? (playersByTeam.get(m.home_team_id) ?? []) : []}
          awayPlayers={m.away_team_id ? (playersByTeam.get(m.away_team_id) ?? []) : []}
          initial={predByMatch.get(m.id) ?? null}
          homeLineup={m.home_team_id ? (lineupByMatch.get(m.id)?.[m.home_team_id] ?? lastXIByTeam.get(m.home_team_id) ?? null) : null}
          awayLineup={m.away_team_id ? (lineupByMatch.get(m.id)?.[m.away_team_id] ?? lastXIByTeam.get(m.away_team_id) ?? null) : null}
          compactWhen
        />
      </div>
    );
  }

  function toResult(m: NonNullable<typeof matches>[number]): ResultCardData {
    const p = predByMatch.get(m.id);
    return {
      id: m.id,
      stage: m.stage,
      kickoff: m.kickoff_at,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeName: m.home_team_id ? (teamName.get(m.home_team_id) ?? "TBD") : "TBD",
      awayName: m.away_team_id ? (teamName.get(m.away_team_id) ?? "TBD") : "TBD",
      homeGoals: m.home_goals,
      awayGoals: m.away_goals,
      venueId: m.venue_id ?? null,
      venueName: m.venue_name ?? null,
      venueCity: m.venue_city ?? null,
      predHome: p?.home_goals ?? null,
      predAway: p?.away_goals ?? null,
    };
  }

  function renderLive(m: NonNullable<typeof matches>[number]) {
    const p = predByMatch.get(m.id);
    const homeName = m.home_team_id ? (teamName.get(m.home_team_id) ?? "TBD") : "TBD";
    const awayName = m.away_team_id ? (teamName.get(m.away_team_id) ?? "TBD") : "TBD";
    const homeLineup = liveLineupOf(m.id, m.home_team_id);
    const awayLineup = liveLineupOf(m.id, m.away_team_id);
    const hasLineup = !!(homeLineup || awayLineup);
    const predRows = buildPredRows({
      matchId: m.id,
      isGroup: m.stage === "group",
      userId,
      preds: livePredRows.filter((r) => r.match_id === m.id),
      brackets: liveBracketRows,
      playerById: livePlayerById,
    });
    return (
      <div key={m.id} id={`match-${m.id}`} className="scroll-mt-28">
        <LiveCard
          matchId={m.id}
          stage={m.stage}
          homeTeamId={m.home_team_id}
          awayTeamId={m.away_team_id}
          homeName={homeName}
          awayName={awayName}
          homeGoals={m.home_goals}
          awayGoals={m.away_goals}
          elapsed={m.elapsed ?? null}
          predHome={p?.home_goals ?? null}
          predAway={p?.away_goals ?? null}
          defaultOpen={liveCount === 1}
        >
          <LiveDetailTabs
            lineups={
              hasLineup ? (
                <Pitch home={homeLineup} away={awayLineup} homeName={homeName} awayName={awayName} events={liveEventsOf(m.id)} />
              ) : (
                <p className="glass rounded-2xl p-4 text-center text-xs text-chalk-dim">
                  Lineups appear once posted (~1h before kickoff).
                </p>
              )
            }
            stats={<MatchStats homeStats={liveStatsOf(m.id, m.home_team_id)} awayStats={liveStatsOf(m.id, m.away_team_id)} />}
            events={
              liveEventsOf(m.id).length > 0 ? (
                <MatchTimeline events={liveEventsOf(m.id)} homeTeamId={m.home_team_id} awayTeamId={m.away_team_id} playerById={livePlayerById} />
              ) : null
            }
            predictions={
              predRows.length ? (
                <MatchPredictions
                  home={m.home_team_id ? (teamById.get(m.home_team_id) ?? null) : null}
                  away={m.away_team_id ? (teamById.get(m.away_team_id) ?? null) : null}
                  rows={predRows}
                />
              ) : (
                <p className="glass rounded-2xl p-4 text-center text-xs text-chalk-dim">No predictions for this match.</p>
              )
            }
          />
        </LiveCard>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:max-w-[1600px] lg:p-8">
      <AutoRefresh enabled={now >= KICKOFF_MS} />
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Matches</h1>
        <p className="text-sm text-chalk-dim">
          Every game — predict the score &amp; scorers before kickoff, then follow it live. Tap a match for
          lineups, stats &amp; the live pitch. Picks count in every league.
        </p>
      </div>

      {(matches ?? []).length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          <Ball size={14} className="mr-1 inline-block align-[-2px]" />No fixtures loaded yet. Run the sync to import the schedule.
        </p>
      ) : (
        <MatchFilter
          tabByMatchId={tabByMatchId}
          upcomingCount={upcoming.length}
          liveCount={live.length}
          playedCount={past.length}
          live={<div className="space-y-4">{live.map(renderLive)}</div>}
          upcoming={
            upcoming.length === 0 ? (
              <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">No upcoming matches.</p>
            ) : (
              <div className="space-y-5">
                {upcomingByDay.map((d) => (
                  <div key={d.day} className="space-y-3">
                    <h3 className="font-display text-base text-chalk-dim">{d.day}</h3>
                    <div className="grid gap-4 lg:grid-cols-2">{d.matches.map(renderCard)}</div>
                  </div>
                ))}
              </div>
            )
          }
          played={
            past.length === 0 ? (
              <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">No games played yet.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {past.map((m) => (
                  <div key={m.id} id={`match-${m.id}`} className="min-w-0 scroll-mt-28">
                    <ResultCard leagueId={leagueId} m={toResult(m)} />
                  </div>
                ))}
              </div>
            )
          }
        />
      )}
    </main>
  );
}
