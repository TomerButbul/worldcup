// Add the REAL Republic of Ireland (API id 776) + its squad so the live proxy
// test (Canada v Ireland, fixture 1528285) resolves real lineups/scorers.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const key = env.API_FOOTBALL_KEY;
const af = async (path) => (await (await fetch("https://v3.football.api-sports.io" + path, { headers: { "x-apisports-key": key } })).json()).response ?? [];

// 1) Team
const [team] = await af("/teams?id=776");
if (!team) { console.error("no team 776"); process.exit(1); }
let e = (await sb.from("teams").upsert({ id: 776, name: team.team.name, code: team.team.code ?? "IRL", logo_url: team.team.logo ?? null, group_label: null }, { onConflict: "id" })).error;
if (e) { console.error("team", e.message); process.exit(1); }

// 2) Squad
const squads = await af("/players/squads?team=776");
const players = (squads[0]?.players ?? []).map((p) => ({
  id: p.id, name: p.name, team_id: 776, position: p.position ?? null, age: p.age ?? null, number: p.number ?? null, photo_url: p.photo ?? null, in_squad: true,
}));
if (players.length) {
  e = (await sb.from("players").upsert(players, { onConflict: "id" })).error;
  if (e) { console.error("players", e.message); process.exit(1); }
}
console.log("OK — Ireland 776:", team.team.name, "| players:", players.length, "| forwards:",
  players.filter((p) => p.position === "Attacker").map((p) => `${p.id}:${p.name}`).join(", "));
