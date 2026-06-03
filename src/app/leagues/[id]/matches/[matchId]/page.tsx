import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Flag from "@/components/Flag";
import Ball from "@/components/art/Ball";
import Pitch, { type EventRow, type LineupRow } from "./Pitch";
import MatchPredictions from "./MatchPredictions";
import MatchTabs from "./MatchTabs";
import { stageLabel } from "@/lib/stages";
import AutoRefresh from "@/components/AutoRefresh";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import { scoreLive, type ActualOutcomes } from "@/lib/scoring-core";
import { DEFAULT_SCORING, type ScoringConfig, type MatchStage } from "@/lib/types";

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
    .select("id, name, scoring")
    .eq("id", id)
    .maybeSingle();
  if (!league) redirect("/dashboard");

  const { data: match } = await supabase
    .from("matches")
    .select("id, stage, kickoff_at, status, home_team_id, away_team_id, home_goals, away_goals, winner_team_id")
    .eq("id", matchNum)
    .maybeSingle();
  if (!match) notFound();

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
        ? supabase.from("players").select("id, name, team_id").in("team_id", teamIds)
        : Promise.resolve({ data: [] as { id: number; name: string; team_id: number | null }[] }),
      supabase
        .from("match_predictions")
        .select("user_id, home_goals, away_goals, scorer_goals, pen_winner_team_id, profiles ( display_name, team_name, avatar_url )")
        .eq("league_id", id)
        .eq("match_id", matchNum),
      // For group matches the predicted scoreline lives in the bracket, so pull
      // every member's bracket to show what each person predicted.
      supabase
        .from("bracket_predictions")
        .select("user_id, group_scores, profiles ( display_name, team_name, avatar_url )")
        .eq("league_id", id),
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
      .filter((x): x is { player: { id: number; name: string; team_id: number | null }; n: number } =>
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

  // Possession arrives as "55%"; pull the integer for the split bar. Default to
  // an even split when one side is missing so the bar still renders sensibly.
  const pct = (v: string | number | null | undefined): number | null => {
    if (v == null) return null;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
  };
  const homePoss = pct(homeStats?.["Ball Possession"]);
  const awayPoss = pct(awayStats?.["Ball Possession"]);
  const homePossPct = homePoss ?? (awayPoss != null ? 100 - awayPoss : 50);

  // Rows of the stats comparison, in display order. "—" stands in for any key a
  // side hasn't reported.
  const STAT_KEYS = [
    "Total Shots",
    "Shots on Goal",
    "Shots insidebox",
    "Corner Kicks",
    "Fouls",
    "Offsides",
    "Yellow Cards",
    "Red Cards",
    "Goalkeeper Saves",
    "Passes accurate",
    "Passes %",
  ] as const;
  const statVal = (s: StatMap | null, key: string) => {
    const v = s?.[key];
    return v == null || v === "" ? "—" : String(v);
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
  // "Messi ×2, Suárez" — predicted scorers with their goal counts.
  const scorerLabelsOf = (sg: Record<string, number>) =>
    Object.entries(sg ?? {})
      .map(([pid, n]) => {
        const name = playerById.get(Number(pid))?.name;
        return name ? `${name}${n > 1 ? ` ×${n}` : ""}` : null;
      })
      .filter((s): s is string => !!s);

  interface PredRow {
    userId: string;
    name: string;
    avatarUrl: string | null;
    score: string | null;
    homeGoals: number | null;
    awayGoals: number | null;
    penWinnerTeamId: number | null;
    scorerNames: string[];
    points: number | null;
    isMe: boolean;
  }

  let predRows: PredRow[];
  if (isGroup) {
    // Group: the prediction is the bracket scoreline + any live scorer picks.
    const scorersByUser = new Map<string, Record<string, number>>(
      (preds ?? []).map((p) => [p.user_id, (p.scorer_goals ?? {}) as Record<string, number>]),
    );
    predRows = (brackets ?? [])
      .map((b): PredRow | null => {
        const prof = b.profiles as unknown as PredProfile | null;
        const gs = (b.group_scores as Record<string, { h: number; a: number }> | null)?.[String(matchNum)];
        const sg = scorersByUser.get(b.user_id) ?? {};
        if (!gs && Object.keys(sg).length === 0) return null; // no prediction for this match
        return {
          userId: b.user_id,
          name: nameOf(prof),
          avatarUrl: prof?.avatar_url ?? null,
          score: gs ? `${gs.h}–${gs.a}` : null,
          homeGoals: gs?.h ?? null,
          awayGoals: gs?.a ?? null,
          penWinnerTeamId: null,
          scorerNames: scorerLabelsOf(sg),
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
        scorerNames: scorerLabelsOf(sg),
        points: finished
          ? scoreLive(cfg, actual, [
              { match_id: matchNum, home_goals: p.home_goals, away_goals: p.away_goals, scorer_goals: sg, pen_winner_team_id: p.pen_winner_team_id },
            ])
          : null,
        isMe: p.user_id === user.id,
      };
    });
  }
  predRows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.name.localeCompare(b.name));

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
        />
      </section>
    ) : null;

  const statsTab = (
    <section className="glass rounded-2xl p-4 sm:p-5">
      {!hasStats ? (
        <p className="py-6 text-center text-sm text-chalk-dim">Stats appear once the match is underway.</p>
      ) : (
        <div className="space-y-4">
          {/* Possession split bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-chalk">
              <span className="tabular-nums">{statVal(homeStats, "Ball Possession")}</span>
              <span className="text-chalk-dim">Ball Possession</span>
              <span className="tabular-nums">{statVal(awayStats, "Ball Possession")}</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-night/10">
              <span className="h-full bg-grass" style={{ width: `${homePossPct}%` }} />
              <span className="h-full bg-electric/70" style={{ width: `${100 - homePossPct}%` }} />
            </div>
          </div>

          {/* Comparison rows */}
          <ul className="divide-y divide-night/5">
            {STAT_KEYS.map((key) => (
              <li key={key} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 py-1.5 text-xs sm:gap-3">
                <span className="text-right font-semibold tabular-nums text-chalk">{statVal(homeStats, key)}</span>
                <span className="text-center text-chalk-dim">{key}</span>
                <span className="text-left font-semibold tabular-nums text-chalk">{statVal(awayStats, key)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  const predictionsTab =
    predRows.length === 0 ? null : (
      <section className="space-y-3">
        <h2 className="font-display text-lg text-chalk">
          {finished ? "How everyone predicted" : "Predictions"}
        </h2>
        {!locked ? (
          <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">
            🔒 <span className="font-semibold text-chalk">{predRows.length}</span>{" "}
            {predRows.length === 1 ? "manager has" : "managers have"} locked in a pick — everyone&apos;s
            predictions are revealed the moment this match kicks off.
          </p>
        ) : (
          <MatchPredictions home={home ?? null} away={away ?? null} rows={predRows} />
        )}
      </section>
    );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <AutoRefresh enabled={nowMs() >= KICKOFF_MS} />
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <Link href={`/leagues/${id}/matches`} className="text-sm text-chalk-dim hover:text-chalk">
          &larr; Matches
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-chalk-dim">
          <span className="font-display text-gold">{stageLabel(match.stage)}</span>
          <span className="flex items-center gap-2">
            {live && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-red-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
              </span>
            )}
            <span className="whitespace-nowrap">{kickoff}</span>
          </span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-center sm:gap-5">
          <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <Flag teamId={match.home_team_id} logoUrl={home?.logo_url} code={home?.code} name={homeName} size={44} />
            <span className="text-sm font-semibold text-chalk sm:text-base">{homeName}</span>
          </span>
          <span className="net shrink-0 rounded-2xl bg-night/5 px-5 py-3 font-display text-3xl text-chalk">
            {finished || live ? `${match.home_goals ?? 0} – ${match.away_goals ?? 0}` : "vs"}
          </span>
          <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <Flag teamId={match.away_team_id} logoUrl={away?.logo_url} code={away?.code} name={awayName} size={44} />
            <span className="text-sm font-semibold text-chalk sm:text-base">{awayName}</span>
          </span>
        </div>
      </div>

      <MatchTabs
        summary={summaryTab}
        lineups={lineupsTab}
        stats={statsTab}
        predictions={predictionsTab}
      />
    </main>
  );
}
