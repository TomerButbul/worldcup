import { rowLabels } from "@/lib/positions";

// Shared formation geometry — one source of truth for the team-profile pitch, the
// predict scorer pitch, and the two-team match-centre pitch. Lives in lib (no JSX)
// so it's unit-tested independently of rendering.

export type FormationPlayer = {
  player_id: number;
  name: string;
  number?: number | null;
  pos?: string | null;
  grid?: string | null;
};
export type PositionedPlayer = { player: FormationPlayer; x: number; y: number; label: string };

// Which slice of the pitch a team occupies:
// - "single": one team filling the whole pitch (team profile / predict picker).
// - "home"  : the bottom half of a two-team pitch.
// - "away"  : the top half of a two-team pitch (faces down → labels mirror).
export type PitchSide = "single" | "home" | "away";

// y runs 0 (top) → 100 (bottom). `frac` is a row's depth: 0 = own goal line
// (keeper), 1 = the attacking end (forwards). Each side maps frac onto a keeper→
// forward y-band. The two-team bands stop short of the centre (forwards at 57/43 —
// a clear ~14-unit band so the forward lines never collide) and keep the keepers a
// few units off the goal line (93/7) so the keeper chip isn't clipped by the edge.
const Y_BAND: Record<PitchSide, { gk: number; fwd: number }> = {
  single: { gk: 88, fwd: 14 },
  home: { gk: 93, fwd: 57 },
  away: { gk: 7, fwd: 43 },
};

const POS_ROW: Record<string, number> = { G: 1, D: 2, M: 3, F: 4 };

// Lay out a starting XI. Prefers real API-Football grid "row:col" coords; falls
// back to broad position rows (G/D/M/F) when a lineup has no grid.
export function positionXI(xi: FormationPlayer[], side: PitchSide): PositionedPlayer[] {
  const useGrid = xi.some((p) => !!p.grid && p.grid.includes(":"));
  const parsed = xi.map((p, i) => {
    if (useGrid && p.grid && p.grid.includes(":")) {
      const [r, c] = p.grid.split(":").map((n) => parseInt(n, 10) || 1);
      return { p, r, c };
    }
    return { p, r: POS_ROW[(p.pos ?? "M").charAt(0).toUpperCase()] ?? 3, c: i };
  });
  const maxRow = Math.max(1, ...parsed.map((x) => x.r));

  const byRow = new Map<number, typeof parsed>();
  for (const x of parsed) {
    if (!byRow.has(x.r)) byRow.set(x.r, []);
    byRow.get(x.r)!.push(x);
  }

  const { gk, fwd } = Y_BAND[side];
  const out: PositionedPlayer[] = [];
  for (const [r, players] of byRow) {
    const sorted = [...players].sort((a, b) => a.c - b.c);
    const frac = maxRow > 1 ? (r - 1) / (maxRow - 1) : 0; // 0 = keeper, 1 = forwards
    const y = gk + frac * (fwd - gk);
    const line = sorted.map((x) => x.p.pos).find(Boolean) ?? "M";
    const labels = rowLabels(line, sorted.length, frac);
    if (side === "away") labels.reverse(); // top team faces down → mirror left↔right
    sorted.forEach((x, i) => {
      out.push({ player: x.p, x: ((i + 0.5) / sorted.length) * 100, y, label: labels[i] ?? "" });
    });
  }
  return out;
}

// Derive a "4-3-3"-style label from the XI's broad positions when the feed didn't
// supply a formation string.
export function deriveFormation(xi: FormationPlayer[]): string {
  const count = (k: string) => xi.filter((p) => (p.pos ?? "").toUpperCase().startsWith(k)).length;
  const d = count("D"),
    m = count("M"),
    f = count("F");
  return d && (m || f) ? `${d}-${m}-${f}` : "";
}

// --- Live match state ------------------------------------------------------

export type MatchEvent = {
  team_id: number | null;
  type: string; // "goal" | "card" | "subst"
  detail: string | null;
  player_id: number | null;
  player_name?: string | null;
  related_id: number | null; // assist giver (goal) or player coming OFF (subst)
  related_name?: string | null;
  minute: number | null;
};
export type PlayerMatchStat = { goals: number; assists: number; yellow: number; red: number };
export type TeamLineup = { team_id: number; formation?: string | null; xi: FormationPlayer[]; subs: FormationPlayer[] };

// Tally goals/assists/cards per player from the match event feed.
export function aggregatePlayerStats(events: MatchEvent[]): Map<number, PlayerMatchStat> {
  const stats = new Map<number, PlayerMatchStat>();
  const bump = (id: number | null, k: keyof PlayerMatchStat) => {
    if (id == null) return;
    const s = stats.get(id) ?? { goals: 0, assists: 0, yellow: 0, red: 0 };
    s[k] += 1;
    stats.set(id, s);
  };
  for (const e of events) {
    if (e.type === "goal") {
      bump(e.player_id, "goals");
      bump(e.related_id, "assists");
    } else if (e.type === "card") {
      const d = (e.detail ?? "").toLowerCase();
      bump(e.player_id, d.includes("red") || d.includes("second yellow") ? "red" : "yellow");
    }
  }
  return stats;
}

// Apply substitutions to a starting XI → the 11 currently on the pitch (incoming
// player inherits the outgoing player's grid slot), who left, and the bench left.
export function applySubs(
  lineup: TeamLineup,
  events: MatchEvent[],
): { onPitch: FormationPlayer[]; wentOff: FormationPlayer[]; benchRemaining: FormationPlayer[] } {
  const onPitch: FormationPlayer[] = lineup.xi.map((p) => ({ ...p }));
  const cameOn = new Set<number>();
  const wentOff: FormationPlayer[] = [];
  const subPool = new Map(lineup.subs.map((s) => [s.player_id, s]));

  const subs = events
    .filter((e) => e.type === "subst" && e.team_id === lineup.team_id)
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  for (const ev of subs) {
    const offId = ev.related_id; // player coming OFF
    const onId = ev.player_id; // player coming ON
    const idx = onPitch.findIndex((p) => p.player_id === offId);
    if (idx === -1 || onId == null) continue;
    const off = onPitch[idx];
    wentOff.push(off);
    const incoming = subPool.get(onId) ?? {
      player_id: onId,
      name: ev.player_name ?? "?",
      number: null,
      pos: off.pos,
      grid: off.grid,
    };
    onPitch[idx] = { ...incoming, grid: off.grid }; // inherit the slot
    cameOn.add(onId);
  }
  const benchRemaining = lineup.subs.filter((s) => !cameOn.has(s.player_id));
  return { onPitch, wentOff, benchRemaining };
}

// Convert a match_lineups row (xi/subs of FormationPlayers) into the predict
// scorer-picker's lighter Lineup shape ({ starters, subs, xi }).
export function toScorerLineup(
  row: { xi: FormationPlayer[]; subs: FormationPlayer[] } | null,
): {
  starters: number[];
  subs: number[];
  xi: { player_id: number; name?: string | null; pos?: string | null; grid?: string | null }[];
} | null {
  if (!row) return null;
  return {
    starters: row.xi.map((p) => p.player_id),
    subs: row.subs.map((p) => p.player_id),
    xi: row.xi.map((p) => ({ player_id: p.player_id, name: p.name, pos: p.pos ?? null, grid: p.grid ?? null })),
  };
}
