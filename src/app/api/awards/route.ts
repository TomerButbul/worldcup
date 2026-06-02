import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { recomputeAllScores } from "@/lib/scoring-engine";
import { AWARD_KEYS } from "@/lib/scoring-core";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Operator tool to record the individual-award winners at tournament end.
// Golden Boot is auto-derived from goal data, but can be overridden here too.
//   GET /api/awards?secret=...                       → list current winners
//   GET /api/awards?secret=...&key=golden_ball&player=276  → set a winner (+ rescore)
//   GET /api/awards?secret=...&key=golden_glove&player=    → clear a winner
export async function GET(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  const allowed = [process.env.SYNC_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (allowed.length === 0 || !secret || !allowed.includes(secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const key = request.nextUrl.searchParams.get("key");
  const playerParam = request.nextUrl.searchParams.get("player");

  if (key) {
    if (!(AWARD_KEYS as readonly string[]).includes(key)) {
      return NextResponse.json(
        { error: `key must be one of: ${AWARD_KEYS.join(", ")}` },
        { status: 400 },
      );
    }
    const playerId = playerParam ? Number(playerParam) : null;
    if (playerParam && !Number.isInteger(playerId)) {
      return NextResponse.json(
        { error: "player must be an integer id (or omit to clear the winner)" },
        { status: 400 },
      );
    }
    await supabase
      .from("tournament_awards")
      .upsert({ key, player_id: playerId, updated_at: new Date().toISOString() }, { onConflict: "key" });
    // Rescore so the new winner counts toward everyone's Upfront total.
    await recomputeAllScores(supabase);
  }

  const { data } = await supabase.from("tournament_awards").select("key, player_id");
  return NextResponse.json({ ok: true, awards: data ?? [] });
}
