// Where a player sits on the worldwide board. `getCachedGlobalRankings()` already
// returns every (non-guest) player in board order — best score first — so the
// rank is simply the 1-based position. Kept as a tiny pure helper so the Home
// "Leagues & rankings" card and anyone else can show "Nth of M" without
// re-deriving the ordering. Returns null when the player isn't on the board
// (no score row yet, or a guest who's hidden worldwide).
export function globalRankOf(
  ranks: readonly { user_id: string }[],
  userId: string,
): { rank: number; total: number } | null {
  const idx = ranks.findIndex((r) => r.user_id === userId);
  if (idx === -1) return null;
  return { rank: idx + 1, total: ranks.length };
}
