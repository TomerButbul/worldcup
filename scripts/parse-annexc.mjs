// THROWAWAY: parse FIFA's official Annex C third-place table from the Wikipedia
// template (raw wikitext, parsed deterministically), validate every row, and emit
// the verified lookup table. Validation is the point — if anything fails we DON'T
// trust it.
import { writeFileSync } from "node:fs";

const url = "https://en.wikipedia.org/w/index.php?title=Template:2026_FIFA_World_Cup_third-place_table&action=raw";
const t = await (await fetch(url)).text();

// Header column order is "1A 1B 1D 1E 1G 1I 1K 1L" (the group-winner hosts).
// Each host is the HOME team of one third-place R32 match:
//   1A→79  1B→85  1D→81  1E→74  1G→82  1I→77  1K→87  1L→80
const COL_MATCH = [79, 85, 81, 74, 82, 77, 87, 80];

// The app's independently-sourced eligibility (from the knockout-stage page).
const ELIG = {
  74: ["A", "B", "C", "D", "F"], 77: ["C", "D", "F", "G", "H"], 79: ["C", "E", "F", "H", "I"],
  80: ["E", "H", "I", "J", "K"], 81: ["B", "E", "F", "I", "J"], 82: ["A", "E", "H", "I", "J"],
  85: ["E", "F", "G", "I", "J"], 87: ["D", "E", "I", "J", "L"],
};

const rowRe = /! scope="row" \|\s*(\d+)([\s\S]*?)(?=! scope="row" \||\n\|\}|$)/g;
const table = {};
const derived = {}; for (const mn of COL_MATCH) derived[mn] = new Set();
const errors = [];
let m, count = 0;
while ((m = rowRe.exec(t))) {
  const no = Number(m[1]);
  const thirds = [...m[2].matchAll(/3([A-L])\b/g)].map((x) => x[1]);
  if (thirds.length !== 8) { errors.push(`row ${no}: found ${thirds.length} thirds, want 8`); continue; }
  const set = new Set(thirds);
  if (set.size !== 8) { errors.push(`row ${no}: not 8 distinct (${thirds.join("")})`); continue; }
  const assign = {};
  for (let i = 0; i < 8; i++) {
    const mn = COL_MATCH[i], g = thirds[i];
    assign[mn] = g; derived[mn].add(g);
    if (!ELIG[mn].includes(g)) errors.push(`row ${no}: ${g} not eligible for match ${mn}`);
  }
  const key = [...set].sort().join("");
  if (table[key]) errors.push(`duplicate key ${key} at row ${no}`);
  table[key] = assign;
  count++;
}

console.log("rows parsed:", count);
console.log("distinct keys:", Object.keys(table).length, "(expect 495)");
console.log("validation errors:", errors.length);
if (errors.length) console.log(errors.slice(0, 15));

// Cross-check: union of assigned groups per match must equal the code's eligibility.
let eligOk = true;
for (const mn of COL_MATCH) {
  const d = [...derived[mn]].sort().join("");
  const c = [...ELIG[mn]].sort().join("");
  if (d !== c) { eligOk = false; console.log(`MATCH ${mn} ELIGIBILITY DIFF: table=${d} code=${c}`); }
}
console.log("derived eligibility == code eligibility:", eligOk);

// Completeness: every C(12,8)=495 combination present?
const GROUPS = "ABCDEFGHIJKL".split("");
let missing = 0;
const comb = (a, k, s = 0, acc = []) => {
  if (acc.length === k) { if (!table[acc.join("")]) missing++; return; }
  for (let i = s; i < a.length; i++) { acc.push(a[i]); comb(a, k, i + 1, acc); acc.pop(); }
};
comb(GROUPS, 8);
console.log("combos missing from table:", missing);

const clean = count === 495 && Object.keys(table).length === 495 && errors.length === 0 && eligOk && missing === 0;
console.log("\n=== ALL CHECKS PASS:", clean, "===");

if (clean) {
  // Emit a typed data module.
  const keys = Object.keys(table).sort();
  const lines = keys.map((k) => {
    const a = table[k];
    const inner = COL_MATCH.slice().sort((x, y) => x - y).map((mn) => `${mn}:"${a[mn]}"`).join(",");
    return `  ${k}:{${inner}},`;
  });
  const ts = `// AUTO-GENERATED from FIFA's official Annex C (2026 FIFA World Cup third-place\n` +
    `// combinations). Do not edit by hand — regenerate with scripts/parse-annexc.mjs.\n` +
    `// Key = the 8 qualifying groups (sorted, joined). Value = match number → the\n` +
    `// group whose third-placed team is assigned to that Round-of-32 match.\n` +
    `import type { Group } from "@/lib/types";\n\n` +
    `export const ANNEX_C: Record<string, Record<number, Group>> = {\n${lines.join("\n")}\n};\n`;
  writeFileSync("src/lib/annexCTable.ts", ts);
  console.log("wrote src/lib/annexCTable.ts (", keys.length, "rows )");
}
