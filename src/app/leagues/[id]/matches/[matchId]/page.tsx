import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Flag from "@/components/Flag";
import Avatar from "@/components/Avatar";
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

  const [{ data: teams }, { data: goals }, { data: cards }, { data: players }, { data: preds }, { data: brackets }] =
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
    ]);

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));
  const home = match.home_team_id ? teamById.get(match.home_team_id) : null;
  const away = match.away_team_id ? teamById.get(match.away_team_id) : null;
  const homeName = home?.name ?? "TBD";
  const awayName = away?.name ?? "TBD";

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

        {(homeScorers.length > 0 || awayScorers.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="text-right text-chalk-dim">
              {homeScorers.map((x) => (
                <div key={x.player.id}>⚽ {x.player.name}{x.n > 1 ? ` ×${x.n}` : ""}</div>
              ))}
            </div>
            <div className="text-left text-chalk-dim">
              {awayScorers.map((x) => (
                <div key={x.player.id}>{x.player.name}{x.n > 1 ? ` ×${x.n}` : ""} ⚽</div>
              ))}
            </div>
          </div>
        )}

        {(homeCards.length > 0 || awayCards.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-night/5 pt-3 text-xs">
            <div className="text-right text-chalk-dim">
              {homeCards.map((c, i) => (
                <div key={`h-${i}`}>{cardLabel(c)}</div>
              ))}
            </div>
            <div className="text-left text-chalk-dim">
              {awayCards.map((c, i) => (
                <div key={`a-${i}`}>{cardLabel(c)}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-chalk">
          {finished ? "How everyone predicted" : "Predictions"}
        </h2>
        {!locked ? (
          <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">
            🔒 Predictions are revealed once the match kicks off.
          </p>
        ) : predRows.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">
            No one in this league predicted this match.
          </p>
        ) : (
          <ul className="space-y-2">
            {predRows.map((r) => (
              <li
                key={r.userId}
                className={`flex items-center gap-3 rounded-2xl glass p-3 ${
                  r.isMe ? "border-grass/50 bg-grass/5" : ""
                }`}
              >
                <Avatar url={r.avatarUrl} name={r.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-chalk">
                    {r.name} {r.isMe && <span className="text-xs text-grass">(you)</span>}
                  </p>
                  {r.scorerNames.length > 0 && (
                    <p className="truncate text-xs text-chalk-dim">⚽ {r.scorerNames.join(", ")}</p>
                  )}
                </div>
                {r.score && (
                  <span className="font-display text-lg text-chalk">{r.score}</span>
                )}
                {r.points != null && (
                  <span
                    className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                      r.points > 0 ? "bg-grass/15 text-grass" : "bg-night/5 text-chalk-dim"
                    }`}
                  >
                    +{r.points}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
