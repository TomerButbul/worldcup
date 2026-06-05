import type { Group, MatchStage } from "@/lib/types";
import type { GroupStat, GroupTable } from "@/lib/scoring-core";
import { assignThirdsAnnexC } from "@/lib/annex-c";

// A reference to a team's slot in the fixed bracket, resolved once results exist.
//  winner/runner  -> 1st/2nd of a group
//  third          -> the Annex C third assigned to THIS match (§7.1)
//  matchWinner/Loser -> propagated from an earlier knockout match
export type SlotRef =
  | { kind: "winner"; group: Group }
  | { kind: "runner"; group: Group }
  | { kind: "third"; match: number }
  | { kind: "matchWinner"; match: number }
  | { kind: "matchLoser"; match: number };

export interface MatchTemplate {
  home: SlotRef;
  away: SlotRef;
}

const w = (group: Group): SlotRef => ({ kind: "winner", group });
const r = (group: Group): SlotRef => ({ kind: "runner", group });
const third = (match: number): SlotRef => ({ kind: "third", match });
const W = (match: number): SlotRef => ({ kind: "matchWinner", match });

// The eight Round-of-32 matches whose away slot is an Annex C third-placed team.
export const THIRD_MATCHES = [74, 77, 79, 80, 81, 82, 85, 87] as const;

// Round of 32 (matches 73–88) — FIFA 2026, spec §4.1.
export const ROUND32: Record<number, MatchTemplate> = {
  73: { home: r("A"), away: r("B") },
  74: { home: w("E"), away: third(74) },
  75: { home: w("F"), away: r("C") },
  76: { home: w("C"), away: r("F") },
  77: { home: w("I"), away: third(77) },
  78: { home: r("E"), away: r("I") },
  79: { home: w("A"), away: third(79) },
  80: { home: w("L"), away: third(80) },
  81: { home: w("D"), away: third(81) },
  82: { home: w("G"), away: third(82) },
  83: { home: r("K"), away: r("L") },
  84: { home: w("H"), away: r("J") },
  85: { home: w("B"), away: third(85) },
  86: { home: w("J"), away: r("H") },
  87: { home: w("K"), away: third(87) },
  88: { home: r("D"), away: r("G") },
};

// R16 → Final (matches 89–104, third-place playoff 103 omitted) — spec §4.2.
export const BRACKET_TREE: Record<number, MatchTemplate> = {
  89: { home: W(74), away: W(77) },
  90: { home: W(73), away: W(75) },
  91: { home: W(76), away: W(78) },
  92: { home: W(79), away: W(80) },
  93: { home: W(83), away: W(84) },
  94: { home: W(81), away: W(82) },
  95: { home: W(86), away: W(88) },
  96: { home: W(85), away: W(87) },
  97: { home: W(89), away: W(90) },
  98: { home: W(93), away: W(94) },
  99: { home: W(91), away: W(92) },
  100: { home: W(95), away: W(96) },
  101: { home: W(97), away: W(98) },
  102: { home: W(99), away: W(100) },
  104: { home: W(101), away: W(102) },
};

// Every knockout match keyed by canonical number, in tournament order.
export const KNOCKOUT_TEMPLATE: Record<number, MatchTemplate> = { ...ROUND32, ...BRACKET_TREE };

export function stageOf(matchNo: number): MatchStage {
  if (matchNo >= 73 && matchNo <= 88) return "round_of_32";
  if (matchNo >= 89 && matchNo <= 96) return "round_of_16";
  if (matchNo >= 97 && matchNo <= 100) return "quarter";
  if (matchNo >= 101 && matchNo <= 102) return "semi";
  if (matchNo === 103) return "third_place";
  if (matchNo === 104) return "final";
  throw new Error(`not a knockout match number: ${matchNo}`);
}

export type GroupTables = Record<string, GroupTable>;

export interface ThirdPlaceEntry {
  group: Group;
  teamId: number;
  stat: GroupStat;
}

// Rank the (up to 12) third-placed teams across groups — spec §5 across-group
// ladder: points → GD → GF → FIFA ranking → team id (the underivable conduct /
// drawing-of-lots criteria are skipped).
export function rankThirdPlaceTeams(
  tables: GroupTables,
  fifaRank: Map<number, number> = new Map(),
): ThirdPlaceEntry[] {
  const rank = (id: number) => fifaRank.get(id) ?? Number.MAX_SAFE_INTEGER;
  const thirds: ThirdPlaceEntry[] = [];
  for (const [group, t] of Object.entries(tables)) {
    if (t.order.length < 3) continue;
    const teamId = t.order[2];
    const stat = t.stats.get(teamId);
    if (stat) thirds.push({ group: group as Group, teamId, stat });
  }
  return thirds.sort(
    (x, y) =>
      y.stat.pts - x.stat.pts ||
      y.stat.gd - x.stat.gd ||
      y.stat.gf - x.stat.gf ||
      rank(x.teamId) - rank(y.teamId) ||
      x.teamId - y.teamId,
  );
}

export function pickBestEightThirds(
  tables: GroupTables,
  fifaRank: Map<number, number> = new Map(),
): { teams: ThirdPlaceEntry[]; groups: Set<Group> } {
  const teams = rankThirdPlaceTeams(tables, fifaRank).slice(0, 8);
  return { teams, groups: new Set(teams.map((t) => t.group)) };
}

export type Round32 = Record<number, { home: number | null; away: number | null }>;

export function buildRound32(tables: GroupTables, annex: Record<number, Group>): Round32 {
  const teamAt = (g: Group, pos: number): number | null => tables[g]?.order[pos] ?? null;
  const resolve = (s: SlotRef): number | null => {
    switch (s.kind) {
      case "winner":
        return teamAt(s.group, 0);
      case "runner":
        return teamAt(s.group, 1);
      case "third": {
        const g = annex[s.match];
        return g ? teamAt(g, 2) : null;
      }
      default:
        return null; // matchWinner/Loser do not occur in the Round of 32
    }
  };
  const out: Round32 = {};
  for (const noStr of Object.keys(ROUND32)) {
    const no = Number(noStr);
    out[no] = { home: resolve(ROUND32[no].home), away: resolve(ROUND32[no].away) };
  }
  return out;
}

export interface BuiltBracket {
  round32: Round32;
  bestThirds: ThirdPlaceEntry[];
  annex: Record<number, Group>;
}

export function buildBracket(tables: GroupTables, fifaRank: Map<number, number> = new Map()): BuiltBracket {
  const best = pickBestEightThirds(tables, fifaRank);
  const annex = best.groups.size === 8 ? assignThirdsAnnexC(best.groups) : {};
  return { round32: buildRound32(tables, annex), bestThirds: best.teams, annex };
}

// Table-pick model: build the Round of 32 straight from the manager's predicted
// group ORDER + the 8 groups whose third-placed team they sent through — no
// scorelines needed. `groupOrder` maps each group label to its [1st,2nd,3rd,4th]
// team ids; `thirdGroups` are the (ideally 8) groups providing a third-place
// qualifier. Annex C slots the thirds only when exactly 8 are chosen; otherwise
// the eight third-place slots stay null (bracket incomplete).
export function buildBracketFromOrder(
  groupOrder: Record<string, number[]>,
  thirdGroups: Iterable<string>,
): { round32: Round32; annex: Record<number, Group> } {
  const tables: GroupTables = {};
  for (const [g, order] of Object.entries(groupOrder)) {
    tables[g] = { order: [...order], stats: new Map() };
  }
  const groups = new Set<Group>([...thirdGroups] as Group[]);
  const annex = groups.size === 8 ? assignThirdsAnnexC(groups) : {};
  return { round32: buildRound32(tables, annex), annex };
}

const NEXT_STAGE: Record<string, MatchStage | "champion"> = {
  round_of_32: "round_of_16",
  round_of_16: "quarter",
  quarter: "semi",
  semi: "final",
  final: "champion",
};

export interface PredictedAdvancers {
  byStage: Record<string, Set<number>>;
  champion: number | null;
}

// Survival semantics: reaching the next stage = winning the current tie. The 32
// teams placed into the Round of 32 all "reach" round_of_32. picks are keyed by
// canonical match number → predicted winner team id.
export function predictedAdvancers(round32: Round32, picks: Record<string, number>): PredictedAdvancers {
  const byStage: Record<string, Set<number>> = {
    round_of_32: new Set(),
    round_of_16: new Set(),
    quarter: new Set(),
    semi: new Set(),
    final: new Set(),
  };
  for (const m of Object.values(round32)) {
    if (m.home != null) byStage.round_of_32.add(m.home);
    if (m.away != null) byStage.round_of_32.add(m.away);
  }
  let champion: number | null = null;
  for (const [noStr, winner] of Object.entries(picks)) {
    const next = NEXT_STAGE[stageOf(Number(noStr))];
    if (next === "champion") champion = winner;
    else if (next) byStage[next].add(winner);
  }
  return { byStage, champion };
}

// --- Predicted-bracket resolution (shared by the editor + read-only views) ---
// Given a manager's predicted group ORDER, their 8 third-place groups, and their
// per-tie winner picks (keyed by canonical match no), resolve every knockout
// match's two participants and validated winner. A pick is dropped automatically
// once an upstream change makes it no longer one of the tie's two teams — so the
// editor (live) and the locked recap render identically from the same data.
export interface ResolvedBracket {
  participants: Record<number, { home: number | null; away: number | null }>;
  winners: Record<number, number>;
  champion: number | null;
}

export function resolvePredictedBracket(
  groupOrder: Record<string, number[]>,
  thirdGroups: Iterable<string>,
  knockoutPicks: Record<number, number>,
): ResolvedBracket {
  const tables: GroupTables = {};
  for (const [g, order] of Object.entries(groupOrder)) tables[g] = { order: [...order], stats: new Map() };
  const groups = new Set<Group>([...thirdGroups] as Group[]);
  const annex = groups.size === 8 ? assignThirdsAnnexC(groups) : {};

  const winners: Record<number, number> = {};
  const participants: Record<number, { home: number | null; away: number | null }> = {};
  const resolve = (s: SlotRef): number | null => {
    switch (s.kind) {
      case "winner":
        return tables[s.group]?.order[0] ?? null;
      case "runner":
        return tables[s.group]?.order[1] ?? null;
      case "third": {
        const g = annex[s.match];
        return g ? tables[g]?.order[2] ?? null : null;
      }
      case "matchWinner":
        return winners[s.match] ?? null;
      default:
        return null;
    }
  };
  for (const no of Object.keys(KNOCKOUT_TEMPLATE).map(Number).sort((a, b) => a - b)) {
    const tpl = KNOCKOUT_TEMPLATE[no];
    const home = resolve(tpl.home);
    const away = resolve(tpl.away);
    participants[no] = { home, away };
    const pick = knockoutPicks[no];
    if (pick != null && (pick === home || pick === away)) winners[no] = pick;
  }
  return { participants, winners, champion: winners[104] ?? null };
}

const KO_VIEW_LABELS: Record<string, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarter-finals",
  semi: "Semi-finals",
  final: "Final",
};
const KO_VIEW_ORDER: MatchStage[] = ["round_of_32", "round_of_16", "quarter", "semi", "final"];

export interface ViewBracketRound {
  stage: MatchStage;
  label: string;
  matches: { no: number; home: number | null; away: number | null; winner: number | null }[];
}

// Resolve a predicted bracket and shape it into display rounds (R32 → Final),
// ready to hand straight to the <KnockoutBracket> component. Matches within a
// round are ascending by canonical no (bracket order).
export function predictedBracketRounds(
  groupOrder: Record<string, number[]>,
  thirdGroups: Iterable<string>,
  knockoutPicks: Record<number, number>,
): { rounds: ViewBracketRound[]; champion: number | null } {
  const { participants, winners, champion } = resolvePredictedBracket(groupOrder, thirdGroups, knockoutPicks);
  const byStage = new Map<MatchStage, number[]>();
  for (const no of Object.keys(KNOCKOUT_TEMPLATE).map(Number).sort((a, b) => a - b)) {
    const st = stageOf(no);
    if (!byStage.has(st)) byStage.set(st, []);
    byStage.get(st)!.push(no);
  }
  const rounds: ViewBracketRound[] = KO_VIEW_ORDER.filter((s) => byStage.has(s)).map((s) => ({
    stage: s,
    label: KO_VIEW_LABELS[s],
    matches: byStage.get(s)!.map((no) => ({
      no,
      home: participants[no]?.home ?? null,
      away: participants[no]?.away ?? null,
      winner: winners[no] ?? null,
    })),
  }));
  return { rounds, champion };
}

// Full read-only bracket view: like predictedBracketRounds, but also threads in the
// 3rd-place playoff (canonical match 103 — the two losing semi-finalists) as its own
// round slotted right before the Final, and resolves the podium (champion / runner-up
// / 3rd). This is the exact shape BracketEditor feeds <KnockoutBracket>, so a
// read-only embed (the public /b/<slug> share) renders identically to the editor's
// tree. `stage` is a plain string here because the 3rd-place round isn't one of the
// five MatchStage values.
export interface ViewBracket {
  rounds: {
    stage: string;
    label: string;
    matches: { no: number; home: number | null; away: number | null; winner: number | null }[];
  }[];
  champion: number | null;
  runnerUp: number | null;
  third: number | null;
}

export function predictedBracketView(
  groupOrder: Record<string, number[]>,
  thirdGroups: Iterable<string>,
  knockoutPicks: Record<number, number>,
): ViewBracket {
  const { participants, winners, champion } = resolvePredictedBracket(groupOrder, thirdGroups, knockoutPicks);

  const byStage = new Map<MatchStage, number[]>();
  for (const no of Object.keys(KNOCKOUT_TEMPLATE).map(Number).sort((a, b) => a - b)) {
    const st = stageOf(no);
    if (!byStage.has(st)) byStage.set(st, []);
    byStage.get(st)!.push(no);
  }
  const rounds: ViewBracket["rounds"] = KO_VIEW_ORDER.filter((s) => byStage.has(s)).map((s) => ({
    stage: s,
    label: KO_VIEW_LABELS[s],
    matches: byStage.get(s)!.map((no) => ({
      no,
      home: participants[no]?.home ?? null,
      away: participants[no]?.away ?? null,
      winner: winners[no] ?? null,
    })),
  }));

  // 3rd-place playoff (match 103): the two semi losers; bronze = its winner, kept
  // only while the stored pick is still one of them.
  const semiLosers = [101, 102].map((no) => {
    const p = participants[no];
    const win = winners[no];
    if (!p || p.home == null || p.away == null || win == null) return null;
    return p.home === win ? p.away : p.home;
  });
  const tp = knockoutPicks[103];
  const third = tp != null && (tp === semiLosers[0] || tp === semiLosers[1]) ? tp : null;
  const thirdRound = {
    stage: "third_place",
    label: "3rd-place playoff",
    matches: [{ no: 103, home: semiLosers[0], away: semiLosers[1], winner: third }],
  };
  const finalIdx = rounds.findIndex((r) => r.stage === "final");
  if (finalIdx >= 0) rounds.splice(finalIdx, 0, thirdRound);
  else rounds.push(thirdRound);

  // Runner-up = the Final's loser.
  const finalP = participants[104];
  const runnerUp = finalP && champion != null ? (finalP.home === champion ? finalP.away : finalP.home) : null;

  return { rounds, champion, runnerUp, third };
}
