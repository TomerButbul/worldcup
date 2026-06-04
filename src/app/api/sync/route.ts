import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { recomputeAllScores } from "@/lib/scoring-engine";
import { TOURNAMENT_TAG } from "@/lib/tournamentData";
import { sendToUsers } from "@/lib/push";
import { teamAt } from "@/lib/draft";
import { draftTeamIds } from "@/lib/draft-scoring";
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

      // Read the score we last *pushed* for each live fixture BEFORE the upsert
      // overwrites home_goals/away_goals, so we can tell whether a new goal
      // happened this run. (null notified = nothing pushed yet → treat as 0.)
      const notifiedBefore = new Map<number, { home: number; away: number }>();
      if (liveFixtures.length) {
        const { data: prev } = await supabase
          .from("matches")
          .select("id, notified_home_goals, notified_away_goals")
          .in(
            "id",
            liveFixtures.map((f) => f.fixture.id),
          );
        for (const r of prev ?? []) {
          notifiedBefore.set(r.id, {
            home: r.notified_home_goals ?? 0,
            away: r.notified_away_goals ?? 0,
          });
        }

        await supabase.from("matches").upsert(
          liveFixtures.map((f) => ({
            id: f.fixture.id,
            status: mapStatus(f.fixture.status.short),
            home_goals: f.goals.home,
            away_goals: f.goals.away,
            // Live minute (status.elapsed isn't in the shared AfFixture type).
            elapsed: (f.fixture.status as { elapsed?: number | null }).elapsed ?? null,
            winner_team_id: f.teams.home?.winner
              ? (f.teams.home?.id ?? null)
              : f.teams.away?.winner
                ? (f.teams.away?.id ?? null)
                : null,
            updated_at: new Date().toISOString(),
          })),
        );
      }

      // Goal-notify accumulator: one entry per fixture whose score increased
      // this run. We send AFTER the loop so recipient lookups batch once.
      const goalEvents: {
        matchId: number;
        homeId: number | null;
        awayId: number | null;
        newHome: number;
        newAway: number;
        scoringTeamId: number | null;
        scorerName: string | null;
      }[] = [];

      let lineups = 0;
      let events = 0;
      let stats = 0;
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

        // Goal detection (best-effort, never blocks the sync): a goal happened
        // when the live total exceeds the score we last pushed for. The side
        // whose count rose is the scorer; pull the latest goal scorer's name for
        // that side from the events we already have (cheap, no extra API call).
        const newHome = f.goals.home ?? 0;
        const newAway = f.goals.away ?? 0;
        const before = notifiedBefore.get(fid) ?? { home: 0, away: 0 };
        if (newHome + newAway > before.home + before.away) {
          const homeScored = newHome > before.home;
          const scoringTeamId = homeScored ? (f.teams.home?.id ?? null) : (f.teams.away?.id ?? null);
          const scorerName =
            scoringTeamId != null
              ? (evs
                  .filter((e) => e.type === "Goal" && e.team?.id === scoringTeamId && e.player?.name)
                  .at(-1)?.player.name ?? null)
              : null;
          goalEvents.push({
            matchId: fid,
            homeId: f.teams.home?.id ?? null,
            awayId: f.teams.away?.id ?? null,
            newHome,
            newAway,
            scoringTeamId,
            scorerName,
          });
        }

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
        // Per-team live statistics (possession, shots, passes, …).
        stats += await syncMatchStats(supabase, fid);
      }

      // LIVE-GOAL push: notify the users who care about each match that just
      // scored (favorite team OR a nation they drafted). Best-effort and fully
      // additive — wrapped so a push failure can never break the score sync.
      let goalsNotified = 0;
      if (goalEvents.length) {
        try {
          // Every team id involved in a goal this run — scope all reads to these.
          const teamIds = [
            ...new Set(
              goalEvents.flatMap((g) => [g.homeId, g.awayId]).filter((id): id is number => id != null),
            ),
          ];

          // (a) team names for the notification body (home/away + scorer's side).
          const { data: teamRows } = await supabase
            .from("teams")
            .select("id, name")
            .in("id", teamIds);
          const teamName = new Map<number, string>();
          for (const t of teamRows ?? []) teamName.set(t.id, t.name);

          // (b) favorites: profiles whose favorite_team_id is one of these teams.
          const favByTeam = new Map<number, string[]>();
          const { data: favRows } = await supabase
            .from("profiles")
            .select("id, favorite_team_id")
            .in("favorite_team_id", teamIds);
          for (const p of favRows ?? []) {
            if (p.favorite_team_id == null) continue;
            (favByTeam.get(p.favorite_team_id) ?? favByTeam.set(p.favorite_team_id, []).get(p.favorite_team_id)!).push(p.id);
          }

          // (c) drafted: resolve each draft pick (pot, slot) → draft team name →
          // synced team id, then group the drafters by that team id. Read all
          // picks + the team-name map ONCE for the whole run.
          const draftByTeam = new Map<number, string[]>();
          const { data: allTeams } = await supabase.from("teams").select("id, name");
          const nameToId = draftTeamIds(allTeams ?? []);
          const { data: picks } = await supabase.from("draft_picks").select("user_id, pot, slot");
          for (const pick of picks ?? []) {
            const dt = teamAt(pick.pot, pick.slot);
            const tid = dt ? nameToId.get(dt.name) : undefined;
            if (tid == null || !teamIds.includes(tid)) continue;
            (draftByTeam.get(tid) ?? draftByTeam.set(tid, []).get(tid)!).push(pick.user_id);
          }

          for (const g of goalEvents) {
            const homeName = (g.homeId != null ? teamName.get(g.homeId) : null) ?? "Home";
            const awayName = (g.awayId != null ? teamName.get(g.awayId) : null) ?? "Away";
            const scoringName =
              (g.scoringTeamId != null ? teamName.get(g.scoringTeamId) : null) ??
              (g.scoringTeamId === g.homeId ? homeName : awayName);

            // Union of favorite + drafted users for either side of this match.
            const recipients = new Set<string>();
            for (const id of [g.homeId, g.awayId]) {
              if (id == null) continue;
              for (const u of favByTeam.get(id) ?? []) recipients.add(u);
              for (const u of draftByTeam.get(id) ?? []) recipients.add(u);
            }

            if (recipients.size) {
              const body = g.scorerName
                ? `${g.scorerName} — ${homeName} ${g.newHome}–${g.newAway} ${awayName}`
                : `${homeName} ${g.newHome}–${g.newAway} ${awayName}`;
              await sendToUsers([...recipients], {
                title: `⚽ ${scoringName} GOAL!`,
                body,
                url: "/dashboard",
                tag: `goal-${g.matchId}`,
              });
              goalsNotified += 1;
            }

            // Record the score we pushed for so the 60s cron stays idempotent.
            // Always set to the current score (even with no recipients) so a
            // VAR-disallowed goal can't wedge it and a re-goal still fires.
            await supabase
              .from("matches")
              .update({ notified_home_goals: g.newHome, notified_away_goals: g.newAway })
              .eq("id", g.matchId);
          }
        } catch {
          // Swallow: notifications are best-effort; never fail the score sync.
        }
      }

      return NextResponse.json({
        ok: true,
        mode: "live",
        live: liveFixtures.length,
        lineups,
        events,
        stats,
        goalsNotified,
      });
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
    let statsImported = 0;
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

      // Participation → match_player_stats (Appearances = rows, Minutes, Assists).
      // Starters play from minute 0; subs from their on-minute; subbed-off players
      // stop at their off-minute. FT is 90, or ~120 when the match went to ET.
      const lineups = await fetchLineups(m.id);
      const subEvents = events
        .filter((e) => e.type === "subst")
        .map((e) => ({ on: e.player?.id ?? null, off: e.assist?.id ?? null, minute: e.time?.elapsed ?? null }))
        .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
      const maxMin = events.reduce((mx, e) => Math.max(mx, e.time?.elapsed ?? 0), 0);
      const ft = maxMin > 90 ? Math.max(maxMin, 120) : 90;
      const span = new Map<number, { start: number; end: number }>();
      for (const l of lineups) {
        for (const x of l.startXI) span.set(x.player.id, { start: 0, end: ft });
      }
      for (const s of subEvents) {
        if (s.on != null) {
          const cur = span.get(s.on);
          span.set(s.on, { start: s.minute ?? 0, end: cur?.end ?? ft });
        }
        if (s.off != null) {
          const cur = span.get(s.off) ?? { start: 0, end: ft };
          span.set(s.off, { start: cur.start, end: s.minute ?? ft });
        }
      }
      const assistCount = new Map<number, number>();
      for (const g of goals) {
        const aid = g.assist?.id;
        if (aid != null) assistCount.set(aid, (assistCount.get(aid) ?? 0) + 1);
      }
      const appeared = new Set<number>([
        ...span.keys(),
        ...goalCount.keys(),
        ...assistCount.keys(),
        ...cards.map((c) => c.player.id!),
      ]);
      if (appeared.size) {
        // Per-player saves for this fixture (keepers); 0 for everyone else.
        const savesByPlayer = await fetchSavesByPlayer(m.id);
        await supabase.from("match_player_stats").upsert(
          [...appeared].map((pid) => {
            const sp = span.get(pid);
            const minutes = sp ? Math.max(0, Math.min(ft, sp.end) - sp.start) : 0;
            return {
              match_id: m.id,
              player_id: pid,
              minutes,
              assists: assistCount.get(pid) ?? 0,
              saves: savesByPlayer.get(pid) ?? 0,
            };
          }),
          { onConflict: "match_id,player_id" },
        );
      }

      // Final per-team statistics for the finished match.
      statsImported += await syncMatchStats(supabase, m.id);

      await supabase.from("matches").update({ goals_synced: true }).eq("id", m.id);
    }
    summary.goals = goalsImported;
    summary.cards = cardsImported;
    summary.stats = statsImported;

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

// --- Per-player fixture statistics (fixtures/players) ----------------------
// Also not in the shared client. Returns per-team blocks, each with a players
// array; every player's statistics[0] carries a `goals.saves` (number for
// keepers, null/absent for outfielders). We only read saves here — minutes and
// assists keep coming from the lineup/event derivation above (more accurate for
// sub timing). Best-effort: an empty/erroring response yields an empty map.
interface AfFixturePlayers {
  team: { id: number };
  players: {
    player: { id: number };
    statistics: { goals?: { saves?: number | null } | null }[];
  }[];
}

async function fetchFixturePlayers(fixtureId: number): Promise<AfFixturePlayers[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  const url = new URL("https://v3.football.api-sports.io/fixtures/players");
  url.searchParams.set("fixture", String(fixtureId));
  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
    next: { revalidate: 20 }, // short cache: live saves should stay fresh
  });
  if (!res.ok) {
    throw new Error(`API-Football /fixtures/players -> ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { response?: AfFixturePlayers[] };
  return json.response ?? [];
}

// Map of player_id -> saves for one fixture (keepers only get a non-zero value).
// Wrapped so a missing/failed feed never blocks the appearance upsert: returns
// an empty map and saves default to 0.
async function fetchSavesByPlayer(fixtureId: number): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  try {
    for (const block of await fetchFixturePlayers(fixtureId)) {
      for (const p of block.players ?? []) {
        const saves = p.statistics?.[0]?.goals?.saves ?? 0;
        if (p.player?.id != null) out.set(p.player.id, saves ?? 0);
      }
    }
  } catch {
    // Best-effort: leave the map empty so every appearance stores saves = 0.
  }
  return out;
}

// --- Match statistics (fixtures/statistics) -------------------------------
// Not exposed by the shared apiFootball client, so we call the endpoint here
// with the same base URL + auth header. Each response entry is one team and
// its statistic list: { team: { id }, statistics: [ { type, value }, … ] }.
interface AfTeamStatistics {
  team: { id: number };
  statistics: { type: string; value: number | string | null }[];
}

async function fetchStatistics(fixtureId: number): Promise<AfTeamStatistics[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  const url = new URL("https://v3.football.api-sports.io/fixtures/statistics");
  url.searchParams.set("fixture", String(fixtureId));
  const res = await fetch(url, {
    headers: { "x-apisports-key": key },
    next: { revalidate: 20 }, // short cache: live stats should stay fresh
  });
  if (!res.ok) {
    throw new Error(`API-Football /fixtures/statistics -> ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { response?: AfTeamStatistics[] };
  return json.response ?? [];
}

// Fold a team's [{type,value}, …] list into a { type: value } JSONB object,
// keeping the raw API type strings as keys and values as-is.
function statsToObject(list: AfTeamStatistics["statistics"]): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = {};
  for (const s of list) out[s.type] = s.value;
  return out;
}

// Upsert per-team statistics for one fixture into match_stats. Returns the
// number of team rows written (0 if the API has no stats yet — e.g. a match
// that hasn't kicked off). Defensive: skips teams with an empty stat list.
async function syncMatchStats(
  supabase: ReturnType<typeof createServiceClient>,
  matchId: number,
): Promise<number> {
  const teamStats = await fetchStatistics(matchId);
  const rows = teamStats
    .filter((t) => t.team?.id != null && (t.statistics?.length ?? 0) > 0)
    .map((t) => ({
      match_id: matchId,
      team_id: t.team.id,
      stats: statsToObject(t.statistics),
    }));
  if (!rows.length) return 0;
  await supabase.from("match_stats").upsert(rows, { onConflict: "match_id,team_id" });
  return rows.length;
}
