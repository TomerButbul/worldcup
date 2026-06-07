// Pure live-goal detection: diff one poll of the /api/live feed against the last
// one and report which side just scored. Kept free of any DOM/React so the edge
// cases (no baseline, brand-new match, finished-match corrections, score-down,
// the winning goal that also ends the match) are unit-testable in a node env.
//
// The shapes below are a structural subset of the widget's `Game`/`Mini` types,
// so the real feed rows are assignable here without a cast.
export type GoalTeam = { name: string; code: string | null } | null;

export type GoalGame = {
  id: number;
  done: boolean;
  home: GoalTeam;
  away: GoalTeam;
  homeGoals: number;
  awayGoals: number;
};

export type GoalEvent = {
  gameId: number;
  side: "home" | "away";
  teamName: string;
  teamCode: string | null;
};

// Returns one event per side that scored since `prev`. Deliberately conservative —
// it only fires for a *live* match we already had a baseline for, so it never blasts
// a celebration on first paint, for a match that appears mid-game, or for a late
// score correction on a fixture that was already finished last time we looked.
export function detectGoals(prev: GoalGame[], next: GoalGame[]): GoalEvent[] {
  if (prev.length === 0) return []; // no baseline yet — first load is silent
  const prevById = new Map(prev.map((g) => [g.id, g]));
  const events: GoalEvent[] = [];

  for (const g of next) {
    const before = prevById.get(g.id);
    if (!before) continue; // never seen this match — we don't know its history
    if (before.done) continue; // already finished last poll — ignore late corrections

    if (g.homeGoals > before.homeGoals) {
      events.push({ gameId: g.id, side: "home", teamName: g.home?.name ?? "Goal", teamCode: g.home?.code ?? null });
    }
    if (g.awayGoals > before.awayGoals) {
      events.push({ gameId: g.id, side: "away", teamName: g.away?.name ?? "Goal", teamCode: g.away?.code ?? null });
    }
  }

  return events;
}
