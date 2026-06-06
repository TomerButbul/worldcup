import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createLeague, joinLeague } from "./actions";
import GameButton from "@/components/GameButton";
import Reveal from "@/components/Reveal";
import Flag from "@/components/Flag";
import Trophy from "@/components/art/Trophy";
import Ball from "@/components/art/Ball";
import { Medal } from "@/components/icons";
import Avatar from "@/components/Avatar";
import FavoriteTeamStatus from "@/components/FavoriteTeamStatus";
import Countdown from "@/components/Countdown";
import NotificationToggle from "@/components/NotificationToggle";
import NextMatchCard, { type NextMatchData } from "@/components/NextMatchCard";
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
    .select("display_name, team_name, avatar_url, favorite_team_id, notif_prefs, share_slug")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? "player";

  const { data: memberships } = await supabase
    .from("league_members")
    .select("role, leagues ( id, name, join_code, kind, is_global )")
    .eq("user_id", user.id);

  const teams = (await getCachedTeams()) as Team[];

  const favId = profile?.favorite_team_id ?? null;
  let favStatus = null;
  if (favId) {
    const { data: favMatches } = await supabase
      .from("matches")
      .select("id, stage, group_label, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals")
      .or(`home_team_id.eq.${favId},away_team_id.eq.${favId}`)
      .lt("id", 9_000_000); // hide sentinel test fixtures
    favStatus = computeFavStatus(favId, teams, (favMatches ?? []) as Match[]);
  }
  const favTeam = teams.find((t) => t.id === favId) ?? null;

  const leagues = (memberships ?? [])
    .map((m) => ({ role: m.role, ...(m.leagues as unknown as { id: string; name: string; join_code: string; kind: string; is_global?: boolean }) }))
    .filter((l) => l.id);
  // The global "World" league is auto-joined for every account — hide it from the
  // friends-league list (it's surfaced via Rankings instead).
  const friendsLeagues = leagues.filter((l) => !l.is_global);
  // Draft leagues are a separate game — never prompt them for score predictions.
  // Global counts as a prediction league, so everyone can always predict.
  const predictionLeagues = leagues.filter((l) => l.kind !== "draft");

  // The next matchday: every game on the soonest upcoming day, grouped in the
  // tournament's North-American timezone so a day's full slate stays together even
  // when a late kickoff crosses midnight UTC (e.g. June 11 keeps both its games).
  const { data: upcomingRows } = await supabase
    .from("matches")
    .select("id, stage, kickoff_at, home_team_id, away_team_id, venue_name, venue_city")
    .gt("kickoff_at", new Date(nowMs()).toISOString())
    // Skip knockout fixtures whose teams aren't set yet (no dead "TBD vs TBD").
    .not("home_team_id", "is", null)
    .not("away_team_id", "is", null)
    .lt("id", 9_000_000) // hide sentinel test fixtures
    .order("kickoff_at")
    .limit(16);

  const TOURNAMENT_TZ = "America/New_York";
  const dayKeyOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TOURNAMENT_TZ }).format(new Date(iso));
  const upcoming = upcomingRows ?? [];
  const nextDayKey = upcoming.length ? dayKeyOf(upcoming[0].kickoff_at) : null;
  const nextDayMatches = upcoming.filter((m) => dayKeyOf(m.kickoff_at) === nextDayKey);
  const nextDayLabel =
    nextDayMatches.length > 0
      ? new Date(nextDayMatches[0].kickoff_at).toLocaleDateString("en-US", {
          timeZone: TOURNAMENT_TZ,
          weekday: "long",
          month: "short",
          day: "numeric",
        })
      : null;

  const canPredict = predictionLeagues.length > 0;
  const teamById = new Map(teams.map((t) => [t.id, t]));

  // One prediction lookup for the whole matchday (account-level picks).
  const predByMatch = new Map<number, { home: number; away: number }>();
  if (canPredict && nextDayMatches.length > 0) {
    const { data: myPreds } = await supabase
      .from("match_predictions")
      .select("match_id, home_goals, away_goals")
      .eq("user_id", user.id)
      .in("match_id", nextDayMatches.map((m) => m.id))
      .not("home_goals", "is", null);
    for (const p of myPreds ?? []) {
      if (p.home_goals != null) predByMatch.set(p.match_id, { home: p.home_goals, away: p.away_goals ?? 0 });
    }
  }

  const nextDayCards = nextDayMatches.map((m) => {
    const home = m.home_team_id ? teamById.get(m.home_team_id) : null;
    const away = m.away_team_id ? teamById.get(m.away_team_id) : null;
    const data: NextMatchData = {
      stage: m.stage,
      kickoff_at: m.kickoff_at,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeName: home?.name ?? "TBD",
      awayName: away?.name ?? "TBD",
      homeCode: home?.code ?? null,
      awayCode: away?.code ?? null,
      homeLogoUrl: home?.logo_url ?? null,
      awayLogoUrl: away?.logo_url ?? null,
      venueName: (m as { venue_name?: string | null }).venue_name ?? null,
      venueCity: (m as { venue_city?: string | null }).venue_city ?? null,
    };
    return { id: m.id, data, prediction: predByMatch.get(m.id) ?? null };
  });

  const inputClass =
    "w-full rounded-xl border border-night/10 bg-white px-3 py-2.5 text-sm text-chalk outline-none placeholder:text-chalk-dim focus:border-grass focus:ring-2 focus:ring-grass/30";

  // Create / join forms — rendered prominently when you have no friends-league
  // yet (onboarding), else tucked behind a disclosure so Home stays calm.
  const leagueForms = (
    <div className="grid gap-3 sm:grid-cols-2">
      <form action={createLeague} className="glass-strong space-y-3 rounded-2xl p-4">
        <h3 className="font-display text-chalk">Create a league</h3>
        <input name="name" required placeholder="League name" aria-label="League name" className={inputClass} />
        <GameButton type="submit" variant="primary" className="w-full">
          Create
        </GameButton>
      </form>
      <form action={joinLeague} className="glass-strong space-y-3 rounded-2xl p-4">
        <h3 className="font-display text-chalk">Join a league</h3>
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
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-2xl lg:max-w-[1600px] flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <AutoRefresh enabled={nowMs() >= KICKOFF_MS} />
      <Reveal>
        <header>
          {/* Tap your avatar/name → Profile & settings (account controls moved off Home). */}
          <Link
            href="/profile"
            aria-label="Open your profile and settings"
            className="group -m-1 flex min-w-0 items-center gap-3 rounded-2xl p-1 transition hover:bg-night/5"
          >
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
                <span className="text-gold transition group-hover:text-gold-bright"> · Profile &amp; settings →</span>
              </p>
            </div>
          </Link>
        </header>
      </Reveal>

      {/* Desktop: two-column layout — primary content left, secondary sidebar right */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start">
        {/* Primary column */}
        <div className="space-y-4 sm:space-y-6">
          <Reveal>
            <div className="glass-strong rounded-3xl p-4 sm:p-6">
              <Countdown />
            </div>
          </Reveal>

          <Reveal>
            <NotificationToggle placement="top" />
          </Reveal>

          {nextDayCards.length > 0 && nextDayLabel && (
            <Reveal>
              <section className="space-y-2">
                <h2 className="font-display text-lg text-chalk">
                  Next up · <span className="text-chalk-dim">{nextDayLabel}</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {nextDayCards.map((c) => (
                    <NextMatchCard
                      key={c.id}
                      match={c.data}
                      matchId={c.id}
                      prediction={c.prediction}
                      canPredict={canPredict}
                      leagueId={friendsLeagues[0]?.id ?? leagues.find((l) => l.is_global)?.id}
                    />
                  ))}
                </div>
              </section>
            </Reveal>
          )}

          {/* Predictions — set once, count everywhere. A compact strip; also the
              only home for Awards, which has no nav tab of its own. */}
          <Reveal>
            <section className="space-y-2">
              <h2 className="font-display text-lg text-chalk">Your predictions</h2>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { href: "/bracket", icon: <Trophy size={26} />, label: "Bracket" },
                  { href: "/predict", icon: <Ball size={26} />, label: "Matches" },
                  { href: "/awards", icon: <Medal size={26} />, label: "Awards" },
                ].map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="group glass-strong flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center transition hover:-translate-y-0.5 hover:bg-night/5"
                  >
                    <span className="text-gold">{p.icon}</span>
                    <span className="text-sm font-semibold text-chalk">{p.label}</span>
                  </Link>
                ))}
              </div>
              <p className="px-1 text-xs text-chalk-dim">
                Set once — <span className="text-chalk">no league needed</span>. They count on the global rankings and in every league you join.
              </p>
            </section>
          </Reveal>

          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <section id="leagues" className="scroll-mt-24 space-y-2">
            <h2 className="font-display text-lg text-chalk">Your Leagues</h2>
            {friendsLeagues.length === 0 ? (
              <div className="space-y-3">
                <p className="glass rounded-2xl p-5 text-center text-sm text-chalk-dim">
                  No leagues yet — create one or join with a code. Your picks already count on the
                  global rankings.
                </p>
                {leagueForms}
              </div>
            ) : (
              <div className="space-y-3">
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {friendsLeagues.map((l, i) => (
                    <Reveal key={l.id} index={i}>
                      <Link
                        href={l.kind === "draft" ? `/leagues/${l.id}` : `/rankings?league=${l.id}`}
                        className="group flex items-center justify-between rounded-2xl glass p-3.5 transition hover:border-grass/50 hover:bg-night/5"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Trophy size={22} />
                          <span className="truncate font-semibold text-chalk">{l.name}</span>
                        </span>
                        <span className="ml-2 shrink-0 rounded-lg bg-night/5 px-2 py-1 font-mono text-xs text-gold">
                          {l.join_code}
                        </span>
                      </Link>
                    </Reveal>
                  ))}
                </ul>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-2xl glass p-3 text-sm font-semibold text-gold transition hover:text-gold-bright">
                    + Create or join another league
                    <span className="transition group-open:rotate-180">▾</span>
                  </summary>
                  <div className="mt-3">{leagueForms}</div>
                </details>
              </div>
            )}
          </section>
        </div>

        {/* Secondary / aside column — slim: what's happening, not settings.
            (Profile, favourite-team picker, notifications & support live on /profile.) */}
        <div className="mt-4 space-y-4 lg:mt-0">
          {favStatus && (
            <Reveal>
              <FavoriteTeamStatus status={favStatus} />
            </Reveal>
          )}

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
        </div>
      </div>

      <p className="pt-2 text-center text-xs text-chalk-dim">
        <Link href="/how-it-works" className="hover:text-chalk">
          ℹ️ How it works &amp; scoring
        </Link>
      </p>
    </main>
  );
}
