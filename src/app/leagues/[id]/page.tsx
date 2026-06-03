import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Leaderboard from "./Leaderboard";
import LeagueNameEditor from "./LeagueNameEditor";
import DraftRoom from "./DraftRoom";
import type { FixtureDay } from "./DraftFixtures";
import {
  type DraftStateRow,
  type PickRow,
  type MemberQueryRow,
  mapMember,
} from "./draftTypes";
import { btnClass, GOLD_GRADIENT } from "@/components/buttonStyles";
import Reveal from "@/components/Reveal";
import Ball from "@/components/art/Ball";
import Trophy from "@/components/art/Trophy";
import AutoRefresh from "@/components/AutoRefresh";
import LeagueIntro from "@/components/LeagueIntro";
import { nowMs, KICKOFF_MS } from "@/lib/clock";
import { computeActuals, computeGroupTables, type MatchRow } from "@/lib/scoring-core";
import { teamAt } from "@/lib/draft";
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

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const { data: league } = await supabase
    .from("leagues")
    .select("id, name, join_code, owner_id, bracket_lock_at, kind")
    .eq("id", id)
    .maybeSingle();
  // Logged in but not a member (RLS hides the row) → their own dashboard, not a 404.
  if (!league) redirect("/dashboard");

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
    const [matchesRes, teamsRes, lineupsRes] = await Promise.all([
      supabase
        .from("matches")
        .select("id, stage, group_label, status, home_team_id, away_team_id, home_goals, away_goals, winner_team_id, kickoff_at"),
      supabase.from("teams").select("id, name"),
      supabase.from("team_lineups").select("team_id, formation, xi"),
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
    const fxDayLabel = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
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

    return (
      <DraftRoom
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
        tournamentStarted={nowMs() >= KICKOFF_MS}
      />
    );
  }

  const locked = new Date(league.bracket_lock_at).getTime() <= nowMs();

  const { data: scores } = await supabase
    .from("scores")
    .select("user_id, upfront_points, live_points, total_points, profiles ( display_name, team_name, avatar_url, favorite_team_id )")
    .eq("league_id", id)
    .order("total_points", { ascending: false });

  const rows = (scores ?? []).map((s) => {
    const p = s.profiles as unknown as {
      display_name: string;
      team_name: string | null;
      avatar_url: string | null;
      favorite_team_id: number | null;
    };
    return {
      user_id: s.user_id,
      name: p?.team_name || p?.display_name || "?",
      avatarUrl: p?.avatar_url ?? null,
      favTeamId: p?.favorite_team_id ?? null,
      upfront: s.upfront_points,
      live: s.live_points,
      total: s.total_points,
    };
  });

  // Nudge toward the under-discovered awards picker (award picks count toward
  // the Upfront score). Show the prompt until they've made at least one.
  const { data: myPred } = await supabase
    .from("bracket_predictions")
    .select("awards")
    .eq("league_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const awardCount = myPred?.awards
    ? Object.values(myPred.awards as Record<string, unknown>).filter((v) => v != null).length
    : 0;
  const needAwards = !locked && awardCount === 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <AutoRefresh enabled={nowMs() >= KICKOFF_MS} />
      <LeagueIntro />
      <Reveal>
        <div className="glass-strong rounded-3xl p-5 sm:p-6">
          <Link href="/dashboard" className="text-sm text-chalk-dim hover:text-chalk">
            &larr; Home
          </Link>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <LeagueNameEditor
                leagueId={id}
                initialName={league.name}
                isOwner={league.owner_id === user.id}
              />
              <p className="mt-1 text-sm text-chalk-dim">
                Code <span className="rounded bg-night/5 px-2 py-0.5 font-mono text-gold">{league.join_code}</span>
                {"  ·  "}
                <span className={locked ? "text-red-600" : "text-grass"}>
                  {locked ? "🔒 Bracket locked" : "🟢 Bracket open"}
                </span>
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
              <Link href={`/leagues/${id}/matches`} className={`${btnClass("ghost")} flex-1 text-center sm:flex-none`}>
                <span className="inline-flex items-center justify-center gap-1.5"><Ball size={15} /> Matches</span>
              </Link>
              <Link href={`/leagues/${id}/awards`} className={`${btnClass("ghost")} flex-1 text-center sm:flex-none`}>
                🥇 Awards
              </Link>
              <Link href={`/leagues/${id}/me`} className={`${btnClass("ghost")} flex-1 text-center sm:flex-none`}>
                📋 My picks
              </Link>
              <Link
                href={`/leagues/${id}/bracket`}
                className={`${btnClass("gold")} w-full text-center sm:w-auto`}
                style={{ background: GOLD_GRADIENT, boxShadow: "var(--shadow-glow-gold)" }}
              >
                {locked ? "View bracket" : <span className="inline-flex items-center justify-center gap-1.5"><Trophy size={15} /> Make picks</span>}
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      {needAwards && (
        <Reveal index={1}>
          <Link
            href={`/leagues/${id}/awards`}
            className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-4 transition hover:bg-gold/20"
          >
            <span className="text-2xl">🥇</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-chalk">Predict the tournament awards</span>
              <span className="block text-xs text-chalk-dim">
                Golden Boot, Ball, Glove &amp; Young Player — they count toward your Upfront score.
              </span>
            </span>
            <span className="shrink-0 text-lg text-gold">&rarr;</span>
          </Link>
        </Reveal>
      )}

      <Reveal index={2}>
        <section>
          <h2 className="mb-3 font-display text-xl text-chalk">Leaderboard</h2>
          <Leaderboard leagueId={id} initialRows={rows} meId={user.id} />
          <p className="mt-2 text-xs text-chalk-dim">
            Three crowns: top Upfront 🎯, top Live ⚡, top Total 👑. Updates live. Ties break by Upfront
            points, then name.{" "}
            <Link href="/how-it-works" className="font-semibold text-gold hover:text-gold-bright">
              How scoring works &rarr;
            </Link>
          </p>
        </section>
      </Reveal>
    </main>
  );
}
