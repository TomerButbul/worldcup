import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { broadcast, broadcastCategory, sendToUsersCategory, type PushPayload } from "@/lib/push";
import { KICKOFF_MS } from "@/lib/clock";
import { usersToNudge } from "@/lib/alerts";

// Reminder sender — hit by a cron every ~15 min. Sends each reminder once
// (deduped via notif_sent): bracket lock (24h / 1h before kickoff) and a
// nudge ~60-75 min before every match. Secret-gated like /api/sync.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  const allowed = [process.env.SYNC_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (allowed.length === 0 || !secret || !allowed.includes(secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Manual smoke test: broadcast a one-off push now, ignoring schedule + dedup.
  if (request.nextUrl.searchParams.get("test") === "1") {
    const n = await broadcast({
      title: "⚽ World Cup test",
      body: "Reminders are working! ⚽",
      url: "/dashboard",
      tag: "test",
    });
    return NextResponse.json({ ok: true, test: n });
  }

  const s = createServiceClient();
  const now = Date.now();
  const H = 3_600_000;
  const sent: string[] = [];

  // Send a reminder at most once, ever (keyed in notif_sent).
  async function once(key: string, category: string, payload: PushPayload) {
    const { data: existing } = await s.from("notif_sent").select("key").eq("key", key).maybeSingle();
    if (existing) return;
    const n = await broadcastCategory(category, payload);
    await s.from("notif_sent").insert({ key });
    sent.push(`${key}=${n}`);
  }

  // Bracket + awards lock at the tournament kickoff.
  const toLock = KICKOFF_MS - now;
  if (toLock > 0 && toLock <= 24 * H) {
    await once("lock_24h", "deadlines", {
      title: "🏆 Picks lock tomorrow",
      body: "Your bracket & awards lock when the World Cup kicks off. Get them in!",
      url: "/dashboard",
      tag: "lock",
    });
  }
  if (toLock > 0 && toLock <= H) {
    await once("lock_1h", "deadlines", {
      title: "🏆 1 hour to lock",
      body: "Last chance to finish your bracket & awards before kickoff!",
      url: "/dashboard",
      tag: "lock",
    });
  }

  // Per-match nudge: real matches kicking off within ~2h — but ONLY to players
  // who can predict and haven't predicted THIS match yet (no point nagging
  // someone already locked in). Once per match via notif_sent. Sentinels (the
  // gated proxy/test matches, id >= 9_000_000) are excluded so a private test
  // match can never broadcast to the whole user base.
  const { data: upcoming } = await s
    .from("matches")
    .select("id, kickoff_at, home_team_id, away_team_id")
    .lt("id", 9_000_000)
    .gt("kickoff_at", new Date(now).toISOString())
    .lte("kickoff_at", new Date(now + 2 * H).toISOString());
  if (upcoming?.length) {
    const { data: teams } = await s.from("teams").select("id, name");
    const nm = new Map((teams ?? []).map((t) => [t.id, t.name]));
    // Everyone who CAN predict = members of a non-draft league. Predictions are
    // account-level, so membership in any prediction league is enough.
    const { data: members } = await s
      .from("league_members")
      .select("user_id, leagues!inner(kind)")
      .neq("leagues.kind", "draft");
    const eligible = [...new Set((members ?? []).map((m) => m.user_id as string))];
    for (const m of upcoming) {
      const key = `nopred_${m.id}`;
      const { data: ex } = await s.from("notif_sent").select("key").eq("key", key).maybeSingle();
      if (ex) continue;
      const { data: preds } = await s.from("match_predictions").select("user_id").eq("match_id", m.id);
      const recipients = usersToNudge(
        eligible,
        (preds ?? []).map((p) => p.user_id as string),
      );
      const home = m.home_team_id ? (nm.get(m.home_team_id) ?? "TBD") : "TBD";
      const away = m.away_team_id ? (nm.get(m.away_team_id) ?? "TBD") : "TBD";
      const n = recipients.length
        ? await sendToUsersCategory(recipients, "matches", {
            title: `⚽ ${home} vs ${away}`,
            body: "Kicks off soon and you haven't predicted yet — get your pick in →",
            url: `/predict#match-${m.id}`,
            tag: `m${m.id}`,
          })
        : 0;
      await s.from("notif_sent").insert({ key });
      sent.push(`${key}=${n}`);
    }
  }

  // Full-time results: a match that just finished → tell everyone who predicted
  // it how it ended. Scoped to games that kicked off in the last ~4h so we never
  // backfill a burst for old matches; deduped once per match via notif_sent.
  const { data: justFinished } = await s
    .from("matches")
    .select("id, home_team_id, away_team_id, home_goals, away_goals")
    .eq("status", "finished")
    .lt("id", 9_000_000)
    .gte("kickoff_at", new Date(now - 4 * H).toISOString());
  if (justFinished?.length) {
    const { data: rteams } = await s.from("teams").select("id, name");
    const rnm = new Map((rteams ?? []).map((t) => [t.id, t.name]));
    for (const m of justFinished) {
      const key = `result_${m.id}`;
      const { data: ex } = await s.from("notif_sent").select("key").eq("key", key).maybeSingle();
      if (ex) continue;
      const { data: preds } = await s.from("match_predictions").select("user_id").eq("match_id", m.id);
      const userIds = [...new Set((preds ?? []).map((p) => p.user_id as string))];
      const home = m.home_team_id ? (rnm.get(m.home_team_id) ?? "TBD") : "TBD";
      const away = m.away_team_id ? (rnm.get(m.away_team_id) ?? "TBD") : "TBD";
      const n = userIds.length
        ? await sendToUsersCategory(userIds, "results", {
            title: `⚽ Full time: ${home} ${m.home_goals ?? 0}–${m.away_goals ?? 0} ${away}`,
            body: "See how your picks did →",
            url: `/predict#match-${m.id}`,
            tag: `ft-${m.id}`,
          })
        : 0;
      await s.from("notif_sent").insert({ key });
      sent.push(`${key}=${n}`);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
