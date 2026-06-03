import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { broadcast, type PushPayload } from "@/lib/push";
import { KICKOFF_MS } from "@/lib/clock";

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
      title: "🔔 World Cup test",
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
  async function once(key: string, payload: PushPayload) {
    const { data: existing } = await s.from("notif_sent").select("key").eq("key", key).maybeSingle();
    if (existing) return;
    const n = await broadcast(payload);
    await s.from("notif_sent").insert({ key });
    sent.push(`${key}=${n}`);
  }

  // Bracket + awards lock at the tournament kickoff.
  const toLock = KICKOFF_MS - now;
  if (toLock > 0 && toLock <= 24 * H) {
    await once("lock_24h", {
      title: "⏰ Picks lock tomorrow",
      body: "Your bracket & awards lock when the World Cup kicks off. Get them in!",
      url: "/dashboard",
      tag: "lock",
    });
  }
  if (toLock > 0 && toLock <= H) {
    await once("lock_1h", {
      title: "🚨 1 hour to lock",
      body: "Last chance to finish your bracket & awards before kickoff!",
      url: "/dashboard",
      tag: "lock",
    });
  }

  // Per-match nudge: matches kicking off within ~75 min.
  const { data: upcoming } = await s
    .from("matches")
    .select("id, kickoff_at, home_team_id, away_team_id")
    .gt("kickoff_at", new Date(now).toISOString())
    .lte("kickoff_at", new Date(now + 75 * 60_000).toISOString());
  if (upcoming?.length) {
    const { data: teams } = await s.from("teams").select("id, name");
    const nm = new Map((teams ?? []).map((t) => [t.id, t.name]));
    for (const m of upcoming) {
      const home = m.home_team_id ? (nm.get(m.home_team_id) ?? "TBD") : "TBD";
      const away = m.away_team_id ? (nm.get(m.away_team_id) ?? "TBD") : "TBD";
      await once(`match_${m.id}`, {
        title: `⚽ ${home} vs ${away}`,
        body: "Kicks off soon — lock in your scorers!",
        url: "/dashboard",
        tag: `m${m.id}`,
      });
    }
  }

  return NextResponse.json({ ok: true, sent });
}
