import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams, getCachedPlayers } from "@/lib/tournamentData";
import type { Player } from "@/lib/types";
import MatchCard, { type MatchCardData, type Lineup } from "@/app/leagues/[id]/matches/MatchCard";
import AutoRefresh from "@/components/AutoRefresh";
import MatchClock from "@/components/art/MatchClock";
import Ball from "@/components/art/Ball";
import { fetchLineups } from "@/lib/apiFootball";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import { primaryPredictionLeague } from "@/lib/predictionSync";
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

  const [{ data: matches }, teams, players, { data: preds }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, stage, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals, venue_id, venue_name, venue_city",
      )
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
    // A kicked-off-but-not-finished match must not fall under "Played".
    if (m.status === "live") live.push(m);
    else if (new Date(m.kickoff_at).getTime() > now) upcoming.push(m);
    else past.push(m);
  }
  past.reverse(); // most recent first

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
  const [firstDay, ...laterDays] = upcomingByDay;
  const laterCount = laterDays.reduce((s, d) => s + d.matches.length, 0);

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
      <div key={m.id} id={`match-${m.id}`} className="scroll-mt-28">
        <MatchCard
          leagueId={leagueId}
          match={toCard(m)}
          homePlayers={m.home_team_id ? (playersByTeam.get(m.home_team_id) ?? []) : []}
          awayPlayers={m.away_team_id ? (playersByTeam.get(m.away_team_id) ?? []) : []}
          initial={predByMatch.get(m.id) ?? null}
          homeLineup={m.home_team_id ? (lineupByMatch.get(m.id)?.[m.home_team_id] ?? lastXIByTeam.get(m.home_team_id) ?? null) : null}
          awayLineup={m.away_team_id ? (lineupByMatch.get(m.id)?.[m.away_team_id] ?? lastXIByTeam.get(m.away_team_id) ?? null) : null}
        />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:max-w-[1600px] lg:p-8">
      <AutoRefresh enabled={now >= KICKOFF_MS} />
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
          &larr; Home
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Match predictions</h1>
        <p className="text-sm text-chalk-dim">
          Predict the score and goal scorers. You set these once — they count in every
          league you&apos;re in. Each match locks at kickoff.
        </p>
      </div>

      {(matches ?? []).length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          <Ball size={14} className="mr-1 inline-block align-[-2px]" />No fixtures loaded yet. Run the sync to import the schedule.
        </p>
      ) : (
        <>
          {live.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-xl text-red-600">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                Live now
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {live.map(renderCard)}
              </div>
            </section>
          )}

          {upcoming.length === 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-xl text-chalk">Upcoming</h2>
              <p className="text-sm text-chalk-dim">No upcoming matches.</p>
            </section>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="font-display text-xl text-chalk">
                  Upcoming · <span className="text-chalk-dim">{firstDay?.day}</span>
                </h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {(firstDay?.matches ?? []).map(renderCard)}
                </div>
              </section>

              {laterDays.length > 0 && (
                <details className="group space-y-3">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-2xl glass p-3 text-sm font-semibold text-gold transition hover:text-gold-bright">
                    <MatchClock size={15} /> Predict earlier — {laterCount} more game{laterCount === 1 ? "" : "s"}
                    <span className="transition group-open:rotate-180">▾</span>
                  </summary>
                  <div className="mt-4 space-y-6">
                    {laterDays.map((d) => (
                      <section key={d.day} className="space-y-3">
                        <h3 className="font-display text-base text-chalk-dim">{d.day}</h3>
                        <div className="grid gap-4 lg:grid-cols-2">
                          {d.matches.map(renderCard)}
                        </div>
                      </section>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-xl text-chalk">Played</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {past.map(renderCard)}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
