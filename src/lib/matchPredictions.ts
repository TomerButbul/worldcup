// Everyone's prediction for one match, as rendered by <MatchPredictions>. Built
// the same way for the full match page and the live card on /predict, so the
// group-vs-knockout logic lives here once instead of being copied per surface.

export type PredScorer = { name: string; count: number; photo: string | null; teamId: number | null };

export type PredictionRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  penWinnerTeamId: number | null;
  scorers: PredScorer[];
  points: number | null;
  isMe: boolean;
};

type Profile = { display_name: string; team_name: string | null; avatar_url: string | null };

// A row from match_predictions, with the predictor's profile joined in. Supabase
// types a to-one join as either an object or a single-element array depending on
// the query, so we accept both and normalise.
export interface MatchPredictionRow {
  user_id: string;
  home_goals: number | null;
  away_goals: number | null;
  scorer_goals: Record<string, number> | null;
  pen_winner_team_id: number | null;
  profiles: Profile | Profile[] | null;
}

// A row from bracket_predictions: each member's whole bracket, with per-match
// group scorelines keyed by match id under group_scores.
export interface BracketPredictionRow {
  user_id: string;
  group_scores: Record<string, { h: number; a: number }> | null;
  profiles: Profile | Profile[] | null;
}

type PlayerLite = { name: string; team_id: number | null; photo_url: string | null };

export interface BuildPredRowsArgs {
  matchId: number;
  isGroup: boolean;
  userId: string;
  /** match_predictions rows for THIS match (across the viewer's leagues). */
  preds: MatchPredictionRow[];
  /** bracket_predictions rows across the viewer's leagues (group stage only). */
  brackets: BracketPredictionRow[];
  // ReadonlyMap so a richer player map (e.g. one that also carries `ovr`) is
  // assignable here — Map's value is invariant, ReadonlyMap's is covariant.
  playerById: ReadonlyMap<number, PlayerLite>;
  /** Points for a finished match; omit (or return null) while live/upcoming. */
  pointsFor?: (p: {
    homeGoals: number | null;
    awayGoals: number | null;
    scorerGoals: Record<string, number>;
    penWinnerTeamId: number | null;
  }) => number | null;
}

const normProfile = (p: Profile | Profile[] | null): Profile | null => (Array.isArray(p) ? (p[0] ?? null) : p);
const nameOf = (p: Profile | null) => p?.team_name || p?.display_name || "?";

function scorersOf(sg: Record<string, number>, playerById: ReadonlyMap<number, PlayerLite>): PredScorer[] {
  return Object.entries(sg ?? {})
    .map(([pid, n]) => {
      const p = playerById.get(Number(pid));
      return p ? { name: p.name, count: n, photo: p.photo_url ?? null, teamId: p.team_id } : null;
    })
    .filter((s): s is PredScorer => s !== null);
}

// One row per person — a friend you share multiple leagues with appears once
// (picks are account-level, so the duplicate rows are identical) — sorted by
// points (desc) then name.
export function buildPredRows({
  matchId,
  isGroup,
  userId,
  preds,
  brackets,
  playerById,
  pointsFor,
}: BuildPredRowsArgs): PredictionRow[] {
  const points = (p: {
    homeGoals: number | null;
    awayGoals: number | null;
    scorerGoals: Record<string, number>;
    penWinnerTeamId: number | null;
  }) => (pointsFor ? pointsFor(p) : null);

  let rows: PredictionRow[];
  if (isGroup) {
    // Group: the prediction is the bracket scoreline + any live scorer picks.
    const predByUser = new Map(preds.map((p) => [p.user_id, p]));
    rows = brackets
      .map((b): PredictionRow | null => {
        const prof = normProfile(b.profiles);
        const mp = predByUser.get(b.user_id);
        const gsRaw = b.group_scores?.[String(matchId)];
        // Fall back to the live match_predictions scoreline when the upfront
        // bracket has no group score for this match (e.g. the sandbox fixture).
        const gs =
          gsRaw ?? (mp?.home_goals != null && mp?.away_goals != null ? { h: mp.home_goals, a: mp.away_goals } : null);
        const sg = (mp?.scorer_goals ?? {}) as Record<string, number>;
        if (!gs && Object.keys(sg).length === 0) return null; // no prediction for this match
        return {
          userId: b.user_id,
          name: nameOf(prof),
          avatarUrl: prof?.avatar_url ?? null,
          homeGoals: gs?.h ?? null,
          awayGoals: gs?.a ?? null,
          penWinnerTeamId: mp?.pen_winner_team_id ?? null,
          scorers: scorersOf(sg, playerById),
          points: points({ homeGoals: gs?.h ?? null, awayGoals: gs?.a ?? null, scorerGoals: sg, penWinnerTeamId: mp?.pen_winner_team_id ?? null }),
          isMe: b.user_id === userId,
        };
      })
      .filter((r): r is PredictionRow => r !== null);
  } else {
    // Knockout: the prediction is the live score + scorers.
    rows = preds.map((p): PredictionRow => {
      const sg = (p.scorer_goals ?? {}) as Record<string, number>;
      return {
        userId: p.user_id,
        name: nameOf(normProfile(p.profiles)),
        avatarUrl: normProfile(p.profiles)?.avatar_url ?? null,
        homeGoals: p.home_goals,
        awayGoals: p.away_goals,
        penWinnerTeamId: p.pen_winner_team_id,
        scorers: scorersOf(sg, playerById),
        points: points({ homeGoals: p.home_goals, awayGoals: p.away_goals, scorerGoals: sg, penWinnerTeamId: p.pen_winner_team_id }),
        isMe: p.user_id === userId,
      };
    });
  }

  const seen = new Set<string>();
  rows = rows.filter((r) => (seen.has(r.userId) ? false : (seen.add(r.userId), true)));
  rows.sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.name.localeCompare(b.name));
  return rows;
}
