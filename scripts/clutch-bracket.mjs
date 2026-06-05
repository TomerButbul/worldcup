// Fill Gemini's (Clutch's) WC2026 bracket. Same validated engine. Gemini's round
// lists collide with the fixed pairings in two spots (France/Germany both QF;
// Brazil+England+Argentina all "SF") — its explicit PODIUM (France champ,
// Argentina runner-up, Brazil 3rd) is honored exactly and the bracket resolves
// the rest. Every winner asserted to be a real participant, then upserted + awards.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const CLUTCH = "54f09def-cfcd-4d2d-bb90-73726221318a";
const GLOBAL = "bdd3f466-a770-409f-b0b5-24816b60156e";

const ID = {
  Mexico:16,SouthKorea:17,Czech:770,SouthAfrica:1531, Switzerland:15,Canada:5529,Qatar:1569,Bosnia:1113,
  Brazil:6,Morocco:31,Scotland:1108,Haiti:2386, USA:2384,Turkiye:777,Australia:20,Paraguay:2380,
  Germany:25,Ecuador:2382,IvoryCoast:1501,Curacao:5530, Netherlands:1118,Japan:12,Sweden:5,Tunisia:28,
  Belgium:1,Iran:22,Egypt:32,NewZealand:4673, Spain:9,Uruguay:7,Saudi:23,CapeVerde:1533,
  France:2,Senegal:13,Norway:1090,Iraq:1567, Argentina:26,Austria:775,Algeria:1532,Jordan:1548,
  Portugal:27,Colombia:8,CongoDR:1508,Uzbekistan:1568, England:10,Croatia:3,Panama:11,Ghana:1504,
};
const NAME = Object.fromEntries(Object.entries(ID).map(([k, v]) => [v, k]));

const ORDER_N = {
  A:["Mexico","Czech","SouthKorea","SouthAfrica"], B:["Switzerland","Canada","Bosnia","Qatar"],
  C:["Brazil","Morocco","Scotland","Haiti"], D:["USA","Turkiye","Australia","Paraguay"],
  E:["Germany","Ecuador","IvoryCoast","Curacao"], F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Egypt","Iran","NewZealand"], H:["Spain","Uruguay","Saudi","CapeVerde"],
  I:["France","Senegal","Norway","Iraq"], J:["Argentina","Austria","Algeria","Jordan"],
  K:["Portugal","Colombia","Uzbekistan","CongoDR"], L:["England","Croatia","Ghana","Panama"],
};
const group_order = Object.fromEntries(Object.entries(ORDER_N).map(([g, a]) => [g, a.map((n) => ID[n])]));
const third_qualifiers = ["A","B","C","D","F","I","J","L"];

const w=(g)=>({w:g}), r=(g)=>({r:g}), th=()=>({third:true}), W=(m)=>({W:m});
const R32 = {
  73:[r("A"),r("B")],74:[w("E"),th()],75:[w("F"),r("C")],76:[w("C"),r("F")],
  77:[w("I"),th()],78:[r("E"),r("I")],79:[w("A"),th()],80:[w("L"),th()],
  81:[w("D"),th()],82:[w("G"),th()],83:[r("K"),r("L")],84:[w("H"),r("J")],
  85:[w("B"),th()],86:[w("J"),r("H")],87:[w("K"),th()],88:[r("D"),r("G")],
};
const TREE = {
  89:[W(74),W(77)],90:[W(73),W(75)],91:[W(76),W(78)],92:[W(79),W(80)],
  93:[W(83),W(84)],94:[W(81),W(82)],95:[W(86),W(88)],96:[W(85),W(87)],
  97:[W(89),W(90)],98:[W(93),W(94)],99:[W(91),W(92)],100:[W(95),W(96)],
  101:[W(97),W(98)],102:[W(99),W(100)],104:[W(101),W(102)],
};
const PICK_N = {
  73:"Canada",74:"Germany",75:"Netherlands",76:"Brazil",77:"France",78:"Senegal",
  79:"Mexico",80:"England",81:"USA",82:"Belgium",83:"Croatia",84:"Spain",
  85:"Switzerland",86:"Argentina",87:"Portugal",88:"Turkiye",
  89:"France",90:"Netherlands",91:"Brazil",92:"England",93:"Spain",94:"Belgium",
  95:"Argentina",96:"Portugal",97:"France",98:"Spain",99:"Brazil",100:"Argentina",
  101:"France",102:"Argentina",104:"France",103:"Brazil",
};
const pick = Object.fromEntries(Object.entries(PICK_N).map(([m, n]) => [m, ID[n]]));

const winners = {};
const slot = (s) => (s.w ? group_order[s.w][0] : s.r ? group_order[s.r][1] : s.third ? null : winners[s.W] ?? null);
const errors = [];
for (const m of [...Object.keys(R32), ...Object.keys(TREE)].map(Number).sort((a, b) => a - b)) {
  const tpl = R32[m] || TREE[m];
  const home = slot(tpl[0]), away = slot(tpl[1]), p = pick[m];
  if (p !== home && p !== away) errors.push(`match ${m}: ${NAME[p]} not in {${NAME[home] ?? "?"}, ${NAME[away] ?? "third"}}`);
  winners[m] = p;
}
const loser = (m) => { const t = TREE[m]; const h = slot(t[0]), a = slot(t[1]); return winners[m] === h ? a : h; };
const l101 = loser(101), l102 = loser(102);
if (pick[103] !== l101 && pick[103] !== l102) errors.push(`103: ${NAME[pick[103]]} not in {${NAME[l101]}, ${NAME[l102]}}`);
winners[103] = pick[103];

const stage = (m) => (m <= 88 ? "R32" : m <= 96 ? "R16" : m <= 100 ? "QF " : m <= 102 ? "SF " : m === 103 ? "3rd" : "FIN");
for (const m of Object.keys(winners).map(Number).sort((a, b) => a - b)) {
  const t = R32[m] || TREE[m];
  const h = m === 103 ? l101 : slot(t[0]), a = m === 103 ? l102 : slot(t[1]);
  console.log(`${stage(m)} ${m}: ${(NAME[h] || "3rd").padEnd(11)} vs ${(NAME[a] || "3rd").padEnd(11)} -> ${NAME[winners[m]]}`);
}
console.log("CHAMPION:", NAME[winners[104]], "| ERRORS:", errors.length ? errors : "none");
if (errors.length) process.exit(1);

const knockout = Object.fromEntries(Object.entries(winners).map(([m, id]) => [String(m), id]));
const awards = { golden_boot: 278, golden_ball: 129718, golden_glove: 22221, young_player: 386828 };
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const now = new Date().toISOString();
const { error } = await sb.from("bracket_predictions").upsert(
  { league_id: GLOBAL, user_id: CLUTCH, group_order, third_qualifiers, knockout, champion_team_id: ID.France, awards, submitted_at: now, updated_at: now },
  { onConflict: "league_id,user_id" },
);
console.log("UPSERT:", error ? error.message : "ok");
