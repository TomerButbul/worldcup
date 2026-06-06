import { BRACKET_TREE, buildBracket, stageOf } from "@/lib/bracket-core";
import { computeGroupTables, type MatchRow } from "@/lib/scoring-core";
import type { MatchStage } from "@/lib/types";
import type { BracketRound } from "@/components/KnockoutBracket";

// Resolve the REAL knockout bracket from actual results — the live counterpart to
// predictedBracketView. The canonical KNOCKOUT_TEMPLATE supplies the tree's shape
// (which tie feeds which), and the actual `matches` rows supply who advanced:
//
//  • Round of 32 participants come from buildBracket(group tables) — i.e. the real
//    group winners/runners + the eight best third-placed teams — but only once a
//    group is mathematically settled (all its games finished).
//  • Each tie's winner comes from the matching real fixture (looked up by its two
//    participants), using winner_team_id (correct for shootouts) or the scoreline.
//  • Later rounds resolve from the winners of their feeder ties, so the bracket
//    fills in for real as the tournament plays out.
//
// Before the group stage finishes the tree is all-TBD (the honest "not decided
// yet" state) and renders as the empty skeleton.

export interface ActualMatch {
  id: number;
  stage: string;
  group_label: string | null;
  status: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_goals: number | null;
  away_goals: number | null;
  winner_team_id?: number | null;
}

export interface ActualBracket {
  rounds: BracketRound[]; // R32 → 3rd place → Final, in tournament order
  champion: number | null;
  runnerUp: number | null;
  third: number | null;
}

const STAGE_ORDER: MatchStage[] = ["round_of_32", "round_of_16", "quarter", "semi", "final"];
const STAGE_LABEL: Record<string, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarter-finals",
  semi: "Semi-finals",
  final: "Final",
};

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// The team that advanced from a finished knockout fixture: the API's winner flag
// (handles penalty shootouts) first, else the higher scorer.
function advancerOf(m: ActualMatch): number | null {
  if (m.winner_team_id != null) return m.winner_team_id;
  if (m.home_goals == null || m.away_goals == null) return null;
  if (m.home_goals > m.away_goals) return m.home_team_id;
  if (m.home_goals < m.away_goals) return m.away_team_id;
  return null; // level with no recorded shootout winner — undecided
}

export function resolveActualBracket(
  matches: ActualMatch[],
  fifaRank: Map<number, number> = new Map(),
): ActualBracket {
  // 1. Real group tables → Round of 32 participants (settled groups only).
  const tables = computeGroupTables(matches as MatchRow[], fifaRank);
  const { round32 } = buildBracket(tables, fifaRank);

  // 2. Index every knockout fixture (both teams known) by its participant pair, so
  //    a resolved tie can find its real result. Finished fixtures win ties.
  const koByPair = new Map<string, ActualMatch>();
  let thirdPlaceFixture: ActualMatch | null = null;
  let finalFixture: ActualMatch | null = null;
  for (const m of matches) {
    if (m.stage === "group") continue;
    if (m.stage === "third_place") {
      if (!thirdPlaceFixture || m.status === "finished") thirdPlaceFixture = m;
      continue;
    }
    if (m.stage === "final" && (!finalFixture || m.status === "finished")) finalFixture = m;
    if (m.home_team_id == null || m.away_team_id == null) continue;
    const key = pairKey(m.home_team_id, m.away_team_id);
    const existing = koByPair.get(key);
    if (!existing || (m.status === "finished" && existing.status !== "finished")) koByPair.set(key, m);
  }

  // 3. Walk the template in canonical order, resolving participants then winners.
  const participants: Record<number, { home: number | null; away: number | null }> = {};
  const winners: Record<number, number> = {};
  const resultFixture = (home: number | null, away: number | null): ActualMatch | undefined =>
    home != null && away != null ? koByPair.get(pairKey(home, away)) : undefined;

  for (let no = 73; no <= 104; no++) {
    if (no === 103) continue; // 3rd-place playoff handled separately below
    let home: number | null;
    let away: number | null;
    if (no <= 88) {
      home = round32[no]?.home ?? null;
      away = round32[no]?.away ?? null;
    } else {
      const tpl = BRACKET_TREE[no];
      home = winners[tpl.home.kind === "matchWinner" ? tpl.home.match : -1] ?? null;
      away = winners[tpl.away.kind === "matchWinner" ? tpl.away.match : -1] ?? null;
    }
    participants[no] = { home, away };
    const fx = resultFixture(home, away);
    if (fx && fx.status === "finished") {
      const w = advancerOf(fx);
      if (w != null) winners[no] = w;
    }
  }

  // The Final is a single, unique fixture — let its real result be authoritative
  // for the crown even when an upstream data gap left match 104 unresolved by the
  // template (so a played final always shows its champion + runner-up).
  if (finalFixture && finalFixture.home_team_id != null && finalFixture.away_team_id != null) {
    participants[104] = { home: finalFixture.home_team_id, away: finalFixture.away_team_id };
    if (finalFixture.status === "finished") {
      const w = advancerOf(finalFixture);
      if (w != null) winners[104] = w;
    }
  }

  // 4. Third-place playoff (canonical 103): use the real fixture if present, else
  //    derive the two losing semi-finalists so the slot at least shows the matchup.
  const semiLoser = (no: number): number | null => {
    const p = participants[no];
    const w = winners[no];
    if (!p || p.home == null || p.away == null || w == null) return null;
    return p.home === w ? p.away : p.home;
  };
  let third103: { home: number | null; away: number | null; winner: number | null };
  if (thirdPlaceFixture && thirdPlaceFixture.home_team_id != null && thirdPlaceFixture.away_team_id != null) {
    third103 = {
      home: thirdPlaceFixture.home_team_id,
      away: thirdPlaceFixture.away_team_id,
      winner: thirdPlaceFixture.status === "finished" ? advancerOf(thirdPlaceFixture) : null,
    };
  } else {
    third103 = { home: semiLoser(101), away: semiLoser(102), winner: null };
  }

  // 5. Shape into display rounds (R32 → Final), inserting the 3rd-place round just
  //    before the Final — exactly what <KnockoutBracket> consumes.
  const byStage = new Map<MatchStage, number[]>();
  for (let no = 73; no <= 104; no++) {
    if (no === 103) continue;
    const st = stageOf(no);
    if (!byStage.has(st)) byStage.set(st, []);
    byStage.get(st)!.push(no);
  }
  const rounds: BracketRound[] = STAGE_ORDER.filter((s) => byStage.has(s)).map((s) => ({
    stage: s,
    label: STAGE_LABEL[s],
    matches: byStage
      .get(s)!
      .sort((a, b) => a - b)
      .map((no) => ({
        no,
        home: participants[no]?.home ?? null,
        away: participants[no]?.away ?? null,
        winner: winners[no] ?? null,
      })),
  }));
  const thirdRound: BracketRound = {
    stage: "third_place",
    label: "3rd-place playoff",
    matches: [{ no: 103, home: third103.home, away: third103.away, winner: third103.winner }],
  };
  const finalIdx = rounds.findIndex((r) => r.stage === "final");
  if (finalIdx >= 0) rounds.splice(finalIdx, 0, thirdRound);
  else rounds.push(thirdRound);

  const champion = winners[104] ?? null;
  const finalP = participants[104];
  const runnerUp = finalP && champion != null ? (finalP.home === champion ? finalP.away : finalP.home) : null;

  return { rounds, champion, runnerUp, third: third103.winner };
}
