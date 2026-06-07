// Flip a REAL match's status (+ a mock lineup & a goal) so you can feel out the live
// / finished cards on the Matches page, then reset it. Writes to your Supabase, so
// RESET when done (a "finished" match counts toward standings until you do).
//
//   node scripts/sim-match.mjs live            # soonest upcoming → live, 2–1, mock XI
//   node scripts/sim-match.mjs finished        # soonest upcoming → 2–1 final
//   node scripts/sim-match.mjs reset <matchId> # restore it (clears the mock lineup too)
//
// Predict the match first (on /predict) so the finished card shows your right/wrong.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const mode = process.argv[2];
let matchId = process.argv[3] ? Number(process.argv[3]) : null;
if (!["live", "finished", "reset"].includes(mode)) {
  console.error("Usage: node scripts/sim-match.mjs <live|finished|reset> [matchId]");
  process.exit(1);
}

if (!matchId) {
  const { data, error } = await sb
    .from("matches")
    .select("id")
    .lt("id", 9_000_000)
    .eq("status", "scheduled")
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1);
  if (error) { console.error(error.message); process.exit(1); }
  if (!data?.length) { console.error("No upcoming scheduled match found — pass a matchId."); process.exit(1); }
  matchId = data[0].id;
}

const { data: match } = await sb.from("matches").select("id, home_team_id, away_team_id").eq("id", matchId).maybeSingle();
if (!match) { console.error("Match", matchId, "not found"); process.exit(1); }

const patch =
  mode === "live"
    ? { status: "live", status_short: "2H", elapsed: 67, home_goals: 2, away_goals: 1, winner_team_id: null }
    : mode === "finished"
      ? { status: "finished", status_short: "FT", elapsed: 90, home_goals: 2, away_goals: 1, winner_team_id: match.home_team_id, goals_synced: false }
      : { status: "scheduled", status_short: null, elapsed: null, home_goals: null, away_goals: null, winner_team_id: null };

if ((await sb.from("matches").update(patch).eq("id", matchId)).error) {
  console.error("status update failed"); process.exit(1);
}

// Mock lineup + events + stats live only while the match is "in play"; reset clears them.
await sb.from("match_lineups").delete().eq("match_id", matchId);
await sb.from("match_events").delete().eq("match_id", matchId);
await sb.from("match_stats").delete().eq("match_id", matchId);

if (mode !== "reset") {
  try {
    const grids = ["1:1", "2:1", "2:2", "2:3", "2:4", "3:1", "3:2", "3:3", "3:4", "4:1", "4:2"];
    const poss = ["G", "D", "D", "D", "D", "M", "M", "M", "M", "F", "F"];
    const buildXI = async (teamId) => {
      if (teamId == null) return null;
      const { data } = await sb.from("players").select("id, name").eq("team_id", teamId).eq("in_squad", true).limit(18);
      if (!data?.length) return null;
      const xi = data.slice(0, 11).map((p, i) => ({ player_id: p.id, name: p.name, number: null, pos: poss[i], grid: grids[i] }));
      // Bench so the lineup shows sub info (no grid → not placed on the pitch).
      const subs = data.slice(11, 18).map((p) => ({ player_id: p.id, name: p.name, number: null, pos: null, grid: null }));
      return { match_id: matchId, team_id: teamId, formation: "4-4-2", xi, subs };
    };
    const rows = (await Promise.all([buildXI(match.home_team_id), buildXI(match.away_team_id)])).filter(Boolean);
    if (rows.length) await sb.from("match_lineups").insert(rows);

    const home = rows.find((r) => r.team_id === match.home_team_id);
    if (home) {
      const scorer = home.xi.find((p) => p.pos === "F") ?? home.xi[0];
      const booked = home.xi.find((p) => p.pos === "M") ?? home.xi[0];
      await sb.from("match_events").insert([
        { match_id: matchId, team_id: match.home_team_id, type: "goal", detail: "Normal Goal", player_id: scorer.player_id, player_name: scorer.name, minute: 30, sort: 1 },
        { match_id: matchId, team_id: match.home_team_id, type: "card", detail: "Yellow Card", player_id: booked.player_id, player_name: booked.name, minute: 55, sort: 2 },
      ]);
    }

    // Mock per-team stats (API-Football key names) so the card's Stats panel has bars.
    if (match.home_team_id != null && match.away_team_id != null) {
      await sb.from("match_stats").insert([
        { match_id: matchId, team_id: match.home_team_id, stats: { "Ball Possession": "58%", "Total Shots": 14, "Shots on Goal": 6, "Shots insidebox": 9, "Corner Kicks": 7, Fouls: 9, Offsides: 2, "Goalkeeper Saves": 2, "Passes accurate": 412, "Passes %": "87%", "Yellow Cards": 1, "Red Cards": 0, expected_goals: "2.10" } },
        { match_id: matchId, team_id: match.away_team_id, stats: { "Ball Possession": "42%", "Total Shots": 7, "Shots on Goal": 3, "Shots insidebox": 4, "Corner Kicks": 3, Fouls: 13, Offsides: 1, "Goalkeeper Saves": 4, "Passes accurate": 298, "Passes %": "79%", "Yellow Cards": 2, "Red Cards": 0, expected_goals: "0.80" } },
      ]);
    }
  } catch (e) {
    console.warn("(lineup/events/stats skipped:", e.message, ")");
  }
}

console.log(`OK — match ${matchId} → ${mode}`);
if (mode !== "reset") console.log(`Reset when done:  node scripts/sim-match.mjs reset ${matchId}`);
