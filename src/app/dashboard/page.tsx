import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { createLeague, joinLeague } from "./actions";
import GameButton from "@/components/GameButton";
import Reveal from "@/components/Reveal";
import Flag from "@/components/Flag";
import Avatar from "@/components/Avatar";
import ProfileEditor from "@/components/ProfileEditor";
import FavoriteTeamPicker from "@/components/FavoriteTeamPicker";
import FavoriteTeamStatus from "@/components/FavoriteTeamStatus";
import Countdown from "@/components/Countdown";
import NotificationToggle from "@/components/NotificationToggle";
import NextMatchCard, { type NextMatchData, type LeaguePrediction } from "@/components/NextMatchCard";
import { computeFavStatus } from "@/lib/favoriteStatus";
import AutoRefresh from "@/components/AutoRefresh";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import { getCachedTeams } from "@/lib/tournamentData";
import type { Team, Match } from "@/lib/types";

export const metadata = { title: "Home" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, team_name, avatar_url, favorite_team_id")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? "player";

  const { data: memberships } = await supabase
    .from("league_members")
    .select("role, leagues ( id, name, join_code )")
    .eq("user_id", user.id);

  const teams = (await getCachedTeams()) as Team[];

  const favId = profile?.favorite_team_id ?? null;
  let favStatus = null;
  if (favId) {
    const { data: favMatches } = await supabase
      .from("matches")
      .select("id, stage, group_label, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals")
      .or(`home_team_id.eq.${favId},away_team_id.eq.${favId}`);
    favStatus = computeFavStatus(favId, teams, (favMatches ?? []) as Match[]);
  }
  const favTeam = teams.find((t) => t.id === favId) ?? null;

  const leagues = (memberships ?? [])
    .map((m) => ({ role: m.role, ...(m.leagues as unknown as { id: string; name: string; join_code: string }) }))
    .filter((l) => l.id);

  // Soonest match still open for prediction (kickoff in the future), tournament-wide.
  const { data: nextMatchRows } = await supabase
    .from("matches")
    .select("id, stage, kickoff_at, home_team_id, away_team_id")
    .gt("kickoff_at", new Date(nowMs()).toISOString())
    // Skip knockout fixtures whose teams aren't set yet, so "Up next" never
    // shows a dead "TBD vs TBD" card with a Predict link that goes nowhere.
    .not("home_team_id", "is", null)
    .not("away_team_id", "is", null)
    .order("kickoff_at")
    .limit(1);
  const nextMatch = nextMatchRows?.[0] ?? null;

  let nextMatchData: NextMatchData | null = null;
  let nextPredictions: LeaguePrediction[] = [];
  if (nextMatch) {
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const home = nextMatch.home_team_id ? teamById.get(nextMatch.home_team_id) : null;
    const away = nextMatch.away_team_id ? teamById.get(nextMatch.away_team_id) : null;
    nextMatchData = {
      stage: nextMatch.stage,
      kickoff_at: nextMatch.kickoff_at,
      homeTeamId: nextMatch.home_team_id,
      awayTeamId: nextMatch.away_team_id,
      homeName: home?.name ?? "TBD",
      awayName: away?.name ?? "TBD",
      homeCode: home?.code ?? null,
      awayCode: away?.code ?? null,
      homeLogoUrl: home?.logo_url ?? null,
      awayLogoUrl: away?.logo_url ?? null,
    };

    if (leagues.length > 0) {
      if (nextMatch.stage === "group") {
        // Group: the predicted scoreline lives in each league's bracket.
        const { data: myBrackets } = await supabase
          .from("bracket_predictions")
          .select("league_id, group_scores")
          .eq("user_id", user.id);
        const gsByLeague = new Map(
          (myBrackets ?? []).map((b) => [
            b.league_id,
            (b.group_scores ?? {}) as Record<string, { h: number; a: number }>,
          ]),
        );
        nextPredictions = leagues.map((l) => {
          const gs = gsByLeague.get(l.id)?.[String(nextMatch.id)];
          return {
            leagueId: l.id,
            leagueName: l.name,
            pred: gs ? { home: gs.h, away: gs.a } : null,
          };
        });
      } else {
        const { data: myPreds } = await supabase
          .from("match_predictions")
          .select("league_id, home_goals, away_goals")
          .eq("user_id", user.id)
          .eq("match_id", nextMatch.id);
        const predByLeague = new Map((myPreds ?? []).map((p) => [p.league_id, p]));
        nextPredictions = leagues.map((l) => {
          const p = predByLeague.get(l.id);
          return {
            leagueId: l.id,
            leagueName: l.name,
            pred: p && p.home_goals != null ? { home: p.home_goals, away: p.away_goals } : null,
          };
        });
      }
    }
  }

  const inputClass =
    "w-full rounded-xl border border-night/10 bg-white px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <AutoRefresh enabled={nowMs() >= KICKOFF_MS} />
      <Reveal>
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar url={profile?.avatar_url} name={profile?.team_name || displayName} size={52} />
            <div className="min-w-0">
              <h1 className="flex min-w-0 items-center gap-2 font-display text-2xl text-gradient-gold sm:text-3xl">
                {favTeam && (
                  <Flag teamId={favTeam.id} logoUrl={favTeam.logo_url} code={favTeam.code} name={favTeam.name} size={28} />
                )}
                <span className="truncate">{profile?.team_name || displayName}</span>
              </h1>
              <p className="truncate text-sm text-chalk-dim">
                {profile?.team_name ? `Managed by ${displayName}` : "Welcome back"}
              </p>
            </div>
          </div>
          <form action={logout} className="shrink-0">
            <button className="rounded-lg px-3 py-2 text-sm text-chalk-dim transition hover:bg-night/5 hover:text-chalk">
              Log out
            </button>
          </form>
        </header>
      </Reveal>

      <Reveal>
        <div className="glass-strong rounded-3xl p-5 sm:p-6">
          <Countdown />
        </div>
      </Reveal>

      <Reveal>
        <NotificationToggle placement="top" />
      </Reveal>

      {nextMatchData && (
        <Reveal>
          <section className="space-y-3">
            <h2 className="font-display text-lg text-chalk">Up next</h2>
            <NextMatchCard match={nextMatchData} predictions={nextPredictions} />
          </section>
        </Reveal>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg text-chalk">Your Leagues</h2>
        {leagues.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">
            No leagues yet. Create one or join with a code below.
          </p>
        ) : (
          <ul className="space-y-2">
            {leagues.map((l, i) => (
              <Reveal key={l.id} index={i}>
                <Link
                  href={`/leagues/${l.id}`}
                  className="group flex items-center justify-between rounded-2xl glass p-4 transition hover:border-grass/50 hover:bg-night/5"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <span className="font-semibold text-chalk">{l.name}</span>
                  </span>
                  <span className="rounded-lg bg-night/5 px-2 py-1 font-mono text-xs text-gold">
                    {l.join_code}
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Reveal index={1}>
          <form action={createLeague} className="glass-strong space-y-3 rounded-2xl p-5">
            <h2 className="font-display text-chalk">Create a league</h2>
            <input name="name" required placeholder="League name" aria-label="League name" className={inputClass} />
            <GameButton type="submit" variant="primary" className="w-full">
              Create
            </GameButton>
          </form>
        </Reveal>

        <Reveal index={2}>
          <form action={joinLeague} className="glass-strong space-y-3 rounded-2xl p-5">
            <h2 className="font-display text-chalk">Join a league</h2>
            <input
              name="join_code"
              required
              placeholder="JOIN CODE"
              aria-label="Join code"
              className={`${inputClass} font-mono uppercase tracking-widest`}
            />
            <GameButton type="submit" variant="gold" className="w-full">
              Join
            </GameButton>
          </form>
        </Reveal>
      </div>

      <Reveal>
        <Link
          href="/rankings"
          className="group flex items-center justify-between rounded-2xl glass-strong p-4 transition hover:border-gold/50 hover:bg-night/5"
        >
          <span className="flex items-center gap-3">
            <span className="text-2xl">🌍</span>
            <span>
              <span className="block font-semibold text-chalk">Global rankings</span>
              <span className="block text-xs text-chalk-dim">See how you stack up against every player</span>
            </span>
          </span>
          <span className="text-gold transition group-hover:translate-x-0.5">→</span>
        </Link>
      </Reveal>

      {favStatus && (
        <Reveal>
          <FavoriteTeamStatus status={favStatus} />
        </Reveal>
      )}

      <Reveal>
        <FavoriteTeamPicker teams={teams} current={favId} />
      </Reveal>

      <Reveal>
        <ProfileEditor
          userId={user.id}
          displayName={displayName}
          teamName={profile?.team_name ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />
      </Reveal>

      <Reveal>
        <NotificationToggle placement="bottom" />
      </Reveal>

      <p className="pt-2 text-center text-xs text-chalk-dim">
        <Link href="/how-it-works" className="hover:text-chalk">
          ℹ️ How it works &amp; scoring
        </Link>
      </p>
    </main>
  );
}
