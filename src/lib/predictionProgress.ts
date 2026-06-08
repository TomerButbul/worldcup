// Pure "how far through their pre-tournament picks is this player?" summary, used
// by the home page to nudge people to finish their bracket + awards before they lock
// at kickoff. Bracket and awards both live in one `bracket_predictions` row.
//
// Kept DOM/DB-free so the done/started/partial logic is unit-testable; the dashboard
// passes the fetched row (or null) and the number of award categories.
export type BracketPredictionRow = {
  champion_team_id: number | null;
  knockout: Record<string, number> | null;
  group_order: Record<string, number[]> | null;
  awards: Record<string, number> | null;
} | null;

export type PredictionProgress = {
  bracketStarted: boolean; // any group ordering or knockout pick made
  bracketDone: boolean; // a champion is picked → the whole tree was filled
  awardsPicked: number; // how many award categories have a pick
  awardsTotal: number;
  awardsDone: boolean;
  allDone: boolean; // bracket champion picked AND every award chosen
};

export function predictionProgress(pred: BracketPredictionRow, awardsTotal: number): PredictionProgress {
  const championPicked = pred?.champion_team_id != null;
  const koPicks = Object.keys(pred?.knockout ?? {}).length;
  const groupPicks = Object.keys(pred?.group_order ?? {}).length;
  const awardsPicked = Object.keys(pred?.awards ?? {}).length;

  const bracketDone = championPicked;
  const bracketStarted = championPicked || koPicks > 0 || groupPicks > 0;
  const awardsDone = awardsPicked >= awardsTotal;

  return {
    bracketStarted,
    bracketDone,
    awardsPicked,
    awardsTotal,
    awardsDone,
    allDone: bracketDone && awardsDone,
  };
}
