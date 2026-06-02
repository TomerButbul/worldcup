import type { Group } from "@/lib/types";

// Eligibility lists for the eight Round-of-32 third-place slots (spec §4.1),
// keyed by canonical match number. A slot may only be filled by a third-placed
// team from one of its listed groups.
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

// Slots processed in a fixed order so the matching is deterministic.
const SLOT_ORDER = [74, 77, 79, 80, 81, 82, 85, 87] as const;

// Official-table overrides: for the (rare) combinations where FIFA's published
// Annex C assignment differs from the solver's deterministic perfect matching,
// pin the exact official map here, keyed by the sorted qualifying groups joined
// with no separator (e.g. "ABCDEFGH"). Populated during execution from the FIFA
// regulations (Step 5); empty means the solver's matching is used as-is.
export const OVERRIDES: Record<string, Record<number, Group>> = {};

function keyOf(qualifying: Set<Group>): string {
  return [...qualifying].sort().join("");
}

// Deterministic bipartite perfect matching of the 8 qualifying groups to the 8
// slots, respecting eligibility. Backtracking over slots in SLOT_ORDER, trying
// eligible groups in each slot's listed order. FIFA's lists guarantee a perfect
// matching exists for all 495 combinations (asserted by the tests).
export function assignThirdsAnnexC(qualifying: Set<Group>): Record<number, Group> {
  if (qualifying.size !== 8) {
    throw new Error(`Annex C needs exactly 8 qualifying groups, got ${qualifying.size}`);
  }

  const override = OVERRIDES[keyOf(qualifying)];
  if (override) return { ...override };

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
