import type { Group } from "@/lib/types";
import { ANNEX_C } from "@/lib/annexCTable";

// Eligibility lists for the eight Round-of-32 third-place slots, keyed by
// canonical match number — the set of groups whose third-placed team CAN fill
// each slot (the union across FIFA's official Annex C scenarios). Eligibility
// alone does NOT pin the assignment: every 8-group combination admits many valid
// matchings, so FIFA publishes one specific choice per combination. That choice
// lives in ANNEX_C (the official 495-row table); these lists are kept only for
// validation + the defensive fallback below.
export const THIRD_SLOT_ELIGIBILITY: Record<number, Group[]> = {
  74: ["A", "B", "C", "D", "F"],
  77: ["C", "D", "F", "G", "H"],
  79: ["C", "E", "F", "H", "I"],
  80: ["E", "H", "I", "J", "K"],
  81: ["B", "E", "F", "I", "J"],
  82: ["A", "E", "H", "I", "J"],
  85: ["E", "F", "G", "I", "J"],
  87: ["D", "E", "I", "J", "L"],
};

const SLOT_ORDER = [74, 77, 79, 80, 81, 82, 85, 87] as const;

function keyOf(qualifying: Set<Group>): string {
  return [...qualifying].sort().join("");
}

// Defensive fallback ONLY: a backtracking matcher that returns *a* valid
// assignment respecting eligibility — but NOT necessarily FIFA's official one.
// ANNEX_C covers every combination (asserted by the tests), so this never runs in
// practice; it exists so a future gap in the table degrades to a valid-but-
// unofficial bracket instead of crashing.
function solveFallback(qualifying: Set<Group>): Record<number, Group> {
  const result: Record<number, Group> = {};
  const used = new Set<Group>();
  const solve = (i: number): boolean => {
    if (i === SLOT_ORDER.length) return used.size === 8;
    const match = SLOT_ORDER[i];
    for (const g of THIRD_SLOT_ELIGIBILITY[match]) {
      if (qualifying.has(g) && !used.has(g)) {
        used.add(g);
        result[match] = g;
        if (solve(i + 1)) return true;
        used.delete(g);
        delete result[match];
      }
    }
    return false;
  };
  if (!solve(0)) {
    throw new Error(`no valid Annex C assignment for ${keyOf(qualifying)}`);
  }
  return result;
}

// Assign the eight qualifying groups' third-placed teams to their Round-of-32
// matches using FIFA's OFFICIAL Annex C table — returns { matchNo → group }. This
// is the real, published mapping; eligibility alone can't determine it.
export function assignThirdsAnnexC(qualifying: Set<Group>): Record<number, Group> {
  if (qualifying.size !== 8) {
    throw new Error(`Annex C needs exactly 8 qualifying groups, got ${qualifying.size}`);
  }
  const official = ANNEX_C[keyOf(qualifying)];
  if (official) return { ...official };
  return solveFallback(qualifying);
}
