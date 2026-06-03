import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams, getCachedPlayers } from "@/lib/tournamentData";
import type { Player } from "@/lib/types";
import MatchCard, { type MatchCardData } from "./MatchCard";
import AutoRefresh from "@/components/AutoRefresh";
import { fetchLineups } from "@/lib/apiFootball";
import { nowMs, KICKOFF_MS } from "@/lib/clock";

export default async function MatchesPage({
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
    .select("id, name, bracket_lock_at")
    .eq("id", id)
    .maybeSingle();
  if (!league) redirect("/dashboard");
  const bracketLockAt = league.bracket_lock_at as string;

  const [{ data: matches }, teams, players, { data: preds }, { data: bracket }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("id, stage, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals")
        .order("kickoff_at"),
      getCachedTeams(),
      getCachedPlayers(),
      supabase
        .from("match_predictions")
        .select("match_id, home_goals, away_goals, scorer_goals, pen_winner_team_id")
        .eq("league_id", id)
        .eq("user_id", user.id),
      supabase
        .from("bracket_predictions")
        .select("group_scores")
        .eq("league_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const playersByTeam = new Map<number, Player[]>();
  for (const p of players as (Player & { in_squad?: boolean })[]) {
    if (p.team_id == null || !p.in_squad) continue; // World Cup squad only
    if (!playersByTeam.has(p.team_id)) playersByTeam.set(p.team_id, []);
    playersByTeam.get(p.team_id)!.push(p);
  }
  const predByMatch = new Map((preds ?? []).map((p) => [p.match_id, p]));
  // The user's upfront bracket scorelines (keyed by DB match id) — shown
  // read-only on group cards, where the live game scores scorers only.
  const groupScores = (bracket?.group_scores ?? {}) as Record<string, { h: number; a: number }>;

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
  const lineupByMatch = new Map<number, Record<number, { starters: number[]; subs: number[] }>>();
  const imminent = (upcoming ?? []).filter((m) => {
    const k = new Date(m.kickoff_at).getTime();
    return k > now && k <= now + 75 * 60 * 1000;
  });
  await Promise.all(
    imminent.map(async (m) => {
      try {
        const ls = await fetchLineups(m.id);
        if (!ls.length) return;
        const byTeam: Record<number, { starters: number[]; subs: number[] }> = {};
        for (const l of ls) {
          byTeam[l.team.id] = {
            starters: l.startXI.map((x) => x.player.id),
            subs: l.substitutes.map((x) => x.player.id),
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
  const lastXIByTeam = new Map<number, { starters: number[]; subs: number[] }>();
  for (const tl of teamLineups ?? []) {
    const ids = ((tl.xi ?? []) as { player_id: number }[]).map((x) => x.player_id).filter(Boolean);
    if (ids.length) lastXIByTeam.set(tl.team_id, { starters: ids, subs: [] });
  }

  // Group upcoming by matchday so the page isn't a wall of cards: show the next
  // matchday, tuck the rest behind a "predict earlier" disclosure.
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
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
    };
  }

  function renderCard(m: NonNullable<typeof matches>[number]) {
    return (
      <MatchCard
        key={m.id}
        leagueId={id}
        match={toCard(m)}
        homePlayers={m.home_team_id ? (playersByTeam.get(m.home_team_id) ?? []) : []}
        awayPlayers={m.away_team_id ? (playersByTeam.get(m.away_team_id) ?? []) : []}
        initial={predByMatch.get(m.id) ?? null}
        bracketScore={groupScores[String(m.id)] ?? null}
        bracketLockAt={bracketLockAt}
        homeLineup={m.home_team_id ? (lineupByMatch.get(m.id)?.[m.home_team_id] ?? lastXIByTeam.get(m.home_team_id) ?? null) : null}
        awayLineup={m.away_team_id ? (lineupByMatch.get(m.id)?.[m.away_team_id] ?? lastXIByTeam.get(m.away_team_id) ?? null) : null}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <AutoRefresh enabled={now >= KICKOFF_MS} />
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Match predictions</h1>
        <p className="text-sm text-chalk-dim">
          Predict the score and goal scorers. Each match locks at kickoff. ⚡
        </p>
      </div>

      {(matches ?? []).length === 0 ? (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          ⚽ No fixtures loaded yet. Run the sync to import the schedule.
        </p>
      ) : (
        <>
          {live.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-xl text-red-600">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                Live now
              </h2>
              {live.map(renderCard)}
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
                {(firstDay?.matches ?? []).map(renderCard)}
              </section>

              {laterDays.length > 0 && (
                <details className="group space-y-3">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-2xl glass p-3 text-sm font-semibold text-gold transition hover:text-gold-bright">
                    ⏳ Predict earlier — {laterCount} more game{laterCount === 1 ? "" : "s"}
                    <span className="transition group-open:rotate-180">▾</span>
                  </summary>
                  <div className="mt-4 space-y-6">
                    {laterDays.map((d) => (
                      <section key={d.day} className="space-y-3">
                        <h3 className="font-display text-base text-chalk-dim">{d.day}</h3>
                        {d.matches.map(renderCard)}
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
              {past.map(renderCard)}
            </section>
          )}
        </>
      )}
    </main>
  );
}
