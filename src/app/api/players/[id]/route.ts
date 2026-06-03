import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedPlayer, getCachedClubStats } from "@/lib/playerProfile";

// Player profile for the tap-to-open card. Auth-gated (app-only), reads cached
// public tournament data — cheap even when many viewers tap the same star.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const pid = Number.parseInt(id, 10);
  if (!Number.isFinite(pid)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const profile = await getCachedPlayer(pid);
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
  const extra = await getCachedClubStats(pid, profile.team?.id ?? null);
  return NextResponse.json({ ...profile, injured: extra.injured, club: extra.club });
}
