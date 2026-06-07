import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Flag from "@/components/Flag";
import { TeamCardButton } from "@/components/TeamCard";
import { VenueButton } from "@/components/VenueCard";
import { venueImage } from "@/lib/venues";
import HalfTime from "@/components/HalfTime";
import Ball from "@/components/art/Ball";
import Pitch, { type EventRow, type LineupRow } from "./Pitch";
import MatchPredictions from "./MatchPredictions";
import { buildPredRows, type MatchPredictionRow, type BracketPredictionRow } from "@/lib/matchPredictions";
import MatchStats, { type StatMap } from "@/components/match/MatchStats";
import MatchTimeline from "@/components/match/MatchTimeline";
import MatchCard, { type MatchCardData, type Lineup } from "../MatchCard";
import { stageLabel } from "@/lib/stages";
import { userPredictionLeagueIds } from "@/lib/predictionSync";
import { getCachedPlayers } from "@/lib/tournamentData";
import { toScorerLineup, type FormationPlayer } from "@/lib/formation";
import AutoRefresh from "@/components/AutoRefresh";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import { scoreLive, type ActualOutcomes } from "@/lib/scoring-core";
import { DEFAULT_SCORING, type ScoringConfig, type MatchStage, type Player } from "@/lib/types";

export default async function MatchSummaryPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const { id, matchId } = await params;
  const matchNum = Number(matchId);
  if (!Number.isInteger(matchNum)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, scoring, kind")
    .eq("id", id)
    .maybeSingle();
  if (!league) redirect("/dashboard");

  const { data: match } = await supabase
    .from("matches")
    .select("id, stage, kickoff_at, status, status_short, second_half_at, elapsed, home_team_id, away_team_id, home_goals, away_goals, winner_team_id, venue_id, venue_name, venue_city")
    .eq("id", matchNum)
    .maybeSingle();
  if (!match) notFound();

  // Predictions are shown from EVERYONE across all the viewer's leagues (deduped by
  // person below), not just this one — picks are account-level, so a friend you
  // share a *different* league with should still appear. Always include the current
  // league id (covers the sandbox, which userPredictionLeagueIds excludes).
  const predLeagueIds = Array.from(
    new Set([id, ...(await userPredictionLeagueIds(supabase, user.id))]),
  );

  const teamIds = [match.home_team_id, match.away_team_id].filter(
    (t): t is number => t != null,
  );

  const [{ data: teams }, { data: goals }, { data: cards }, { data: players }, { data: preds }, { data: brackets }, { data: lineupRows }, { data: eventRows }, { data: statRows }] =
    await Promise.all([
      teamIds.length
        ? supabase.from("teams").select("id, name, code, logo_url").in("id", teamIds)
        : Promise.resolve({ data: [] as { id: number; name: string; code: string | null; logo_url: string | null }[] }),
      supabase.from("match_goals").select("player_id, goals").eq("match_id", matchNum),
      supabase.from("match_cards").select("player_id, team_id, type, minute").eq("match_id", matchNum),
      teamIds.length
        ? supabase.from("players").select("id, name, team_id, photo_url, ovr").in("team_id", teamIds)
        : Promise.resolve({ data: [] as { id: number; name: string; team_id: number | null; photo_url: string | null; ovr: number | null }[] }),
      supabase
        .from("match_predictions")
        .select("user_id, home_goals, away_goals, scorer_goals, pen_winner_team_id, profiles ( display_name, team_name, avatar_url )")
        .in("league_id", predLeagueIds)
        .eq("match_id", matchNum),
      // For group matches the predicted scoreline lives in the bracket, so pull
      // every member's bracket to show what each person predicted.
      supabase
        .from("bracket_predictions")
        .select("user_id, group_scores, profiles ( display_name, team_name, avatar_url )")
        .in("league_id", predLeagueIds),
      supabase.from("match_lineups").select("team_id, formation, xi, subs").eq("match_id", matchNum),
      supabase
        .from("match_events")
        .select("team_id, type, detail, player_id, player_name, related_id, related_name, minute")
        .eq("match_id", matchNum)
        .order("sort"),
      // Per-team API-Football statistics (possession, shots, fouls…). Populated by
      // the sync job once a match is underway; the table may not exist yet, in
      // which case this simply returns no rows.
      supabase.from("match_stats").select("team_id, stats").eq("match_id", matchNum),
    ]);

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));
  // player_id → headshot + OVR, for the formation pitch.
  const photoById: Record<number, string | null> = {};
  const ovrById: Record<number, number | null> = {};
  for (const p of players ?? []) {
    photoById[p.id] = (p as { photo_url?: string | null }).photo_url ?? null;
    ovrById[p.id] = (p as { ovr?: number | null }).ovr ?? null;
  }
  const home = match.home_team_id ? teamById.get(match.home_team_id) : null;
  const away = match.away_team_id ? teamById.get(match.away_team_id) : null;
  const homeName = home?.name ?? "TBD";
  const awayName = away?.name ?? "TBD";

  const lineupByTeam = new Map((lineupRows ?? []).map((l) => [l.team_id, l]));
  const homeLineup = (match.home_team_id != null ? lineupByTeam.get(match.home_team_id) : null) ?? null;
  const awayLineup = (match.away_team_id != null ? lineupByTeam.get(match.away_team_id) : null) ?? null;

  const finished = match.status === "finished";
  const live = match.status === "live";
  const locked = new Date(match.kickoff_at).getTime() <= nowMs();
  const kickoff = new Date(match.kickoff_at).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // --- Predictor (reused on this page before kickoff) ----------------------
  // Pre-kickoff this page IS the predictor: the existing <MatchCard> needs the full
  // squad (positions), the viewer's current pick, and a scorer-picker XI. Only
  // fetched while unlocked so finished matches don't pay for it.
  let homePlayers: Player[] = [];
  let awayPlayers: Player[] = [];
  let myInitial:
    | { home_goals: number | null; away_goals: number | null; scorer_goals: Record<string, number>; pen_winner_team_id: number | null }
    | null = null;
  let homeScorerLineup: Lineup | null = null;
  let awayScorerLineup: Lineup | null = null;
  if (!locked) {
    const squad = (await getCachedPlayers()) as (Player & { in_squad?: boolean })[];
    const squadFor = (teamId: number | null): Player[] =>
      teamId == null ? [] : squad.filter((p) => p.team_id === teamId && p.in_squad);
    homePlayers = squadFor(match.home_team_id);
    awayPlayers = squadFor(match.away_team_id);

    const mine = (preds ?? []).find((p) => p.user_id === user.id);
    myInitial = mine
      ? {
          home_goals: mine.home_goals,
          away_goals: mine.away_goals,
          scorer_goals: (mine.scorer_goals ?? {}) as Record<string, number>,
          pen_winner_team_id: mine.pen_winner_team_id,
        }
      : null;

    // Scorer-picker XI: official lineup once posted, else the team's most recent XI.
    const { data: lastXIRows } = await supabase.from("team_lineups").select("team_id, xi").in("team_id", teamIds);
    const lastXIByTeam = new Map<number, Lineup>();
    for (const tl of lastXIRows ?? []) {
      const xiRaw = (tl.xi ?? []) as { player_id: number; name?: string | null; pos?: string | null; grid?: string | null }[];
      const ids = xiRaw.map((x) => x.player_id).filter(Boolean);
      if (ids.length) lastXIByTeam.set(tl.team_id, { starters: ids, subs: [], xi: xiRaw });
    }
    const scorerLineupFor = (teamId: number | null): Lineup | null =>
      teamId == null
        ? null
        : (toScorerLineup(lineupByTeam.get(teamId) as unknown as { xi: FormationPlayer[]; subs: FormationPlayer[] } | null) ??
            lastXIByTeam.get(teamId) ??
            null);
    homeScorerLineup = scorerLineupFor(match.home_team_id);
    awayScorerLineup = scorerLineupFor(match.away_team_id);
  }

  const cardData: MatchCardData = {
    id: match.id,
    stage: match.stage,
    kickoff_at: match.kickoff_at,
    status: match.status,
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    homeName,
    awayName,
    homeGoalsActual: match.home_goals,
    awayGoalsActual: match.away_goals,
    venueId: match.venue_id ?? null,
    venueName: match.venue_name ?? null,
    venueCity: match.venue_city ?? null,
  };

  // Actual goal scorers with counts (own goals/penalties-missed filtered at sync).
  const goalCounts = new Map<number, number>();
  for (const g of goals ?? []) goalCounts.set(g.player_id, (g as { goals?: number }).goals ?? 1);
  const scoredFor = (teamId: number | null) =>
    [...goalCounts.entries()]
      .map(([pid, n]) => ({ player: playerById.get(pid), n }))
      .filter((x): x is { player: { id: number; name: string; team_id: number | null; photo_url: string | null; ovr: number | null }; n: number } =>
        !!x.player && x.player.team_id === teamId);
  const homeScorers = scoredFor(match.home_team_id);
  const awayScorers = scoredFor(match.away_team_id);

  type CardRow = { player_id: number | null; team_id: number | null; type: string; minute: number | null };
  const cardLabel = (c: CardRow) => {
    const name = c.player_id != null ? (playerById.get(c.player_id)?.name ?? "Unknown") : "Unknown";
    const emoji = c.type === "red" ? "🟥" : "🟨";
    return `${emoji} ${name}${c.minute != null ? ` ${c.minute}'` : ""}`;
  };
  const homeCards = ((cards ?? []) as CardRow[]).filter((c) => c.team_id === match.home_team_id);
  const awayCards = ((cards ?? []) as CardRow[]).filter((c) => c.team_id === match.away_team_id);

  // Per-team statistics: map API-Football "type" string → value. One row per team.
  type StatRow = { team_id: number | null; stats: StatMap | null };
  const statByTeam = new Map<number, StatMap>();
  for (const row of (statRows ?? []) as StatRow[]) {
    if (row.team_id != null) statByTeam.set(row.team_id, row.stats ?? {});
  }
  const homeStats = match.home_team_id != null ? statByTeam.get(match.home_team_id) ?? null : null;
  const awayStats = match.away_team_id != null ? statByTeam.get(match.away_team_id) ?? null : null;

  const cfg = (league.scoring as ScoringConfig | null) ?? DEFAULT_SCORING;
  const decisiveWinner =
    match.home_goals != null && match.away_goals != null
      ? match.home_goals > match.away_goals
        ? match.home_team_id
        : match.home_goals < match.away_goals
          ? match.away_team_id
          : null
      : null;
  const actual: ActualOutcomes = {
    groupStandings: {},
    advancers: {},
    champion: null,
    results: new Map([
      [
        matchNum,
        {
          home: match.home_goals ?? 0,
          away: match.away_goals ?? 0,
          scorers: goalCounts,
          stage: match.stage as MatchStage,
          winner: match.winner_team_id ?? decisiveWinner,
        },
      ],
    ]),
    awards: {},
  };

  const isGroup = match.stage === "group";
  // Points only matter once the match is final; live/upcoming rows show no score.
  // Group scoring keys off the bracket (null scoreline), knockout off the pick.
  const pointsFor = finished
    ? (p: { homeGoals: number | null; awayGoals: number | null; scorerGoals: Record<string, number>; penWinnerTeamId: number | null }) =>
        isGroup
          ? scoreLive(cfg, actual, [{ match_id: matchNum, home_goals: null, away_goals: null, scorer_goals: p.scorerGoals }])
          : scoreLive(cfg, actual, [
              { match_id: matchNum, home_goals: p.homeGoals, away_goals: p.awayGoals, scorer_goals: p.scorerGoals, pen_winner_team_id: p.penWinnerTeamId },
            ])
    : undefined;
  const predRows = buildPredRows({
    matchId: matchNum,
    isGroup,
    userId: user.id,
    preds: (preds ?? []) as unknown as MatchPredictionRow[],
    brackets: (brackets ?? []) as unknown as BracketPredictionRow[],
    playerById,
    pointsFor,
  });
  const iHavePredicted = predRows.some((r) => r.isMe);

  // Events drive both the timeline and the lineup pitch overlay.
  const events = (eventRows ?? []) as unknown as EventRow[];

  const hasScorersOrCards = homeScorers.length > 0 || awayScorers.length > 0 || homeCards.length > 0 || awayCards.length > 0;

  // ---- Page sections (server-rendered, stacked by match state below) ----
  const summaryTab =
    events.length === 0 && !hasScorersOrCards ? null : (
      <section className="space-y-4">
        {events.length > 0 && (
          <MatchTimeline events={events} homeTeamId={match.home_team_id} awayTeamId={match.away_team_id} playerById={playerById} />
        )}

        {hasScorersOrCards && (
          <div className="glass rounded-2xl p-4">
            {(homeScorers.length > 0 || awayScorers.length > 0) && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 text-right text-chalk-dim">
                  {homeScorers.map((x) => (
                    <div key={x.player.id}><Ball size={13} className="mr-1 inline-block align-[-2px]" />{x.player.name}{x.n > 1 ? ` ×${x.n}` : ""}</div>
                  ))}
                </div>
                <div className="space-y-1 text-left text-chalk-dim">
                  {awayScorers.map((x) => (
                    <div key={x.player.id}>{x.player.name}{x.n > 1 ? ` ×${x.n}` : ""}<Ball size={13} className="ml-1 inline-block align-[-2px]" /></div>
                  ))}
                </div>
              </div>
            )}
            {(homeCards.length > 0 || awayCards.length > 0) && (
              <div className={`grid grid-cols-2 gap-3 text-xs ${homeScorers.length > 0 || awayScorers.length > 0 ? "mt-3 border-t border-night/5 pt-3" : ""}`}>
                <div className="space-y-1 text-right text-chalk-dim">
                  {homeCards.map((c, i) => (
                    <div key={`h-${i}`}>{cardLabel(c)}</div>
                  ))}
                </div>
                <div className="space-y-1 text-left text-chalk-dim">
                  {awayCards.map((c, i) => (
                    <div key={`a-${i}`}>{cardLabel(c)}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    );

  const lineupsTab =
    homeLineup || awayLineup ? (
      <section>
        <Pitch
          home={homeLineup as unknown as LineupRow | null}
          away={awayLineup as unknown as LineupRow | null}
          homeName={homeName}
          awayName={awayName}
          events={events}
          photoById={photoById}
          ovrById={ovrById}
        />
      </section>
    ) : null;

  // Always offer the Predictions tab pre-kickoff so a manager who hasn't picked
  // can jump straight to making one. Picks are account-level, so the CTA links to
  // the global /predict page (anchored to this match). Draft leagues don't predict.
  const predictionsTab = league.kind === "draft" ? null : (
    <section className="space-y-3">
      <h2 className="font-display text-lg text-chalk">
        {finished ? "How everyone predicted" : "Predictions"}
      </h2>

      {!locked && (
        <Link
          href={`/predict#match-${matchNum}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-4 transition hover:bg-gold/20"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-chalk">
              {iHavePredicted ? "Edit your prediction" : "Make your prediction"}
            </span>
            <span className="block text-xs text-chalk-dim">
              Pick the score &amp; goal scorers before kickoff — counts in every league.
            </span>
          </span>
          <span className="shrink-0 text-lg text-gold">&rarr;</span>
        </Link>
      )}

      {locked ? (
        predRows.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">
            No predictions were made for this match.
          </p>
        ) : (
          <MatchPredictions home={home ?? null} away={away ?? null} rows={predRows} />
        )
      ) : predRows.length > 0 ? (
        <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">
          🔒 <span className="font-semibold text-chalk">{predRows.length}</span>{" "}
          {predRows.length === 1 ? "manager has" : "managers have"} locked in a pick — everyone&apos;s
          predictions are revealed the moment this match kicks off.
        </p>
      ) : null}
    </section>
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6 lg:max-w-5xl">
      <AutoRefresh enabled={nowMs() >= KICKOFF_MS} />
      <Link href="/predict" className="text-sm text-chalk-dim hover:text-chalk">
        &larr; Matches
      </Link>

      {!locked ? (
        // Before kickoff — this page IS the predictor (existing MatchCard, embedded)
        // plus the projected XI once official lineups post (~1h out).
        <>
          <MatchCard
            leagueId={id}
            match={cardData}
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            initial={myInitial}
            homeLineup={homeScorerLineup}
            awayLineup={awayScorerLineup}
            embedded
          />
          {lineupsTab && (
            <section className="space-y-3">
              <h2 className="font-display text-lg text-chalk">Projected lineups</h2>
              {lineupsTab}
            </section>
          )}
          {league.kind !== "draft" && (
            <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">
              🔒 Everyone&apos;s predictions are revealed the moment this match kicks off.
            </p>
          )}
        </>
      ) : (
        // Live / finished — the scoreboard: score, lineups, stats, events, predictions.
        <>
          <div className="glass-strong rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 text-xs text-chalk-dim">
              <span className="font-display text-gold">{stageLabel(match.stage)}</span>
              <span className="flex items-center gap-2">
                {match.status_short === "HT" ? (
                  <HalfTime secondHalfAt={match.second_half_at} />
                ) : live ? (
                  <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-red-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
                    {match.elapsed != null ? ` ${match.elapsed}'` : ""}
                  </span>
                ) : null}
                <span className="whitespace-nowrap">{kickoff}</span>
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 text-center sm:gap-5">
              {match.home_team_id != null ? (
                <TeamCardButton
                  teamId={match.home_team_id}
                  name={homeName}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5 transition hover:opacity-80"
                >
                  <Flag teamId={match.home_team_id} logoUrl={home?.logo_url} code={home?.code} name={homeName} size={44} />
                  <span className="text-sm font-semibold text-chalk sm:text-base">{homeName}</span>
                </TeamCardButton>
              ) : (
                <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <Flag teamId={match.home_team_id} logoUrl={home?.logo_url} code={home?.code} name={homeName} size={44} />
                  <span className="text-sm font-semibold text-chalk sm:text-base">{homeName}</span>
                </span>
              )}
              <span className="net shrink-0 rounded-2xl bg-night/5 px-5 py-3 font-display text-3xl text-chalk">
                {`${match.home_goals ?? 0} – ${match.away_goals ?? 0}`}
              </span>
              {match.away_team_id != null ? (
                <TeamCardButton
                  teamId={match.away_team_id}
                  name={awayName}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5 transition hover:opacity-80"
                >
                  <Flag teamId={match.away_team_id} logoUrl={away?.logo_url} code={away?.code} name={awayName} size={44} />
                  <span className="text-sm font-semibold text-chalk sm:text-base">{awayName}</span>
                </TeamCardButton>
              ) : (
                <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <Flag teamId={match.away_team_id} logoUrl={away?.logo_url} code={away?.code} name={awayName} size={44} />
                  <span className="text-sm font-semibold text-chalk sm:text-base">{awayName}</span>
                </span>
              )}
            </div>

            {match.venue_name && (
              <div className="mt-4 flex justify-center">
                <VenueButton
                  venue={{ id: match.venue_id, name: match.venue_name, city: match.venue_city }}
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-night/5 py-0.5 pl-0.5 pr-2.5 text-[11px] text-chalk-dim transition hover:bg-night/10 hover:text-chalk"
                >
                  {match.venue_id != null && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={venueImage(match.venue_id) ?? undefined}
                      alt=""
                      width={24}
                      height={16}
                      loading="lazy"
                      className="h-4 w-6 shrink-0 rounded-full object-cover"
                    />
                  )}
                  <span className="truncate">
                    {match.venue_name}
                    {match.venue_city ? ` · ${match.venue_city}` : ""}
                  </span>
                </VenueButton>
              </div>
            )}
          </div>

          {lineupsTab && (
            <section className="space-y-3">
              <h2 className="font-display text-lg text-chalk">Lineups</h2>
              {lineupsTab}
            </section>
          )}
          <section className="space-y-3">
            <h2 className="font-display text-lg text-chalk">Stats</h2>
            <MatchStats homeStats={homeStats} awayStats={awayStats} />
          </section>
          {summaryTab && (
            <section className="space-y-3">
              <h2 className="font-display text-lg text-chalk">Match events</h2>
              {summaryTab}
            </section>
          )}
          {predictionsTab}
        </>
      )}
    </main>
  );
}
