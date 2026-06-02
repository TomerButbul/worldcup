import type { Group, MatchStage } from "@/lib/types";

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
