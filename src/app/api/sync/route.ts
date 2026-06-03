import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { recomputeAllScores } from "@/lib/scoring-engine";
import { TOURNAMENT_TAG } from "@/lib/tournamentData";
import {
  fetchTeams,
  fetchStandings,
  fetchFixtures,
  fetchLiveFixtures,
  fetchFixtureEvents,
  fetchLineups,
  fetchTeamLastFixture,
  fetchSquad,
  fetchPlayersByTeam,
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
    // Live mode: lightweight per-minute pull of currently-live fixtures + their
    // lineups and events (for the pitch). The full sync (every 10 min) owns
    // teams/standings/squads/scoring — this stays cheap so it can run often.
    if (request.nextUrl.searchParams.get("mode") === "live") {
      const liveFixtures = await fetchLiveFixtures();
      if (liveFixtures.length) {
        await supabase.from("matches").upsert(
          liveFixtures.map((f) => ({
            id: f.fixture.id,
            status: mapStatus(f.fixture.status.short),
            home_goals: f.goals.home,
            away_goals: f.goals.away,
            winner_team_id: f.teams.home?.winner
              ? (f.teams.home?.id ?? null)
              : f.teams.away?.winner
                ? (f.teams.away?.id ?? null)
                : null,
            updated_at: new Date().toISOString(),
          })),
        );
      }
      let lineups = 0;
      let events = 0;
      for (const f of liveFixtures) {
        const fid = f.fixture.id;
        const lus = await fetchLineups(fid);
        if (lus.length) {
          await supabase.from("match_lineups").upsert(
            lus.map((l) => ({
              match_id: fid,
              team_id: l.team.id,
              formation: l.formation ?? null,
              xi: l.startXI.map((x) => ({
                player_id: x.player.id,
                name: x.player.name,
                number: x.player.number,
                pos: x.player.pos,
                grid: x.player.grid,
              })),
              subs: l.substitutes.map((x) => ({
                player_id: x.player.id,
                name: x.player.name,
                number: x.player.number,
                pos: x.player.pos,
              })),
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "match_id,team_id" },
          );
          lineups += lus.length;
        }
        // Replace the event timeline for this match (no stable ids → idempotent).
        const evs = await fetchFixtureEvents(fid, 20);
        await supabase.from("match_events").delete().eq("match_id", fid);
        const rows = evs
          .filter((e) => ["Goal", "Card", "subst"].includes(e.type))
          .map((e, i) => ({
            match_id: fid,
            team_id: e.team?.id ?? null,
            type: e.type.toLowerCase(), // goal | card | subst
            detail: e.detail ?? null,
            player_id: e.player?.id ?? null,
            player_name: e.player?.name ?? null,
            related_id: e.assist?.id ?? null,
            related_name: e.assist?.name ?? null,
            minute: e.time?.elapsed ?? null,
            sort: i,
          }));
        if (rows.length) {
          await supabase.from("match_events").insert(rows);
          events += rows.length;
        }
      }
      return NextResponse.json({ ok: true, mode: "live", live: liveFixtures.length, lineups, events });
    }

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
      // Reset, then re-flag only current squad members → cuts drop out of "WC players".
      await supabase.from("players").update({ in_squad: false }).gt("id", 0);
      let players = 0;
      for (const t of allTeams ?? []) {
        const squads = await fetchSquad(t.id);
        const list = squads[0]?.players ?? [];
        if (list.length) {
          await supabase.from("players").upsert(
            list.map((p) => ({
              id: p.id,
              team_id: t.id,
              name: p.name,
              position: p.position ?? null,
              age: p.age ?? null,
              number: p.number ?? null,
              photo_url: p.photo ?? null,
              in_squad: true,
            })),
          );
          players += list.length;
        }
      }
      summary.players = players;
    }

    // 2c) Player profiles: height/weight/birth/nationality (paginated /players;
    // on demand behind ?profiles=1 since it's ~3 calls per team).
    if (request.nextUrl.searchParams.get("profiles") === "1") {
      const { data: allTeams } = await supabase.from("teams").select("id");
      const num = (s: string | null) => {
        const n = parseInt(s ?? "", 10);
        return Number.isFinite(n) ? n : null;
      };
      let enriched = 0;
      for (const t of allTeams ?? []) {
        let page = 1;
        let total = 1;
        do {
          const { response, totalPages } = await fetchPlayersByTeam(t.id, page);
          total = totalPages;
          if (response.length) {
            await supabase.from("players").upsert(
              response.map((r) => ({
                id: r.player.id,
                team_id: t.id,
                name: r.player.name,
                height_cm: num(r.player.height),
                weight_kg: num(r.player.weight),
                birth_date: r.player.birth?.date ?? null,
                nationality: r.player.nationality ?? null,
              })),
            );
            enriched += response.length;
          }
          page++;
        } while (page <= total);
      }
      summary.profiles = enriched;
    }

    // 2d) Most-recent lineup per team (on demand — ~2 calls/team).
    if (request.nextUrl.searchParams.get("teamlineups") === "1") {
      const { data: allTeams } = await supabase.from("teams").select("id");
      const POS_FROM_LETTER: Record<string, string> = {
        G: "Goalkeeper",
        D: "Defender",
        M: "Midfielder",
        F: "Attacker",
      };
      let done = 0;
      for (const t of allTeams ?? []) {
        const fx = await fetchTeamLastFixture(t.id);
        const fid = fx[0]?.fixture.id;
        if (!fid) continue;
        const lus = await fetchLineups(fid);
        const l = lus.find((x) => x.team.id === t.id);
        if (!l) continue;

        // Raw XI as reported by the lineup feed.
        const rawXI = l.startXI.map((x) => ({
          player_id: x.player.id,
          name: x.player.name,
          number: x.player.number,
          pos: x.player.pos,
          grid: x.player.grid,
        }));

        // Drop anyone not in the current WC squad (e.g. friendly-only call-ups)
        // and backfill the slot with a same-position squad member so the
        // formation grid stays intact. If we have no squad, leave the XI as-is.
        const { data: squad } = await supabase
          .from("players")
          .select("id, name, number, position")
          .eq("team_id", t.id)
          .eq("in_squad", true);

        let xi = rawXI;
        if (squad && squad.length) {
          const squadIds = new Set(squad.map((p) => p.id));
          const used = new Set<number>();
          // Reserve every kept player up front so backfills can't duplicate them.
          for (const slot of rawXI) {
            if (squadIds.has(slot.player_id)) used.add(slot.player_id);
          }
          const cleaned: typeof rawXI = [];
          for (const slot of rawXI) {
            if (squadIds.has(slot.player_id)) {
              cleaned.push(slot);
              continue;
            }
            const want = POS_FROM_LETTER[slot.pos ?? ""];
            const rep = squad.find(
              (p) => !used.has(p.id) && (want == null || p.position === want),
            );
            if (rep) {
              cleaned.push({
                player_id: rep.id,
                name: rep.name,
                number: rep.number,
                pos: slot.pos,
                grid: slot.grid,
              });
              used.add(rep.id);
            }
            // else: no same-position squad player left → drop the slot.
          }
          xi = cleaned;
        }

        await supabase.from("team_lineups").upsert({
          team_id: t.id,
          formation: l.formation ?? null,
          xi,
          fixture_id: fid,
          updated_at: new Date().toISOString(),
        });
        done += 1;
      }
      summary.team_lineups = done;
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
            // Advancer (correct for shootouts) — powers the pen-winner scoring
            // and fixes a pens-decided final crowning the wrong champion.
            winner_team_id: f.teams.home?.winner
              ? (f.teams.home?.id ?? null)
              : f.teams.away?.winner
                ? (f.teams.away?.id ?? null)
                : null,
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
    let cardsImported = 0;
    for (const m of pending ?? []) {
      const events = await fetchFixtureEvents(m.id);
      const goals = events.filter(
        (e) =>
          e.type === "Goal" &&
          e.detail !== "Missed Penalty" &&
          e.detail !== "Own Goal" &&
          e.player?.id != null,
      );
      const cards = events.filter((e) => e.type === "Card" && e.player?.id != null);

      // Upsert every player we're about to reference (FK), from goals and cards alike.
      const involved = new Map<number, { id: number; team_id: number; name: string }>();
      for (const e of [...goals, ...cards]) {
        involved.set(e.player.id!, {
          id: e.player.id!,
          team_id: e.team.id,
          name: e.player.name ?? "Unknown",
        });
      }
      if (involved.size) {
        await supabase.from("players").upsert([...involved.values()]);
      }

      // Count goals per player (a player can score a brace/hat-trick) so the
      // live game can credit per-scorer goal counts, not just "did they score".
      const goalCount = new Map<number, number>();
      for (const g of goals) goalCount.set(g.player.id!, (goalCount.get(g.player.id!) ?? 0) + 1);
      if (goalCount.size) {
        await supabase.from("match_goals").upsert(
          [...goalCount].map(([player_id, cnt]) => ({ match_id: m.id, player_id, goals: cnt })),
        );
        goalsImported += goals.length;
      }

      // Cards: delete+reinsert so re-runs stay idempotent (a player can earn two).
      await supabase.from("match_cards").delete().eq("match_id", m.id);
      if (cards.length) {
        await supabase.from("match_cards").insert(
          cards.map((c) => ({
            match_id: m.id,
            player_id: c.player.id!,
            team_id: c.team.id,
            type:
              c.detail === "Red Card" || c.detail === "Second Yellow card"
                ? "red"
                : "yellow",
            minute: c.time?.elapsed ?? null,
          })),
        );
        cardsImported += cards.length;
      }

      await supabase.from("matches").update({ goals_synced: true }).eq("id", m.id);
    }
    summary.goals = goalsImported;
    summary.cards = cardsImported;

    // 5) Recompute scores
    await recomputeAllScores(supabase);

    // Bust the cached teams/players list (rosters/logos may have changed).
    // Next 16: revalidateTag takes a cache-life profile; "max" = serve stale
    // while refreshing in the background (fine for slowly-changing roster data).
    revalidateTag(TOURNAMENT_TAG, "max");

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
