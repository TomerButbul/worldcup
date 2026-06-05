// Final wiring for tonight's Canada–Ireland dress rehearsal (proxy match 9000001):
//  - switch away team from the fake Ireland (9001) to the REAL one (776)
//  - fix tomer's scorer pick (fake 9100009 -> real Idah 130417)
//  - clear stale child rows + a clean pre-game slate (earlier sandbox playthrough)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const MATCH = 9000001;
const TOMER = "9d0206aa-8278-4053-8a07-c2a0f069b98c";
const chk = (label, e) => { if (e) { console.error(label, e.message); process.exit(1); } };

// 1) Real Ireland as away team + clean pre-game slate on the match row.
chk("match", (await sb.from("matches").update({
  away_team_id: 776,
  status: "scheduled", status_short: null, elapsed: null, second_half_at: null,
  home_goals: null, away_goals: null, winner_team_id: null,
  goals_synced: false, notified_home_goals: null, notified_away_goals: null,
}).eq("id", MATCH)).error);

// 2) Fix the scorer pick: keep Canada (Larin 2001 x1, J.David 8489 x2), swap the
//    fake Ireland scorer for real striker Idah (130417). Still Canada 3–1 Ireland.
chk("pred", (await sb.from("match_predictions").update({
  scorer_goals: { "2001": 1, "8489": 2, "130417": 1 },
}).eq("match_id", MATCH).eq("user_id", TOMER)).error);

// 3) Wipe stale child rows from the earlier sandbox playthrough so the proxy
//    sync repopulates everything fresh from the real fixture tonight.
for (const t of ["match_goals", "match_events", "match_cards", "match_lineups", "match_stats", "match_player_stats"]) {
  chk(t, (await sb.from(t).delete().eq("match_id", MATCH)).error);
}

const { data: m } = await sb.from("matches").select("id,home_team_id,away_team_id,status,api_fixture_id,kickoff_at").eq("id", MATCH).single();
const { data: p } = await sb.from("match_predictions").select("home_goals,away_goals,scorer_goals").eq("match_id", MATCH).eq("user_id", TOMER).single();
console.log("MATCH:", JSON.stringify(m));
console.log("PRED :", JSON.stringify(p));
console.log("OK — proxy match wired to real Canada(5529) vs Ireland(776), child tables cleared.");
