// Pure helpers for the pre-kickoff alerts. The DB reads + push sends that use
// these live in the sync/notify routes; keeping the logic here makes it testable.

// Of a prediction's picked scorers (the keys of scorer_goals), which are NOT in
// the announced starting XI? Empty when every pick is starting — or nothing was
// picked. An empty XI means none are confirmed starting, so every pick "misses".
export function missingScorers(
  scorerGoals: Record<string, number> | null | undefined,
  xiPlayerIds: Iterable<number>,
): number[] {
  const xi = xiPlayerIds instanceof Set ? xiPlayerIds : new Set<number>(xiPlayerIds);
  const out: number[] = [];
  for (const key of Object.keys(scorerGoals ?? {})) {
    const id = Number(key);
    if (Number.isFinite(id) && !xi.has(id)) out.push(id);
  }
  return out;
}

// Set difference for the "you haven't predicted" nudge: of the eligible users
// (members of a prediction league), those NOT already among the predictors.
// Deduped, original order preserved.
export function usersToNudge(
  eligibleUserIds: Iterable<string>,
  predictedUserIds: Iterable<string>,
): string[] {
  const predicted = new Set(predictedUserIds);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of eligibleUserIds) {
    if (!predicted.has(u) && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}
