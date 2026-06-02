import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { recomputeAllScores } from "@/lib/scoring-engine";
import {
  fetchTeams,
  fetchStandings,
  fetchFixtures,
  fetchFixtureEvents,
  fetchSquad,
  mapStage,
  mapStatus,
} from "@/lib/apiFootball";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  // Accept SYNC_SECRET (manual) or CRON_SECRET (Vercel cron sends it as a bearer token).
  const allowed = [process.env.SYNC_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (allowed.length === 0 || !secret || !allowed.includes(secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const summary: Record<string, number> = {};

  try {
    // 1) Teams
    const teams = await fetchTeams();
    if (teams.length) {
      await supabase.from("teams").upsert(
        teams.map((t) => ({
          id: t.team.id,
          name: t.team.name,
          code: t.team.code,
          logo_url: t.team.logo,
        })),
      );
      summary.teams = teams.length;
    }

    // 2) Group labels from standings (e.g. "Group A" -> "A")
    const standings = await fetchStandings();
    const groupUpdates: { id: number; group_label: string }[] = [];
    for (const league of standings) {
      for (const group of league.league?.standings ?? []) {
        for (const row of group) {
          // Only real group tables ("Group A".."Group L"). The 48-team format also
          // returns a "Ranking of third-placed teams" table that would otherwise
          // clobber each group's 4th team with a junk label.
          const m = row.group?.match(/^Group\s+([A-L])$/i);
          if (m) groupUpdates.push({ id: row.team.id, group_label: m[1].toUpperCase() });
        }
      }
    }
    for (const g of groupUpdates) {
      await supabase.from("teams").update({ group_label: g.group_label }).eq("id", g.id);
    }
    summary.group_labels = groupUpdates.length;

    // 2b) Squads (on demand only — 1 API call per team, so guard behind ?squads=1)
    if (request.nextUrl.searchParams.get("squads") === "1") {
      const { data: allTeams } = await supabase.from("teams").select("id");
      let players = 0;
      for (const t of allTeams ?? []) {
        const squads = await fetchSquad(t.id);
        const list = squads[0]?.players ?? [];
        if (list.length) {
          await supabase.from("players").upsert(
            list.map((p) => ({ id: p.id, team_id: t.id, name: p.name })),
          );
          players += list.length;
        }
      }
      summary.players = players;
    }

    // 3) Fixtures -> matches
    const fixtures = await fetchFixtures();
    if (fixtures.length) {
      await supabase.from("matches").upsert(
        fixtures.map((f) => {
          const stage = mapStage(f.league.round);
          return {
            id: f.fixture.id,
            stage,
            group_label: stage === "group" ? roundGroup(f.league.round) : null,
            kickoff_at: f.fixture.date,
            status: mapStatus(f.fixture.status.short),
            home_team_id: f.teams.home?.id ?? null,
            away_team_id: f.teams.away?.id ?? null,
            home_goals: f.goals.home,
            away_goals: f.goals.away,
            updated_at: new Date().toISOString(),
          };
        }),
      );
      summary.fixtures = fixtures.length;
    }

    // 4) Goal events for finished matches not yet imported
    const { data: pending } = await supabase
      .from("matches")
      .select("id")
      .eq("status", "finished")
      .eq("goals_synced", false);

    let goalsImported = 0;
    for (const m of pending ?? []) {
      const events = await fetchFixtureEvents(m.id);
      const goals = events.filter(
        (e) =>
          e.type === "Goal" &&
          e.detail !== "Missed Penalty" &&
          e.detail !== "Own Goal" &&
          e.player?.id != null,
      );

      // upsert players then goals (FK)
      if (goals.length) {
        await supabase.from("players").upsert(
          goals.map((g) => ({
            id: g.player.id!,
            team_id: g.team.id,
            name: g.player.name ?? "Unknown",
          })),
        );
        await supabase.from("match_goals").upsert(
          goals.map((g) => ({ match_id: m.id, player_id: g.player.id! })),
        );
        goalsImported += goals.length;
      }
      await supabase.from("matches").update({ goals_synced: true }).eq("id", m.id);
    }
    summary.goals = goalsImported;

    // 5) Recompute scores
    await recomputeAllScores(supabase);

    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// "Group A - 1" -> "A"
function roundGroup(round: string): string | null {
  const m = round.match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}
