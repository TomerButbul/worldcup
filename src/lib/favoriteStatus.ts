import type { Match, Team } from "@/lib/types";

export interface FavTeamStatus {
  team: { id: number; name: string; logo_url: string | null; code: string | null };
  last: {
    opponentId: number | null;
    opponentName: string;
    gf: number;
    ga: number;
    outcome: "W" | "D" | "L";
    stage: string;
  } | null;
  next: {
    opponentId: number | null;
    opponentName: string;
    kickoff: string;
    stage: string;
  } | null;
  eliminated: boolean;
  champion: boolean;
  headline: string;
  emoji: string;
  mood: "good" | "bad" | "neutral";
}

const STAGE_LABEL: Record<string, string> = {
  group: "the group stage",
  round_of_32: "the Round of 32",
  round_of_16: "the Round of 16",
  quarter: "the quarter-finals",
  semi: "the semi-finals",
  third_place: "the third-place playoff",
  final: "the FINAL",
};

export function computeFavStatus(
  favId: number,
  teams: Team[],
  matches: Match[],
): FavTeamStatus | null {
  const team = teams.find((t) => t.id === favId);
  if (!team) return null;

  const nameById = new Map(teams.map((t) => [t.id, t.name]));
  const involved = matches
    .filter((m) => m.home_team_id === favId || m.away_team_id === favId)
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());

  const finished = involved.filter((m) => m.status === "finished" && m.home_goals != null && m.away_goals != null);
  const lastM = finished[finished.length - 1];
  const now = Date.now();
  const nextM = involved.find((m) => m.status !== "finished" && new Date(m.kickoff_at).getTime() > now);

  let last: FavTeamStatus["last"] = null;
  if (lastM) {
    const isHome = lastM.home_team_id === favId;
    const gf = (isHome ? lastM.home_goals : lastM.away_goals)!;
    const ga = (isHome ? lastM.away_goals : lastM.home_goals)!;
    const oppId = isHome ? lastM.away_team_id : lastM.home_team_id;
    last = {
      opponentId: oppId,
      opponentName: (oppId && nameById.get(oppId)) || "TBD",
      gf,
      ga,
      outcome: gf > ga ? "W" : gf < ga ? "L" : "D",
      stage: lastM.stage,
    };
  }

  let next: FavTeamStatus["next"] = null;
  if (nextM) {
    const isHome = nextM.home_team_id === favId;
    const oppId = isHome ? nextM.away_team_id : nextM.home_team_id;
    next = {
      opponentId: oppId,
      opponentName: (oppId && nameById.get(oppId)) || "TBD",
      kickoff: nextM.kickoff_at,
      stage: nextM.stage,
    };
  }

  // Best-effort elimination: lost a knockout match and nothing scheduled after.
  const champion =
    lastM?.stage === "final" && last?.outcome === "W";
  const eliminated =
    !next &&
    !champion &&
    !!last &&
    last.outcome === "L" &&
    lastM!.stage !== "group";

  let mood: FavTeamStatus["mood"] = "neutral";
  let emoji = "⚽";
  let headline = `${team.name} are in the tournament.`;

  if (champion) {
    mood = "good";
    emoji = "🏆";
    headline = `${team.name} are WORLD CHAMPIONS!!!`;
  } else if (eliminated) {
    mood = "bad";
    emoji = "😭";
    headline = `${team.name} were knocked out in ${STAGE_LABEL[lastM!.stage] ?? lastM!.stage}.`;
  } else if (last) {
    if (last.outcome === "W") {
      mood = "good";
      emoji = "🎉";
      headline = `${team.name} won their last match ${last.gf}–${last.ga} vs ${last.opponentName}!`;
    } else if (last.outcome === "L") {
      mood = "bad";
      emoji = "💔";
      headline = `${team.name} lost ${last.gf}–${last.ga} to ${last.opponentName}.`;
    } else {
      mood = "neutral";
      emoji = "🤝";
      headline = `${team.name} drew ${last.gf}–${last.ga} with ${last.opponentName}.`;
    }
  } else if (next) {
    headline = `${team.name} kick off soon vs ${next.opponentName}.`;
    emoji = "⏳";
  }

  return { team: { id: team.id, name: team.name, logo_url: team.logo_url, code: team.code }, last, next, eliminated, champion, headline, emoji, mood };
}
