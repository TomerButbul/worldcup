import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
import InstallPrompt from "@/components/InstallPrompt";
import { computeFavStatus } from "@/lib/favoriteStatus";
import AutoRefresh from "@/components/AutoRefresh";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import { getCachedTeams } from "@/lib/tournamentData";
import { getCachedGlobalRankings } from "@/lib/globalRankings";
import { globalRankOf } from "@/lib/globalRank";
import { SANDBOX_LEAGUE_ID, primaryPredictionLeague } from "@/lib/predictionSync";
import { predictionProgress, type BracketPredictionRow } from "@/lib/predictionProgress";
import { AWARD_KEYS } from "@/lib/scoring-core";
import { stageLabel } from "@/lib/stages";
import type { Team, Match } from "@/lib/types";
import type { ReactNode } from "react";

export const metadata = { title: "Home" };

// 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th", 21 → "21st" …
function ordinal(n: number): string {
  const r10 = n % 10;
  const r100 = n % 100;
  if (r10 === 1 && r100 !== 11) return `${n}st`;
  if (r10 === 2 && r100 !== 12) return `${n}nd`;
  if (r10 === 3 && r100 !== 13) return `${n}rd`;
  return `${n}th`;
}

// A small status pill for the prediction tiles: grass when done, gold when there's
// still something left to pick.
function PickBadge({ done = false, children }: { done?: boolean; children: ReactNode }) {
  return (
    <span
      className={`mt-0.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        done ? "bg-grass/20 text-grass" : "bg-gold/20 text-gold"
      }`}
    >
      {children}
    </span>
  );
}

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

  const [teamsRaw, globalRanks] = await Promise.all([getCachedTeams(), getCachedGlobalRankings()]);
  const teams = teamsRaw as Team[];
  const myRank = globalRankOf(globalRanks, user.id);

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
  // Read "Your pick" from the SAME canonical league /predict uses (prefer global;
  // sandbox + draft excluded). Without this, Home queried picks across ALL leagues
  // and could surface a different one — e.g. a leftover Sandbox test score — so Home
  // and Matches disagreed.
  const predLeague = await primaryPredictionLeague(supabase, user.id);

  // Pre-tournament picks progress — drives the home "finish before kickoff" nudge.
  // Bracket + awards both live in one bracket_predictions row.
  let predRow: BracketPredictionRow = null;
  if (predLeague) {
    const { data } = await supabase
      .from("bracket_predictions")
      .select("champion_team_id, knockout, group_order, awards")
      .eq("league_id", predLeague.id)
      .eq("user_id", user.id)
      .maybeSingle();
    predRow = data as unknown as BracketPredictionRow;
  }
  const picks = predictionProgress(predRow, AWARD_KEYS.length);
  const picksLocked = nowMs() >= KICKOFF_MS;
  const showPicksNudge = !!predLeague && !picksLocked && !picks.allDone;

  // The next matchday: every game on the soonest upcoming day, grouped in the
  // tournament's North-American timezone so a day's full slate stays together even
  // when a late kickoff crosses midnight UTC (e.g. June 11 keeps both its games).
  const [{ data: upcomingRows }, { data: liveMatchRows }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, stage, kickoff_at, home_team_id, away_team_id, venue_name, venue_city")
      .gt("kickoff_at", new Date(nowMs()).toISOString())
      // Skip knockout fixtures whose teams aren't set yet (no dead "TBD vs TBD").
      .not("home_team_id", "is", null)
      .not("away_team_id", "is", null)
      .lt("id", 9_000_000) // hide sentinel test fixtures
      .order("kickoff_at")
      .limit(16),
    supabase
      .from("matches")
      .select("id, stage, home_team_id, away_team_id, home_goals, away_goals, elapsed")
      .eq("status", "live")
      .lt("id", 9_000_000)
      .order("kickoff_at"),
  ]);

  const TOURNAMENT_TZ = "America/New_York";
  const dayKeyOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TOURNAMENT_TZ }).format(new Date(iso));
  const upcoming = upcomingRows ?? [];
  const nextDayKey = upcoming.length ? dayKeyOf(upcoming[0].kickoff_at) : null;
  const nextDayMatches = upcoming.filter((m) => dayKeyOf(m.kickoff_at) === nextDayKey);
  // Heading = the tournament (host) matchday date — deterministic for everyone, so the
  // group reads clearly as a tournament day. Each card shows kickoff in the viewer's zone.
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

  const liveMatchCards = (liveMatchRows ?? []).map((m) => {
    const home = m.home_team_id ? teamById.get(m.home_team_id) : null;
    const away = m.away_team_id ? teamById.get(m.away_team_id) : null;
    return {
      id: m.id,
      stage: m.stage as string,
      homeGoals: m.home_goals ?? 0,
      awayGoals: m.away_goals ?? 0,
      elapsed: m.elapsed ?? null,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeName: home?.name ?? "TBD",
      awayName: away?.name ?? "TBD",
      homeCode: home?.code ?? null,
      awayCode: away?.code ?? null,
      homeLogoUrl: home?.logo_url ?? null,
      awayLogoUrl: away?.logo_url ?? null,
    };
  });

  // One prediction lookup for the whole matchday (account-level picks).
  const predByMatch = new Map<number, { home: number; away: number }>();
  if (predLeague && nextDayMatches.length > 0) {
    const { data: myPreds } = await supabase
      .from("match_predictions")
      .select("match_id, home_goals, away_goals")
      .eq("user_id", user.id)
      .eq("league_id", predLeague.id)
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

  // One-line summary for the "Leagues & rankings" card: your worldwide position
  // (every account is on the global board) plus how many private leagues you're in.
  // Count only leagues the user actively plays — exclude the hidden Sandbox test
  // league so this matches the Leagues hub (which filters it everywhere).
  const leagueCount = friendsLeagues.filter((l) => l.id !== SANDBOX_LEAGUE_ID).length;
  const rankLine = myRank
    ? `${ordinal(myRank.rank)} of ${myRank.total.toLocaleString()} worldwide` +
      (leagueCount > 0
        ? ` · ${leagueCount} ${leagueCount === 1 ? "league" : "leagues"}`
        : " · play with friends")
    : leagueCount > 0
      ? `Standings for your ${leagueCount} ${leagueCount === 1 ? "league" : "leagues"} + the world`
      : "See where you rank — and start a league";

  // Per-tile status badges + the nudge copy. The amber "to-do" only shows while you
  // can still act; a grass ✓ stays afterward as positive confirmation.
  const bracketBadge = !predLeague ? null : picks.bracketDone ? (
    <PickBadge done>✓ Done</PickBadge>
  ) : !picksLocked ? (
    <PickBadge>{picks.bracketStarted ? "Finish" : "To do"}</PickBadge>
  ) : null;
  const awardsBadge = !predLeague ? null : picks.awardsDone ? (
    <PickBadge done>✓ Done</PickBadge>
  ) : !picksLocked ? (
    <PickBadge>
      {Math.min(picks.awardsPicked, picks.awardsTotal)}/{picks.awardsTotal}
    </PickBadge>
  ) : null;
  const need: string[] = [];
  if (!picks.bracketDone) need.push("bracket");
  if (!picks.awardsDone) need.push("awards");
  const nudgeLine =
    need.length === 2
      ? "Your bracket and award picks lock when the tournament kicks off — you can't change them after."
      : need[0] === "bracket"
        ? "Your bracket locks when the tournament kicks off — you can't change it after."
        : "Your award picks lock when the tournament kicks off — you can't change them after.";

  return (
    <main className="mx-auto w-full max-w-2xl lg:max-w-[1600px] flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <AutoRefresh enabled={nowMs() >= KICKOFF_MS} />
      {/* Nudge in-browser users to install — iOS coach floats above the nav,
          Android one-tap; self-hides once installed or dismissed. */}
      <InstallPrompt placement="home" />
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

          {showPicksNudge && (
            <Reveal>
              <div className="rounded-3xl border border-gold/40 bg-gold/10 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none">⏳</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base text-chalk">Lock in your picks before kickoff</p>
                    <p className="mt-0.5 text-sm text-chalk-dim">{nudgeLine}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!picks.bracketDone && (
                        <Link
                          href="/bracket"
                          className="inline-flex min-h-9 items-center rounded-xl bg-gradient-to-b from-gold-bright to-gold px-3.5 py-2 text-xs font-bold text-night glow-gold shine transition hover:brightness-105"
                        >
                          {picks.bracketStarted ? "Finish bracket" : "Start bracket"} →
                        </Link>
                      )}
                      {!picks.awardsDone && (
                        <Link
                          href="/awards"
                          className="inline-flex min-h-9 items-center rounded-xl bg-night/5 px-3.5 py-2 text-xs font-bold text-chalk ring-1 ring-night/10 transition hover:bg-night/10"
                        >
                          {picks.awardsPicked > 0 ? `Pick awards (${picks.awardsTotal - picks.awardsPicked} left)` : "Pick awards"} →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal>
            <NotificationToggle placement="top" />
          </Reveal>

          {liveMatchCards.length > 0 && (
            <Reveal>
              <section className="space-y-2">
                <h2 className="flex items-center gap-2 font-display text-lg">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-red-500">Live now</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {liveMatchCards.map((c) => (
                    <Link
                      key={c.id}
                      href={`/predict#match-${c.id}`}
                      className="block rounded-2xl glass p-4 transition hover:border-red-500/30 hover:bg-night/5"
                    >
                      <div className="mb-3 flex items-center justify-between text-xs">
                        <span className="font-display text-gold">{stageLabel(c.stage)}</span>
                        <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 font-bold text-red-600">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                          {c.elapsed != null ? `${c.elapsed}'` : "LIVE"}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-center">
                        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-semibold text-chalk">
                          <span className="truncate">{c.homeName}</span>
                          <Flag
                            teamId={c.homeTeamId}
                            logoUrl={c.homeLogoUrl}
                            code={c.homeCode}
                            name={c.homeName}
                            size={26}
                            className="shrink-0"
                          />
                        </span>
                        <span className="net rounded-xl bg-night/5 px-4 py-2 font-display text-lg text-chalk">
                          {c.homeGoals}–{c.awayGoals}
                        </span>
                        <span className="flex min-w-0 flex-1 items-center justify-start gap-1.5 text-sm font-semibold text-chalk">
                          <Flag
                            teamId={c.awayTeamId}
                            logoUrl={c.awayLogoUrl}
                            code={c.awayCode}
                            name={c.awayName}
                            size={26}
                            className="shrink-0"
                          />
                          <span className="truncate">{c.awayName}</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </Reveal>
          )}

          {nextDayCards.length > 0 && nextDayLabel && (
            <Reveal>
              <section className="space-y-2">
                <h2 className="font-display text-lg text-chalk">
                  Next up · <span className="text-chalk-dim">{nextDayLabel}</span>
                </h2>
                <p className="text-xs text-chalk-dim">
                  Tournament day · kickoff times shown in your local timezone
                </p>
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
                  { href: "/bracket", icon: <Trophy size={26} />, label: "Bracket", badge: bracketBadge },
                  { href: "/predict", icon: <Ball size={26} />, label: "Matches", badge: null },
                  { href: "/awards", icon: <Medal size={26} />, label: "Awards", badge: awardsBadge },
                ].map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="group glass-strong flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center transition hover:-translate-y-0.5 hover:bg-night/5"
                  >
                    <span className="text-gold">{p.icon}</span>
                    <span className="text-sm font-semibold text-chalk">{p.label}</span>
                    {p.badge}
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
              <span className="flex min-w-0 items-center gap-3">
                <span className="text-2xl">🏆</span>
                <span className="min-w-0">
                  <span className="block font-semibold text-chalk">Leagues &amp; rankings</span>
                  <span className="block truncate text-xs text-chalk-dim">{rankLine}</span>
                </span>
              </span>
              <span className="shrink-0 text-gold transition group-hover:translate-x-0.5">→</span>
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
