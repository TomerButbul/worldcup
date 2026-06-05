// Sets up the private Canada v Ireland test game for tomerbutbuleast@gmail.com.
// All ids are in a sentinel range (team 9001, players 91000xx, match 9_000_001)
// so the global lists can hide them with one `id < 9_000_000` filter, and the
// prediction lives in a private "Sandbox" league so scoring never hits the
// public board. Idempotent (upserts). Run: node scripts/test-game-setup.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TOMER = "9d0206aa-8278-4053-8a07-c2a0f069b98c";
const IRELAND = 9001, CANADA = 5529, MATCH = 9_000_001;
const fail = (label, e) => { if (e) { console.error(label, e.message); process.exit(1); } };

// 1) Ireland team
fail("team", (await sb.from("teams").upsert({ id: IRELAND, name: "Ireland", code: "IRL", group_label: null, fifa_rank: 60 }, { onConflict: "id" })).error);

// 2) Ireland squad (sentinel ids)
const squad = [
  [9100001, "C. Kelleher", "Goalkeeper", "1:1"], [9100002, "N. Collins", "Defender", "2:1"],
  [9100003, "D. O'Shea", "Defender", "2:2"], [9100004, "M. Doherty", "Defender", "2:3"],
  [9100005, "R. Brady", "Defender", "2:4"], [9100006, "J. Cullen", "Midfielder", "3:1"],
  [9100007, "J. Molumby", "Midfielder", "3:2"], [9100008, "J. McGrath", "Midfielder", "3:3"],
  [9100009, "E. Ferguson", "Attacker", "4:1"], [9100010, "C. Ogbene", "Attacker", "4:2"],
  [9100011, "T. Parrott", "Attacker", "4:3"], [9100012, "A. Idah", "Attacker", "4:1"],
];
fail("players", (await sb.from("players").upsert(
  squad.map(([id, name, position]) => ({ id, name, position, team_id: IRELAND, in_squad: true })), { onConflict: "id" },
)).error);

// 3) Ireland lineup (first 11 start)
const xi = squad.slice(0, 11).map(([player_id, name, pos, grid]) => ({ player_id, name, pos, grid }));
fail("lineup", (await sb.from("team_lineups").upsert({ team_id: IRELAND, xi }, { onConflict: "team_id" })).error);

// 4) The test match — kickoff ~24h out, group stage but NO group label (can't touch standings)
const kickoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
fail("match", (await sb.from("matches").upsert({
  id: MATCH, stage: "group", group_label: null, kickoff_at: kickoff, status: "scheduled",
  home_team_id: CANADA, away_team_id: IRELAND, home_goals: null, away_goals: null,
  venue_name: "BMO Field", venue_city: "Toronto", goals_synced: false,
}, { onConflict: "id" })).error);

// 5) Private Sandbox league for the prediction (scoring stays off the public board)
const SANDBOX = "00000000-0000-4000-8000-000000000001"; // fixed uuid so re-runs are idempotent
fail("league", (await sb.from("leagues").upsert({
  id: SANDBOX, name: "Sandbox (test)", join_code: "SANDBOXX", owner_id: TOMER, kind: "regular", is_global: false,
}, { onConflict: "id" })).error);
fail("member", (await sb.from("league_members").upsert({ league_id: SANDBOX, user_id: TOMER }, { onConflict: "league_id,user_id" })).error);

// 6) Tomer's prediction: Canada 3-1 — David x2, Larin x1; Ferguson for Ireland
fail("pred", (await sb.from("match_predictions").upsert({
  league_id: SANDBOX, user_id: TOMER, match_id: MATCH, home_goals: 3, away_goals: 1,
  scorer_goals: { "8489": 2, "2001": 1, "9100009": 1 }, submitted_at: new Date().toISOString(),
}, { onConflict: "league_id,user_id,match_id" })).error);

console.log("OK — match", MATCH, "kickoff", kickoff, "sandbox", SANDBOX);
