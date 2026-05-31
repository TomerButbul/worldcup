import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { recomputeAllScores } from "@/lib/scoring-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Recompute all league scores from whatever is currently in the DB.
// Unlike /api/sync, this makes NO external API calls — useful for testing
// (edit match results by hand, then hit this) and for re-scoring on demand.
export async function GET(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  const allowed = [process.env.SYNC_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (allowed.length === 0 || !secret || !allowed.includes(secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    await recomputeAllScores(supabase);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
