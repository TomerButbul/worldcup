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
import MatchTabs from "./MatchTabs";
import { stageLabel } from "@/lib/stages";
import { userPredictionLeagueIds } from "@/lib/predictionSync";
import AutoRefresh from "@/components/AutoRefresh";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import { scoreLive, type ActualOutcomes } from "@/lib/scoring-core";
import { DEFAULT_SCORING, type ScoringConfig, type MatchStage } from "@/lib/types";
import InfoTip from "@/components/InfoTip";
import type { ReactNode } from "react";

interface PredProfile {
  display_name: string;
  team_name: string | null;
  avatar_url: string | null;
}

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
  type StatMap = Record<string, string | number | null>;
  type StatRow = { team_id: number | null; stats: StatMap | null };
  const statByTeam = new Map<number, StatMap>();
  for (const row of (statRows ?? []) as StatRow[]) {
    if (row.team_id != null) statByTeam.set(row.team_id, row.stats ?? {});
  }
  const homeStats = match.home_team_id != null ? statByTeam.get(match.home_team_id) ?? null : null;
  const awayStats = match.away_team_id != null ? statByTeam.get(match.away_team_id) ?? null : null;
  const hasStats = !!homeStats || !!awayStats;

  // Numeric value for the proportional bars (strips "%"; 0 when absent).
  const num = (v: string | number | null | undefined): number => {
    if (v == null) return 0;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  };

  // Rows of the stats comparison, in display order, with clean labels (the raw
  // API keys are verbose). "—" stands in for any key a side hasn't reported.
  const STAT_ROWS: { key: string; label: string }[] = [
    { key: "Total Shots", label: "Shots" },
    { key: "Shots on Goal", label: "Shots on target" },
    { key: "Shots insidebox", label: "Shots inside box" },
    { key: "Corner Kicks", label: "Corners" },
    { key: "Fouls", label: "Fouls" },
    { key: "Offsides", label: "Offsides" },
    { key: "Goalkeeper Saves", label: "Saves" },
    { key: "Passes accurate", label: "Accurate passes" },
    { key: "Passes %", label: "Pass accuracy" },
    { key: "Yellow Cards", label: "Yellow cards" },
    { key: "Red Cards", label: "Red cards" },
  ];
  const statVal = (s: StatMap | null, key: string) => {
    const v = s?.[key];
    return v == null || v === "" ? "—" : String(v);
  };

  // One Google-style stat row: the label centred with each side's value at the
  // ends, over a proportional two-sided bar (home = grass from the left, away =
  // electric from the right). The leader's value + bar segment are brighter.
  const statBar = (label: ReactNode, key: string) => {
    const hr = statVal(homeStats, key);
    const ar = statVal(awayStats, key);
    const h = num(homeStats?.[key]);
    const a = num(awayStats?.[key]);
    const tot = h + a;
    const hPct = tot > 0 ? (h / tot) * 100 : 50;
    const hLead = h > a;
    const aLead = a > h;
    return (
      <div key={key} className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={`w-12 shrink-0 tabular-nums font-bold ${hLead ? "text-grass" : "text-chalk"}`}>{hr}</span>
          <span className="flex-1 text-center text-[11px] text-chalk-dim">{label}</span>
          <span className={`w-12 shrink-0 text-right tabular-nums font-bold ${aLead ? "text-electric" : "text-chalk"}`}>{ar}</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-night/10">
          <span className={`h-full transition-all ${hLead ? "bg-grass" : "bg-grass/35"}`} style={{ width: `${hPct}%` }} />
          <span className={`h-full transition-all ${aLead ? "bg-electric" : "bg-electric/35"}`} style={{ width: `${100 - hPct}%` }} />
        </div>
      </div>
    );
  };

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
  const nameOf = (prof: PredProfile | null) => prof?.team_name || prof?.display_name || "?";
  // Predicted scorers with counts + headshots, for the prediction detail modal.
  const scorersOf = (sg: Record<string, number>) =>
    Object.entries(sg ?? {})
      .map(([pid, n]) => {
        const p = playerById.get(Number(pid));
        return p
          ? { name: p.name, count: n, photo: (p as { photo_url?: string | null }).photo_url ?? null, teamId: p.team_id }
          : null;
      })
      .filter((s): s is { name: string; count: number; photo: string | null; teamId: number | null } => !!s);

  interface PredRow {
    userId: string;
    name: string;
    avatarUrl: string | null;
    score: string | null;
    homeGoals: number | null;
    awayGoals: number | null;
    penWinnerTeamId: number | null;
    scorers: { name: string; count: number; photo: string | null; teamId: number | null }[];
    points: number | null;
    isMe: boolean;
  }

  let predRows: PredRow[];
  if (isGroup) {
    // Group: the prediction is the bracket scoreline + any live scorer picks.
    const predByUser = new Map((preds ?? []).map((p) => [p.user_id, p]));
    predRows = (brackets ?? [])
      .map((b): PredRow | null => {
        const prof = b.profiles as unknown as PredProfile | null;
        const mp = predByUser.get(b.user_id);
        const gsRaw = (b.group_scores as Record<string, { h: number; a: number }> | null)?.[String(matchNum)];
        // Fall back to the live match_predictions scoreline when the upfront bracket
        // has no group score for this match (e.g. the sandbox fixture, which isn't
        // part of anyone's 72-game bracket).
        const gs =
          gsRaw ?? (mp?.home_goals != null && mp?.away_goals != null ? { h: mp.home_goals, a: mp.away_goals } : null);
        const sg = (mp?.scorer_goals ?? {}) as Record<string, number>;
        if (!gs && Object.keys(sg).length === 0) return null; // no prediction for this match
        return {
          userId: b.user_id,
          name: nameOf(prof),
          avatarUrl: prof?.avatar_url ?? null,
          score: gs ? `${gs.h}–${gs.a}` : null,
          homeGoals: gs?.h ?? null,
          awayGoals: gs?.a ?? null,
          penWinnerTeamId: mp?.pen_winner_team_id ?? null,
          scorers: scorersOf(sg),
          points: finished
            ? scoreLive(cfg, actual, [{ match_id: matchNum, home_goals: null, away_goals: null, scorer_goals: sg }])
            : null,
          isMe: b.user_id === user.id,
        };
      })
      .filter((r): r is PredRow => r !== null);
  } else {
    // Knockout: the prediction is the live score + scorers.
    predRows = (preds ?? []).map((p): PredRow => {
      const sg = (p.scorer_goals ?? {}) as Record<string, number>;
      return {
        userId: p.user_id,
        name: nameOf(p.profiles as unknown as PredProfile | null),
        avatarUrl: (p.profiles as unknown as PredProfile | null)?.avatar_url ?? null,
        score:
          p.home_goals != null
            ? `${p.home_goals}–${p.away_goals}${
                p.pen_winner_team_id != null ? ` (🥅 ${teamById.get(p.pen_winner_team_id)?.name ?? "?"})` : ""
              }`
            : null,
        homeGoals: p.home_goals,
        awayGoals: p.away_goals,
        penWinnerTeamId: p.pen_winner_team_id,
        scorers: scorersOf(sg),
        points: finished
          ? scoreLive(cfg, actual, [
              { match_id: matchNum, home_goals: p.home_goals, away_goals: p.away_goals, scorer_goals: sg, pen_winner_team_id: p.pen_winner_team_id },
            ])
          : null,
        isMe: p.user_id === user.id,
      };
    });
  }
  // One row per person — a friend you share multiple leagues with appears once
  // (picks are account-level, so the duplicate rows are identical).
  const seenUsers = new Set<string>();
  predRows = predRows.filter((r) => (seenUsers.has(r.userId) ? false : (seenUsers.add(r.userId), true)));
  predRows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.name.localeCompare(b.name));
  const iHavePredicted = predRows.some((r) => r.isMe);
  const myPred = predRows.find((r) => r.isMe) ?? null;

  // Chronological events timeline for the Summary tab. Each event picks a side
  // (home → left, away → right) and an icon; goals also show the assist.
  type TimelineItem = {
    side: "home" | "away" | null;
    icon: string;
    minute: number | null;
    primary: string;
    secondary: string | null;
  };
  const events = (eventRows ?? []) as unknown as EventRow[];
  const timeline: TimelineItem[] = events.map((e) => {
    const side: "home" | "away" | null =
      e.team_id === match.home_team_id ? "home" : e.team_id === match.away_team_id ? "away" : null;
    const detail = (e.detail ?? "").toLowerCase();
    const name = e.player_name ?? (e.player_id != null ? playerById.get(e.player_id)?.name : null) ?? "—";
    let icon = "•";
    let secondary: string | null = null;
    if (e.type === "goal") {
      const isOwn = detail.includes("own");
      icon = "⚽️";
      const assist = e.related_name ?? (e.related_id != null ? playerById.get(e.related_id)?.name : null);
      secondary = isOwn
        ? "own goal"
        : detail.includes("pen")
          ? "penalty"
          : assist
            ? `assist · ${assist}`
            : null;
    } else if (e.type === "card") {
      icon = detail.includes("red") || detail.includes("second yellow") ? "🟥" : "🟨";
    } else if (e.type === "subst") {
      icon = "🔄";
      const off = e.related_name ?? (e.related_id != null ? playerById.get(e.related_id)?.name : null);
      secondary = off ? `↓ ${off}` : null;
    }
    return { side, icon, minute: e.minute, primary: name, secondary };
  });

  const hasScorersOrCards = homeScorers.length > 0 || awayScorers.length > 0 || homeCards.length > 0 || awayCards.length > 0;

  // ---- Tab sections (server-rendered, handed to <MatchTabs> as props) ----
  const summaryTab =
    timeline.length === 0 && !hasScorersOrCards ? null : (
      <section className="space-y-4">
        {timeline.length > 0 && (
          <ul className="glass relative space-y-3 rounded-2xl p-4">
            {/* centre rail */}
            <span className="pointer-events-none absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-night/10" />
            {timeline.map((t, i) => (
              <li key={i} className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                <div className={`min-w-0 ${t.side === "home" ? "text-right text-chalk" : "text-right text-transparent"}`}>
                  {t.side === "home" && (
                    <>
                      <span className="font-semibold">{t.icon} {t.primary}</span>
                      {t.secondary && <span className="block text-[11px] text-chalk-dim">{t.secondary}</span>}
                    </>
                  )}
                </div>
                <span className="z-10 shrink-0 rounded-full bg-night/5 px-2 py-0.5 font-display text-[11px] tabular-nums text-chalk-dim">
                  {t.minute != null ? `${t.minute}'` : "·"}
                </span>
                <div className={`min-w-0 ${t.side === "away" ? "text-left text-chalk" : "text-left text-transparent"}`}>
                  {t.side === "away" && (
                    <>
                      <span className="font-semibold">{t.primary} {t.icon}</span>
                      {t.secondary && <span className="block text-[11px] text-chalk-dim">{t.secondary}</span>}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
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

  const statsTab = (
    <section className="glass rounded-2xl p-4 sm:p-5">
      {!hasStats ? (
        <p className="py-6 text-center text-sm text-chalk-dim">Stats appear once the match is underway.</p>
      ) : (
        <div className="space-y-3.5">
          {/* xG — the headline modern stat, shown only when the feed provides it. */}
          {(homeStats?.["expected_goals"] != null || awayStats?.["expected_goals"] != null) &&
            statBar(
              <>
                Expected goals (xG){" "}
                <InfoTip>
                  <b>Expected goals (xG)</b> rates the quality of chances — the goals an average
                  side would score from those shots. Higher = better chances created.
                </InfoTip>
              </>,
              "expected_goals",
            )}
          {statBar("Possession", "Ball Possession")}
          {STAT_ROWS.map((r) => statBar(r.label, r.key))}
        </div>
      )}
    </section>
  );

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
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href="/predict" className="text-sm text-chalk-dim hover:text-chalk">
          &larr; Matches
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-chalk-dim">
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
            {finished || live ? `${match.home_goals ?? 0} – ${match.away_goals ?? 0}` : "vs"}
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

        {!locked && (
          <div className="mt-3 flex justify-center">
            {myPred && myPred.score ? (
              <Link
                href={`/predict#match-${match.id}`}
                className="inline-flex max-w-full items-center gap-2 rounded-full bg-grass/15 px-3 py-1.5 text-xs text-chalk transition hover:bg-grass/25"
              >
                <span className="font-semibold text-grass">Your pick:</span>
                <span className="font-display tabular-nums">{myPred.score}</span>
                <span className="shrink-0 font-semibold text-gold">Edit&nbsp;→</span>
              </Link>
            ) : (
              <Link
                href={`/predict#match-${match.id}`}
                className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-night shadow-sm transition hover:brightness-110"
              >
                ⚽ Predict this match →
              </Link>
            )}
          </div>
        )}
      </div>

      <MatchTabs
        summary={summaryTab}
        lineups={lineupsTab}
        stats={statsTab}
        predictions={predictionsTab}
        // Lead with the formation pitch for upcoming/live games (its best moment);
        // once finished, the Summary story leads instead.
        defaultTab={lineupsTab != null && !finished ? "lineups" : undefined}
      />
    </main>
  );
}
