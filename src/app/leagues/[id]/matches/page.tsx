import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedTeams } from "@/lib/tournamentData";
import FixturesList, { type FixtureDay } from "@/components/FixturesList";
import AutoRefresh from "@/components/AutoRefresh";
import Flag from "@/components/Flag";
import Ball from "@/components/art/Ball";
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
    .select("id, name, kind")
    .eq("id", id)
    .maybeSingle();
  if (!league) redirect("/dashboard");
  if (league.kind === "draft") redirect(`/leagues/${id}`); // draft leagues follow their own bracket view

  // Follow-only view: just the fixtures + team names for the schedule and the
  // live ticker. No predictions/players/lineups — that's the /predict page.
  const [{ data: matches }, teams] = await Promise.all([
    supabase
      .from("matches")
      .select("id, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals")
      .order("kickoff_at"),
    getCachedTeams(),
  ]);

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const nameOf = (teamId: number | null) =>
    teamId ? (teamName.get(teamId) ?? "TBD") : "TBD";

  const now = nowMs();
  const live = (matches ?? []).filter((m) => m.status === "live");

  // Browsable full schedule: every match in the tournament, grouped by calendar
  // day. `matches` already arrives ordered by kickoff, so a single pass keeps
  // both days and the matches within each day in chronological order. Each row
  // is tappable straight through to its match card.
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const scheduleDays: FixtureDay[] = [];
  for (const m of matches ?? []) {
    const day = dayLabel(m.kickoff_at);
    const last = scheduleDays[scheduleDays.length - 1];
    const row = {
      id: m.id,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeName: nameOf(m.home_team_id),
      awayName: nameOf(m.away_team_id),
      homeGoals: m.home_goals,
      awayGoals: m.away_goals,
      status: m.status,
      kickoff: m.kickoff_at,
    };
    if (last && last.day === day) last.matches.push(row);
    else scheduleDays.push({ day, matches: [row] });
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <AutoRefresh enabled={now >= KICKOFF_MS} />
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href={`/leagues/${id}`} className="text-sm text-chalk-dim hover:text-chalk">
          &larr; {league.name}
        </Link>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold">Matches</h1>
        <p className="text-sm text-chalk-dim">
          Follow every game — live scores, results, and the full schedule. Tap a match for lineups,
          stats &amp; predictions.
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
              <div className="space-y-2">
                {live.map((m) => (
                  <Link
                    key={m.id}
                    href={`/leagues/${id}/matches/${m.id}`}
                    className="group glass flex items-center gap-2 rounded-2xl p-4 transition hover:bg-night/[0.03]"
                  >
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk">
                      <span className="truncate">{nameOf(m.home_team_id)}</span>
                      <Flag teamId={m.home_team_id} name={nameOf(m.home_team_id)} size={22} className="shrink-0" />
                    </span>
                    <span className="flex shrink-0 flex-col items-center px-1">
                      <span className="net rounded-xl bg-night/5 px-3 py-1 font-display text-lg text-chalk">
                        {m.home_goals ?? 0} – {m.away_goals ?? 0}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-red-600">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                        Live
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk">
                      <Flag teamId={m.away_team_id} name={nameOf(m.away_team_id)} size={22} className="shrink-0" />
                      <span className="truncate">{nameOf(m.away_team_id)}</span>
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 text-chalk-dim/60 transition group-hover:translate-x-0.5 group-hover:text-gold"
                    >
                      ›
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Full schedule — every fixture grouped by day. Upcoming rows show
              kickoff time, finished rows show the result; each taps through to
              its match card. */}
          <section className="glass rounded-2xl p-4">
            <h2 className="font-display text-chalk">Full schedule</h2>
            <p className="mb-2 mt-1 text-[11px] text-chalk-dim">
              Every fixture, grouped by day — tap any game to open its match card.
            </p>
            <FixturesList leagueId={id} days={scheduleDays} />
          </section>
        </>
      )}
    </main>
  );
}
