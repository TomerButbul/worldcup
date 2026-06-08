import { redirect } from "next/navigation";
import { TOURNAMENT_TZ } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import DraftRoom from "./DraftRoom";
import type { FixtureDay } from "./DraftFixtures";
import type { GroupStageGroup } from "./DraftGroupStage";
import {
  type DraftStateRow,
  type PickRow,
  type MemberQueryRow,
  mapMember,
} from "./draftTypes";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import { computeActuals, computeGroupTables, type MatchRow } from "@/lib/scoring-core";
import { teamAt } from "@/lib/draft";
import { getCachedTeams } from "@/lib/tournamentData";
import { draftTeamIds, teamProgressPoints, draftScores } from "@/lib/draft-scoring";
import {
  KNOCKOUT_TEMPLATE,
  buildBracket,
  stageOf,
  type SlotRef,
} from "@/lib/bracket-core";
import type { MatchStage } from "@/lib/types";
import type { BracketRound, BracketTeam } from "@/components/KnockoutBracket";

// Round-column labels — must match BracketEditor.tsx's STAGE_LABELS.
const KO_STAGE_LABELS: Record<string, string> = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter: "Quarter-finals",
  semi: "Semi-finals",
  final: "Final",
};
const KO_STAGE_ORDER: MatchStage[] = ["round_of_32", "round_of_16", "quarter", "semi", "final"];

// Build the read-only knockout bracket from REAL results. The DB has no canonical
// match-number column (matches.id is the API-Football fixture id), and the
// knockout pairings live only in KNOCKOUT_TEMPLATE — so resolve each canonical
// match's two participants from the actual group order (+ Annex C thirds) and the
// winners that have propagated forward, then overlay the real advancer for any tie
// that's been decided. Everything is TBD until the group stage completes (the
// group tables only resolve once every group's matches are finished) and then the
// bracket fills in round by round as knockout results arrive — exactly as intended.
function buildKnockoutRounds(matches: MatchRow[]): BracketRound[] {
  const tables = computeGroupTables(matches);
  const { round32, annex } = buildBracket(tables);

  // Real decided ties → advancer, keyed by the unordered team pair. winner_team_id
  // is correct even for shootouts; fall back to the higher scorer. A level result
  // with no recorded shootout winner (or an unplayed/ongoing tie) stays unresolved.
  const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const winnerByPair = new Map<string, number>();
  for (const m of matches) {
    if (m.stage === "group") continue;
    if (m.status !== "finished" || m.home_team_id == null || m.away_team_id == null) continue;
    if (m.home_goals == null || m.away_goals == null) continue;
    const decisive =
      m.home_goals > m.away_goals
        ? m.home_team_id
        : m.home_goals < m.away_goals
          ? m.away_team_id
          : null;
    const winner = m.winner_team_id ?? decisive;
    if (winner != null) winnerByPair.set(pairKey(m.home_team_id, m.away_team_id), winner);
  }

  // Resolve every canonical match top-down so a later round's participants come
  // from the winners we've already settled. `winners[no]` = advancer of match `no`.
  const winners = new Map<number, number | null>();
  const order = Object.keys(KNOCKOUT_TEMPLATE)
    .map(Number)
    .sort((a, b) => a - b);

  const resolveSlot = (s: SlotRef): number | null => {
    switch (s.kind) {
      case "winner":
        return tables[s.group]?.order[0] ?? null;
      case "runner":
        return tables[s.group]?.order[1] ?? null;
      case "third": {
        const g = annex[s.match];
        return g ? (tables[g]?.order[2] ?? null) : null;
      }
      case "matchWinner":
        return winners.get(s.match) ?? null;
      default:
        return null; // matchLoser does not occur in this template
    }
  };

  const byStage = new Map<MatchStage, { no: number; home: number | null; away: number | null; winner: number | null }[]>();
  for (const no of order) {
    const tpl = KNOCKOUT_TEMPLATE[no];
    // Round of 32 participants come pre-resolved (incl. Annex C thirds); deeper
    // rounds resolve from the winners settled in earlier iterations.
    const home = no <= 88 ? (round32[no]?.home ?? null) : resolveSlot(tpl.home);
    const away = no <= 88 ? (round32[no]?.away ?? null) : resolveSlot(tpl.away);
    const winner =
      home != null && away != null ? (winnerByPair.get(pairKey(home, away)) ?? null) : null;
    winners.set(no, winner);
    const st = stageOf(no);
    if (!byStage.has(st)) byStage.set(st, []);
    byStage.get(st)!.push({ no, home, away, winner });
  }

  return KO_STAGE_ORDER.filter((s) => byStage.has(s)).map((s) => ({
    stage: s,
    label: KO_STAGE_LABELS[s],
    matches: byStage.get(s)!.sort((a, b) => a.no - b.no),
  }));
}

// Tabs for the completed-draft view. The draft room's own section tabs drive the
// ?tab= value; here we just read it and gate which section renders. "board" is the
// default/fallback.
const DRAFT_TABS = ["board", "groups", "bracket", "fixtures"] as const;
type DraftTab = (typeof DRAFT_TABS)[number];

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab: DraftTab = DRAFT_TABS.includes(tabParam as DraftTab)
    ? (tabParam as DraftTab)
    : "board";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, join_code, owner_id, bracket_lock_at, kind, is_global")
    .eq("id", id)
    .maybeSingle();
  // Logged in but not a member (RLS hides the row) → their own dashboard, not a 404.
  if (!league) redirect("/dashboard");
  // The global "World" league isn't a normal friends league — its leaderboard IS
  // the worldwide board, so send anyone who lands on it to /rankings instead.
  if (league.is_global) redirect("/rankings");

  // A prediction (friend) league is now just a filtered leaderboard — same
  // account-level picks, same scoring, only the member list differs — so its board
  // lives in the Rankings hub. No separate "league page" to get lost in. Only draft
  // leagues (a different game) keep their own room below.
  if ((league.kind ?? "classic") !== "draft") redirect(`/rankings?league=${id}`);

  if (league.kind === "draft") {
    const [stateRes, picksRes, membersRes] = await Promise.all([
      supabase
        .from("draft_state")
        .select("status, current_pick_index, timer_enabled, turn_started_at")
        .eq("league_id", id)
        .maybeSingle(),
      supabase
        .from("draft_picks")
        .select("user_id, pot, slot, pick_no")
        .eq("league_id", id)
        .order("pick_no"),
      supabase
        .from("league_members")
        .select("user_id, draft_seat, profiles ( display_name, team_name, avatar_url )")
        .eq("league_id", id),
    ]);

    const initialState: DraftStateRow = (stateRes.data as DraftStateRow | null) ?? {
      status: "not_started",
      current_pick_index: 0,
      timer_enabled: false,
      turn_started_at: null,
    };
    const initialPicks = (picksRes.data as PickRow[] | null) ?? [];
    const initialMembers = ((membersRes.data as unknown as MemberQueryRow[] | null) ?? []).map(
      mapMember,
    );

    // Draft standings: each drafted team's tournament progress → 3 independent
    // pot competitions + a bragging-rights total. Fills in as matches play.
    const [matchesRes, teamsRes, lineupsRes, fullTeams] = await Promise.all([
      supabase
        .from("matches")
        .select("id, stage, group_label, status, home_team_id, away_team_id, home_goals, away_goals, winner_team_id, kickoff_at"),
      supabase.from("teams").select("id, name"),
      supabase.from("team_lineups").select("team_id, formation, xi"),
      // Full 48-team list (crests + group + FIFA rank) for the group-stage cards.
      getCachedTeams(),
    ]);
    const actual = computeActuals((matchesRes.data ?? []) as MatchRow[], new Map());
    const idByDraftName = draftTeamIds(teamsRes.data ?? []);
    // Map each draft-pool team name → its most-recent lineup (for the tap view).
    const lineupById = new Map(
      (lineupsRes.data ?? []).map((l) => [l.team_id, { formation: l.formation, xi: l.xi }]),
    );
    const teamLineups: Record<string, { formation: string | null; xi: unknown[] }> = {};
    for (const [name, tid] of idByDraftName) {
      const lu = lineupById.get(tid);
      if (lu) teamLineups[name] = lu as { formation: string | null; xi: unknown[] };
    }
    const standings = draftScores(initialPicks, (pot, slot) => {
      const team = teamAt(pot, slot);
      const teamId = team ? (idByDraftName.get(team.name) ?? null) : null;
      return teamProgressPoints(teamId, actual.advancers, actual.champion);
    });

    // Matchday "managers" view: who drafted each nation, mapped onto the fixture
    // list grouped by day. Resolved fully here so no Maps cross to the client.
    const memberById = new Map(initialMembers.map((m) => [m.userId, m]));
    const teamNameById = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name as string]));
    const managerByTeamId = new Map<number, string>();
    for (const p of initialPicks) {
      const team = teamAt(p.pot, p.slot);
      const tid = team ? idByDraftName.get(team.name) : undefined;
      const mgr = memberById.get(p.user_id);
      if (tid != null && mgr) managerByTeamId.set(tid, mgr.name);
    }
    // Group league fixtures by the tournament (host) day so the day matches the header
    // FixturesList renders (also tournament TZ), instead of the server's zone.
    const fxDayLabel = (iso: string) =>
      new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: TOURNAMENT_TZ });
    const fixtures: FixtureDay[] = [];
    const sortedFixtures = [...(matchesRes.data ?? [])].sort(
      (a, b) => new Date(a.kickoff_at ?? 0).getTime() - new Date(b.kickoff_at ?? 0).getTime(),
    );
    for (const m of sortedFixtures) {
      if (!m.kickoff_at) continue;
      const day = fxDayLabel(m.kickoff_at);
      const row = {
        id: m.id,
        homeTeamId: m.home_team_id,
        awayTeamId: m.away_team_id,
        homeName: m.home_team_id ? (teamNameById.get(m.home_team_id) ?? "TBD") : "TBD",
        awayName: m.away_team_id ? (teamNameById.get(m.away_team_id) ?? "TBD") : "TBD",
        homeMgr: m.home_team_id ? (managerByTeamId.get(m.home_team_id) ?? null) : null,
        awayMgr: m.away_team_id ? (managerByTeamId.get(m.away_team_id) ?? null) : null,
        kickoff: m.kickoff_at,
        status: m.status,
        homeGoals: m.home_goals,
        awayGoals: m.away_goals,
      };
      const last = fixtures[fixtures.length - 1];
      if (last && last.day === day) last.matches.push(row);
      else fixtures.push({ day, matches: [row] });
    }

    // Read-only knockout bracket: the real tournament tree, resolved from actual
    // results, with THIS manager's three drafted nations highlighted along their
    // path. TBD until the knockouts fill in (see buildKnockoutRounds).
    const koRounds = buildKnockoutRounds((matchesRes.data ?? []) as MatchRow[]);
    const bracketTeams: Record<number, BracketTeam> = {};
    for (const t of teamsRes.data ?? []) {
      bracketTeams[t.id] = { id: t.id, name: t.name, code: null, logo_url: null };
    }
    const meTeamIds = initialPicks
      .filter((p) => p.user_id === user.id)
      .map((p) => {
        const team = teamAt(p.pot, p.slot);
        return team ? (idByDraftName.get(team.name) ?? null) : null;
      })
      .filter((id): id is number => id != null);

    // Group-stage board: all 12 groups, each in finishing order. Live tables come
    // from real results (computeGroupTables resolves a group only once all its
    // matches are finished); pre-tournament / incomplete groups fall back to FIFA
    // rank (best first, nulls last), then name. Fully resolved here — no Maps cross
    // to the client; pts/played are null until a group's table is live.
    const groupTables = computeGroupTables((matchesRes.data ?? []) as MatchRow[]);
    const teamsByGroup = new Map<string, (typeof fullTeams)[number][]>();
    for (const t of fullTeams) {
      if (!t.group_label) continue;
      let list = teamsByGroup.get(t.group_label);
      if (!list) teamsByGroup.set(t.group_label, (list = []));
      list.push(t);
    }
    const groupStage: GroupStageGroup[] = [...teamsByGroup.keys()]
      .sort()
      .map((label) => {
        const teams = teamsByGroup.get(label)!;
        const byId = new Map(teams.map((t) => [t.id, t]));
        const table = groupTables[label];
        // Live order if this group's table has resolved for all 4 teams; else
        // FIFA rank ascending (nulls last), then name.
        const live = table && table.order.length === teams.length;
        const ordered = live
          ? table.order.map((tid) => byId.get(tid)).filter((t): t is (typeof teams)[number] => t != null)
          : [...teams].sort(
              (a, b) =>
                (a.fifa_rank ?? Number.MAX_SAFE_INTEGER) - (b.fifa_rank ?? Number.MAX_SAFE_INTEGER) ||
                a.name.localeCompare(b.name),
            );
        return {
          group: label,
          teams: ordered.map((t) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            logo_url: t.logo_url,
            pts: live ? (table.stats.get(t.id)?.pts ?? 0) : null,
            played: live ? 3 : null,
          })),
        };
      });

    return (
      <DraftRoom
        tab={tab}
        leagueId={id}
        leagueName={league.name}
        meId={user.id}
        isOwner={league.owner_id === user.id}
        initialState={initialState}
        initialPicks={initialPicks}
        initialMembers={initialMembers}
        standings={standings}
        teamLineups={teamLineups}
        fixtures={fixtures}
        koRounds={koRounds}
        bracketTeams={bracketTeams}
        meTeamIds={meTeamIds}
        groupStage={groupStage}
        tournamentStarted={nowMs() >= KICKOFF_MS}
      />
    );
  }
}
